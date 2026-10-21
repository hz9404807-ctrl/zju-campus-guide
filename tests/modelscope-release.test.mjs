import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { assertFreePublicDocker, assertManagedRemote, deployRelease, inspectRelease, prepareRelease, RELEASE_MARKER, studioId, studioRequest, validatePublicConfig } from '../scripts/modelscope-release.mjs'

const SHA = 'a'.repeat(40)
const CONFIG = { VITE_SUPABASE_URL: 'https://fixture-project.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixtureabcdefghijklmnop', VITE_FOOD_PROFILES_READY: 'false', VITE_FOOD_EMAIL_AUTH_READY: 'true' }
const REPO = 'https://github.com/hz9404807-ctrl/zju-campus-guide'

async function fixture(t) {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'campus-release-test-'))
  t.after(() => rm(rootDir, { recursive: true, force: true }))
  await mkdir(path.join(rootDir, 'dist', 'assets'), { recursive: true })
  await mkdir(path.join(rootDir, 'deployment', 'modelscope'), { recursive: true })
  await writeFile(path.join(rootDir, 'dist', 'index.html'), '<html><script src="/assets/index.js"></script></html>')
  await writeFile(path.join(rootDir, 'dist', 'assets', 'index.js'), `const config=${JSON.stringify(CONFIG)};const message="service_role is not allowed"`)
  await writeFile(path.join(rootDir, 'deployment', 'modelscope', 'Dockerfile'), 'FROM node:24-alpine\nCOPY dist /app/dist\n')
  await writeFile(path.join(rootDir, 'deployment', 'modelscope', 'server.mjs'), 'console.log("server")\n')
  await writeFile(path.join(rootDir, '.env.local'), 'PRIVATE_CREDENTIAL=not-for-upload')
  return { rootDir, env: CONFIG, sourceCommit: SHA }
}

test('production config rejects empty, private, invalid or newly enabled profiles; demo is explicit', () => {
  assert.throws(() => validatePublicConfig({}), /real Supabase/)
  assert.deepEqual(validatePublicConfig({}, true), { mode: 'demo' })
  assert.throws(() => validatePublicConfig({ VITE_SUPABASE_URL: CONFIG.VITE_SUPABASE_URL }, true), /required/)
  for (const key of ['sb_secret_abcdefghijklmnop', 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature']) assert.throws(() => validatePublicConfig({ ...CONFIG, VITE_SUPABASE_PUBLISHABLE_KEY: key }), /publishable/)
  for (const url of ['http://project.supabase.co', 'https://user:pass@project.supabase.co', 'https://project.supabase.co/?token=private', 'https://127.0.0.1', 'https://host.internal']) assert.throws(() => validatePublicConfig({ ...CONFIG, VITE_SUPABASE_URL: url }), /HTTPS/)
  assert.throws(() => validatePublicConfig({ ...CONFIG, VITE_FOOD_PROFILES_READY: 'true' }), /five-profile/)
  assert.throws(() => validatePublicConfig({ ...CONFIG, VITE_SERVICE_ROLE_KEY: 'secret' }), /Private/)
  assert.equal(validatePublicConfig(CONFIG).mode, 'connected')
})

test('prepare copies only build/runtime allowlist, records provenance and supports safe repeated preparation', async (t) => {
  const options = await fixture(t)
  const first = await prepareRelease(options)
  const version = await inspectRelease(first.directory, { env: CONFIG })
  assert.equal(version.commit, SHA)
  assert.equal(version.repository, REPO)
  assert.equal(JSON.parse(await readFile(path.join(first.directory, 'dist', 'release.json'), 'utf8')).sourceCommit, SHA)
  assert.deepEqual((await readdir(first.directory)).sort(), ['Dockerfile', 'README.md', 'dist', 'server.mjs', 'version.json'])
  assert.match(await readFile(path.join(first.directory, 'README.md'), 'utf8'), new RegExp(RELEASE_MARKER))
  assert.equal((await prepareRelease(options)).fileCount, first.fileCount)
  await writeFile(path.join(first.directory, 'dist', 'assets', 'index.js'), 'tampered')
  await assert.rejects(inspectRelease(first.directory), /changed since preparation/)
})

test('prepare rejects stale configuration and accidental credentials in build output', async (t) => {
  const options = await fixture(t)
  await assert.rejects(prepareRelease({ ...options, env: { ...CONFIG, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_anotherabcdefghijklmnop' } }), /Rebuild/)
  await writeFile(path.join(options.rootDir, 'dist', 'assets', 'index.js'), 'const credential="sb_secret_abcdefghijklmnop"')
  await assert.rejects(prepareRelease(options), /credential/)
  await writeFile(path.join(options.rootDir, 'dist', 'assets', 'index.js'), `const credential="${'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signaturelong'}"`)
  await assert.rejects(prepareRelease(options), /credential/)
})

test('prepare rejects secret files, source maps, symlinks and unowned output directories', async (t) => {
  const options = await fixture(t)
  const bad = path.join(options.rootDir, 'dist', '.env')
  await writeFile(bad, 'private')
  await assert.rejects(prepareRelease(options), /Hidden/)
  await rm(bad)
  const map = path.join(options.rootDir, 'dist', 'assets', 'index.js.map')
  await writeFile(map, '{}')
  await assert.rejects(prepareRelease(options), /Unexpected/)
  await rm(map)
  const linked = path.join(options.rootDir, 'dist', 'assets', 'linked.js')
  try {
    await symlink(path.join(options.rootDir, '.env.local'), linked)
    await assert.rejects(prepareRelease(options), /Symbolic/)
    await rm(linked)
  } catch (error) { if (!['EPERM', 'EACCES'].includes(error.code)) throw error }
  const output = path.join(options.rootDir, 'outputs', 'modelscope-release')
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, 'keep-me.md'), 'another task')
  await assert.rejects(prepareRelease(options), /Unexpected/)
  assert.equal(await readFile(path.join(output, 'keep-me.md'), 'utf8'), 'another task')
})

test('explicit demo build cannot be deployed', async (t) => {
  const options = await fixture(t)
  const release = await prepareRelease({ ...options, env: {}, allowDemo: true })
  await assert.rejects(inspectRelease(release.directory), /Demo builds cannot be deployed/)
})

test('Studio identity, ownership and free resources fail closed', () => {
  assert.equal(studioId('student/campus-guide'), 'student/campus-guide')
  for (const id of ['https://evil.test/a', '../project', 'owner/repo?secret', 'a/b/c']) assert.throws(() => studioId(id), /owner\/repo/)
  const studio = { sdk_type: 'docker', visibility: 'public', hardware: 'platform/cpu' }
  const hardware = [{ name: 'platform/cpu', resource_type: 'free' }]
  assert.doesNotThrow(() => assertFreePublicDocker(studio, hardware))
  for (const change of [{ visibility: 'private' }, { sdk_type: 'static' }, { hardware: 'paid/gpu' }]) assert.throws(() => assertFreePublicDocker({ ...studio, ...change }, hardware))
  assert.throws(() => assertFreePublicDocker(studio, [{ name: 'platform/cpu' }]), /Unknown resource/)
  assert.throws(() => assertFreePublicDocker(studio, [{ name: 'platform/cpu', resource_type: 'paid' }]), /free resources/)
  assert.throws(() => assertFreePublicDocker(studio, { schema_changed: hardware }), /free resources/)
  assert.doesNotThrow(() => assertManagedRemote([], ''))
  assert.throws(() => assertManagedRemote(['README.md'], 'different project'), /another project/)
  assert.doesNotThrow(() => assertManagedRemote(['README.md', '.gitattributes', 'dist/index.html'], `<!-- ${RELEASE_MARKER} -->\n${REPO}`))
  assert.throws(() => assertManagedRemote(['README.md', 'private.txt'], `<!-- ${RELEASE_MARKER} -->\n${REPO}`), /Unexpected/)
  assert.doesNotThrow(() => assertManagedRemote(['README.md', '.gitattributes'], 'new Studio template', { parent: SHA, bootstrapCommit: SHA }))
  assert.throws(() => assertManagedRemote(['README.md'], 'another project', { parent: 'b'.repeat(40), bootstrapCommit: SHA }), /another project/)
  assert.throws(() => assertManagedRemote(['README.md', 'app.py'], 'another project', { parent: SHA, bootstrapCommit: SHA }), /another project/)
})

test('API disallows redirects, has no retries, and never leaks server bodies or token in errors', async () => {
  const token = 'private-token-for-testing'
  let calls = 0
  await assert.rejects(studioRequest('/studios/a/b/deploy', { token, method: 'POST', fetchImpl: async (url, init) => {
    calls++
    assert.equal(url, 'https://modelscope.cn/openapi/v1/studios/a/b/deploy')
    assert.equal(init.redirect, 'error')
    assert.equal(init.headers.Authorization, `Bearer ${token}`)
    throw new Error(`redirect included ${token}`)
  } }), (error) => !error.message.includes(token) && error.message.includes('redirected'))
  assert.equal(calls, 1)
  await assert.rejects(studioRequest('/studios/a/b', { token, fetchImpl: async () => new Response(`private ${token}`, { status: 403 }) }), (error) => error.message.includes('403') && !error.message.includes(token))
})

test('deployment uses credential-free remote, env askpass, parent history and normal push before POST', async (t) => {
  const options = await fixture(t)
  await prepareRelease(options)
  const token = 'private-token-for-testing'
  const calls = []
  let askpassPath
  const git = (args, { env, input }) => {
    calls.push(args)
    assert.equal(JSON.stringify(args).includes(token), false)
    assert.equal(env.MODELSCOPE_TOKEN, token)
    askpassPath = env.GIT_ASKPASS
    if (args[0] === 'ls-remote') return `${'b'.repeat(40)}\trefs/heads/master`
    if (args[0] === 'rev-parse') return 'b'.repeat(40)
    if (args[0] === 'ls-tree' && args.includes('--name-only')) return 'README.md\0.gitattributes\0dist/index.html\0'
    if (args[0] === 'ls-tree') return `100644 blob ${'c'.repeat(40)}\t.gitattributes`
    if (args[0] === 'show') return `<!-- ${RELEASE_MARKER} -->\n${REPO}`
    if (args[0] === 'write-tree') return 'd'.repeat(40)
    if (args[0] === 'commit-tree') { assert.match(input, new RegExp(SHA)); assert.deepEqual(args.slice(-2), ['-p', 'b'.repeat(40)]); return 'e'.repeat(40) }
    return ''
  }
  const requests = []
  const fetchImpl = async (url, init) => {
    requests.push([url, init.method])
    if (init.method === 'POST') {
      assert.equal(calls.at(-1)[0], 'push')
      assert.equal((await readFile(askpassPath, 'utf8')).includes(token), false)
      assert.match(await readFile(askpassPath, 'utf8'), /MODELSCOPE_TOKEN/)
    }
    const data = url.includes('/hardware?') ? [{ name: 'platform/cpu', resource_type: 'free' }] : { sdk_type: 'docker', visibility: 'public', hardware: 'platform/cpu' }
    return Response.json({ success: true, data })
  }
  const result = await deployRelease({ rootDir: options.rootDir, env: { ...CONFIG, MODELSCOPE_TOKEN: token, MODELSCOPE_STUDIO: 'student/campus-guide' }, fetchImpl, git })
  assert.equal(result.status, 'deployment-requested')
  assert.equal(requests.filter(([, method]) => method === 'POST').length, 1)
  assert.deepEqual(calls.find(([command]) => command === 'remote'), ['remote', 'add', 'origin', 'https://modelscope.cn/studios/student/campus-guide.git'])
  assert.deepEqual(calls.find(([command]) => command === 'push'), ['push', '--quiet', 'origin', `${'e'.repeat(40)}:refs/heads/master`])
  assert.equal(calls.flat().some((arg) => arg.includes('--force')), false)
  assert.equal(calls.some(([command]) => command === 'checkout'), false)
  assert.ok(calls.some(([command]) => command === 'update-index'))
  await assert.rejects(readFile(askpassPath), { code: 'ENOENT' })
})
