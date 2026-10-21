import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { isIP } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const RELEASE_MARKER = 'zju-campus-guide/modelscope-release/v1'
const SOURCE_REPOSITORY = 'https://github.com/hz9404807-ctrl/zju-campus-guide'
const API = 'https://modelscope.cn/openapi/v1'
const EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.txt'])
const MAX_BYTES = 100 * 1024 * 1024
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_FILES = 5000
const hash = (data) => createHash('sha256').update(data).digest('hex')
const json = (data) => `${JSON.stringify(data, null, 2)}\n`

class ReleaseError extends Error {}
function fail(message) { throw new ReleaseError(message) }

export function validatePublicConfig(env, allowDemo = false) {
  for (const key of Object.keys(env)) {
    if (key.startsWith('VITE_') && /SECRET|PASSWORD|TOKEN|SERVICE_ROLE/i.test(key)) fail('Private configuration must never be exposed through VITE_ variables.')
  }
  const url = (env.VITE_SUPABASE_URL ?? '').trim()
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
  if (env.VITE_FOOD_PROFILES_READY && env.VITE_FOOD_PROFILES_READY !== 'false') fail('The five-profile feature must remain disabled.')
  if (env.VITE_FOOD_EMAIL_AUTH_READY && !['true', 'false'].includes(env.VITE_FOOD_EMAIL_AUTH_READY)) fail('Email feature flag must be true or false.')
  if (!url && !key && allowDemo) return { mode: 'demo' }
  if (!url || !key) fail('A real Supabase URL and publishable key are required. No silent demo deployment is allowed.')
  let parsed
  try { parsed = new URL(url) } catch { fail('Invalid public Supabase URL.') }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash || parsed.pathname !== '/' || !parsed.hostname.includes('.') || isIP(parsed.hostname) || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(parsed.hostname)) fail('Supabase URL must be a public HTTPS project origin.')
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key) || /example|placeholder|replace|your[-_]/i.test(key)) fail('Only a real sb_publishable_ client key is accepted; never use a service or secret key.')
  return { mode: 'connected', url, key }
}

function validateRelativeFile(relative) {
  if (relative.includes('\\') || relative.startsWith('/') || relative.split('/').some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) fail('Hidden or unsafe release path rejected.')
  if (relative.startsWith('dist/')) {
    if (!EXTENSIONS.has(path.posix.extname(relative).toLowerCase()) || /(?:^|\/)(?:node_modules|scratch|credentials?|secrets?|sessions?)(?:\/|\.)/i.test(relative)) fail('Unexpected or private build file rejected.')
    return
  }
  if (!['Dockerfile', 'server.mjs', 'README.md', 'version.json'].includes(relative)) fail('Unexpected release file rejected.')
}

async function listFiles(directory, prefix = '') {
  const info = await lstat(directory)
  if (info.isSymbolicLink() || !info.isDirectory()) fail('Release directories must be real directories, not links.')
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name
    const full = path.join(directory, entry.name)
    const stat = await lstat(full)
    if (stat.isSymbolicLink()) fail('Symbolic links are forbidden in release files.')
    if (stat.isDirectory()) result.push(...await listFiles(full, name))
    else if (stat.isFile()) {
      if (stat.size > MAX_FILE_BYTES) fail('Release file exceeds the size limit.')
      result.push(name)
    } else fail('Only regular files are allowed in a release.')
    if (result.length > MAX_FILES) fail('Release contains too many files.')
  }
  return result.sort()
}

function scanContent(data, relative, env) {
  const text = data.toString('utf8')
  if (/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]+|(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(text)) fail('Potential credential found in release content; publication stopped.')
  for (const name of ['MODELSCOPE_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'SMTP_PASSWORD', 'SMTP_PASS']) {
    if (env[name]?.length >= 8 && text.includes(env[name])) fail('Private environment value found in release content; publication stopped.')
  }
  if (path.posix.extname(relative) === '.html' && /sourceMappingURL=.*\.map/.test(text)) fail('Source maps are not part of the public release.')
}

function runGit(args, { cwd, env = process.env, input } = {}) {
  const result = spawnSync('git', ['-c', 'credential.helper=', '-c', 'core.hooksPath=/dev/null', '-c', 'http.followRedirects=false', ...args], {
    cwd, env, input, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024,
  })
  if (result.status !== 0 || result.error) fail('Git operation failed. Check repository permissions or concurrent updates; no force push was attempted.')
  return result.stdout.trimEnd()
}

export async function prepareRelease({ rootDir = process.cwd(), env = process.env, allowDemo = false, sourceCommit } = {}) {
  rootDir = path.resolve(rootDir)
  const config = validatePublicConfig(env, allowDemo)
  const commit = sourceCommit ?? runGit(['rev-parse', 'HEAD'], { cwd: rootDir })
  if (!/^[a-f0-9]{40}$/.test(commit)) fail('A full source commit SHA is required.')
  if (env.GITHUB_SHA && env.GITHUB_SHA !== commit) fail('Source checkout does not match the workflow commit.')
  const files = []
  let bytes = 0
  for (const relative of await listFiles(path.join(rootDir, 'dist'), 'dist')) {
    validateRelativeFile(relative)
    const data = await readFile(path.join(rootDir, relative))
    scanContent(data, relative, env)
    bytes += data.length
    if (bytes > MAX_BYTES) fail('Release exceeds the total size limit.')
    files.push({ relative, data })
  }
  if (!files.some((file) => file.relative === 'dist/index.html')) fail('Build dist/index.html before preparing a release.')
  if (files.some((file) => file.relative === 'dist/release.json')) fail('dist/release.json is reserved for generated release provenance.')
  if (config.mode === 'connected') {
    const code = files.filter((file) => /\.(?:html|js|json)$/.test(file.relative)).map((file) => file.data.toString('utf8')).join('\n')
    if (!code.includes(config.url) || !code.includes(config.key)) fail('The built website does not contain the selected public configuration. Rebuild it with the same environment.')
  }
  for (const directory of [path.join(rootDir, 'deployment'), path.join(rootDir, 'deployment', 'modelscope')]) {
    const stat = await lstat(directory)
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail('Deployment directories must not be links.')
  }
  for (const filename of ['Dockerfile', 'server.mjs']) {
    const file = path.join(rootDir, 'deployment', 'modelscope', filename)
    const stat = await lstat(file)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE_BYTES) fail('Invalid deployment runtime file.')
    const data = await readFile(file)
    scanContent(data, filename, env)
    files.push({ relative: filename, data })
  }
  files.push({ relative: 'dist/release.json', data: Buffer.from(json({ sourceRepository: SOURCE_REPOSITORY, sourceCommit: commit, mode: config.mode })) })
  const readme = `---\ntitle: 浙大校园指南\nsdk: docker\napp_port: 7860\n---\n\n<!-- ${RELEASE_MARKER} -->\n\nBuild-only mirror of [${SOURCE_REPOSITORY}](${SOURCE_REPOSITORY}).\n\nSource commit: ${commit}\n\nConfiguration: ${config.mode}.\n\nManaged by the repository release workflow. Review changes on GitHub; do not edit this mirror.\n`
  files.push({ relative: 'README.md', data: Buffer.from(readme) })
  const version = { release: RELEASE_MARKER, repository: SOURCE_REPOSITORY, commit, mode: config.mode, files: Object.fromEntries(files.map(({ relative, data }) => [relative, hash(data)])) }
  files.push({ relative: 'version.json', data: Buffer.from(json(version)) })
  const outputs = path.join(rootDir, 'outputs')
  await mkdir(outputs, { recursive: true })
  if ((await lstat(outputs)).isSymbolicLink()) fail('The outputs directory must not be a link.')
  const target = path.join(outputs, 'modelscope-release')
  const staging = await mkdtemp(path.join(outputs, '.modelscope-release-'))
  try {
    for (const { relative, data } of files) {
      await mkdir(path.dirname(path.join(staging, relative)), { recursive: true })
      await writeFile(path.join(staging, relative), data, { flag: 'wx' })
    }
    try {
      await inspectRelease(target, { allowDemo: true, env })
      await rm(target, { recursive: true })
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await rename(staging, target)
  } finally { await rm(staging, { recursive: true, force: true }) }
  return { directory: target, commit, mode: config.mode, fileCount: files.length }
}

export async function inspectRelease(directory, { allowDemo = false, env = process.env } = {}) {
  const files = await listFiles(directory)
  for (const relative of files) validateRelativeFile(relative)
  const version = JSON.parse(await readFile(path.join(directory, 'version.json'), 'utf8'))
  if (version.release !== RELEASE_MARKER || version.repository !== SOURCE_REPOSITORY || !/^[a-f0-9]{40}$/.test(version.commit)) fail('This is not a managed campus-guide release.')
  if (version.mode !== 'connected' && !(allowDemo && version.mode === 'demo')) fail('Demo builds cannot be deployed. Configure the real public service and rebuild.')
  if (!version.files || typeof version.files !== 'object' || Array.isArray(version.files)) fail('Release manifest is missing.')
  if (files.filter((file) => file !== 'version.json').join('\n') !== Object.keys(version.files).sort().join('\n')) fail('Release file list has changed since preparation.')
  let bytes = 0
  for (const relative of files) {
    const data = await readFile(path.join(directory, relative))
    bytes += data.length
    if (bytes > MAX_BYTES) fail('Release exceeds the total size limit.')
    scanContent(data, relative, env)
    if (relative !== 'version.json' && hash(data) !== version.files[relative]) fail('Release content has changed since preparation; rebuild before deployment.')
  }
  if (!(await readFile(path.join(directory, 'README.md'), 'utf8')).includes(RELEASE_MARKER)) fail('Release ownership marker is missing.')
  for (const required of ['dist/index.html', 'Dockerfile', 'server.mjs', 'README.md']) if (!files.includes(required)) fail('Required release file is missing.')
  return version
}

export function studioId(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}\/[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value ?? '')) fail('MODELSCOPE_STUDIO must be owner/repo.')
  return value
}

export function assertFreePublicDocker(studio, hardwareResponse) {
  if (studio?.sdk_type !== 'docker' || studio?.visibility !== 'public') fail('Deployment requires an existing public Docker Studio; settings are never changed automatically.')
  const hardware = typeof studio.hardware === 'string' ? studio.hardware : studio.hardware?.name
  const options = Array.isArray(hardwareResponse) ? hardwareResponse : hardwareResponse?.items ?? hardwareResponse?.hardware
  const selected = Array.isArray(options) ? options.find((item) => item.name === hardware) : null
  if (!hardware || !selected || hardware.startsWith('paid/') || selected.resource_type === 'paid' || studio.hardware?.resource_type === 'paid') fail('Cannot confirm that the existing Studio uses free resources; deployment stopped.')
  // The documented platform/* namespace is the platform quota, as opposed to paid/*.
  if (!hardware.startsWith('platform/') || !['free', 'platform'].includes(selected.resource_type)) fail('Unknown resource billing category; deployment stopped. Verify the current API fields manually.')
  if (selected.available === false || selected.available_quota === 0) fail('Free resource quota is unavailable; no paid fallback will be selected.')
}

export async function studioRequest(endpoint, { token, method = 'GET', fetchImpl = fetch } = {}) {
  if (!token || /[\r\n]/.test(token)) fail('Set MODELSCOPE_TOKEN privately before deployment.')
  let response
  try {
    response = await fetchImpl(`${API}${endpoint}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(30000) })
  } catch { fail('ModelScope request failed or redirected. Credentials were not forwarded; check the platform directly.') }
  if (!response.ok) fail(`ModelScope ${method} request failed (HTTP ${response.status}). No settings were changed.`)
  const text = await response.text()
  if (text.length > 1024 * 1024) fail('ModelScope response exceeds the size limit.')
  let body
  try { body = JSON.parse(text) } catch { fail('ModelScope returned an unexpected response.') }
  if (body.success !== true) fail('ModelScope did not confirm success. Check the Studio page; the request will not be retried automatically.')
  return body.data
}

export function assertManagedRemote(paths, readme, { parent, bootstrapCommit } = {}) {
  if (!paths.length) return
  if (bootstrapCommit && parent === bootstrapCommit && paths.every((filename) => ['README.md', '.gitattributes'].includes(filename))) return
  if (!readme?.includes(`<!-- ${RELEASE_MARKER} -->`) || !readme.includes(SOURCE_REPOSITORY)) fail('Existing Studio is not a managed campus-guide mirror. Refusing to overwrite another project.')
  for (const filename of paths) if (filename !== '.gitattributes') validateRelativeFile(filename)
}

export async function deployRelease({ rootDir = process.cwd(), env = process.env, fetchImpl = fetch, git = runGit } = {}) {
  const id = studioId(env.MODELSCOPE_STUDIO)
  const token = env.MODELSCOPE_TOKEN
  if (!token || /[\r\n]/.test(token)) fail('Set MODELSCOPE_TOKEN as a private secret; do not put it in a command or file.')
  const bootstrapCommit = env.MODELSCOPE_BOOTSTRAP_COMMIT?.trim() || undefined
  if (bootstrapCommit && !/^[a-f0-9]{40}$/.test(bootstrapCommit)) fail('MODELSCOPE_BOOTSTRAP_COMMIT must be an explicitly reviewed full initial Studio commit SHA.')
  const releaseDir = path.join(path.resolve(rootDir), 'outputs', 'modelscope-release')
  const version = await inspectRelease(releaseDir, { env })
  const request = (endpoint, options = {}) => studioRequest(endpoint, { token, fetchImpl, ...options })
  const studio = await request(`/studios/${id}`)
  const hardware = await request(`/studios/hardware?sdk_type=docker&studio=${encodeURIComponent(id)}`)
  assertFreePublicDocker(studio, hardware)
  const temporary = await mkdtemp(path.join(tmpdir(), 'campus-modelscope-'))
  try {
    const askpass = path.join(temporary, 'askpass.sh')
    // The script contains only an environment lookup, never the token itself.
    await writeFile(askpass, '#!/bin/sh\ncase "$1" in\n  *[Uu]sername*) printf "%s\\n" "oauth2" ;;\n  *[Pp]assword*) printf "%s\\n" "$MODELSCOPE_TOKEN" ;;\n  *) exit 1 ;;\nesac\n', { mode: 0o700 })
    const gitEnv = { ...env, GIT_ASKPASS: askpass, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_AUTHOR_NAME: 'Campus guide release', GIT_AUTHOR_EMAIL: 'release@users.noreply.github.com', GIT_COMMITTER_NAME: 'Campus guide release', GIT_COMMITTER_EMAIL: 'release@users.noreply.github.com' }
    const working = path.join(temporary, 'repo')
    await mkdir(working)
    const command = (args, input) => git(args, { cwd: working, env: gitEnv, input })
    command(['init', '--quiet'])
    command(['remote', 'add', 'origin', `https://modelscope.cn/studios/${id}.git`])
    const heads = command(['ls-remote', '--heads', 'origin'])
    if (heads && heads.split('\n').some((line) => !line.endsWith('\trefs/heads/master'))) fail('Unexpected remote branches; refusing to replace another project.')
    let parent
    let attributes
    if (heads) {
      command(['fetch', '--quiet', '--no-tags', 'origin', 'master'])
      parent = command(['rev-parse', 'refs/remotes/origin/master'])
      const tree = command(['ls-tree', '-r', '-z', '--name-only', parent]).split('\0').filter(Boolean)
      assertManagedRemote(tree, tree.includes('README.md') ? command(['show', `${parent}:README.md`]) : '', { parent, bootstrapCommit })
      if (tree.includes('.gitattributes')) attributes = command(['ls-tree', parent, '.gitattributes']).match(/^(100644|100755) blob ([a-f0-9]{40})\t\.gitattributes$/)
      if (tree.includes('.gitattributes') && !attributes) fail('Unexpected .gitattributes entry.')
    }
    // Build a new index without checking out remote content or running its filters/hooks.
    command(['read-tree', '--empty'])
    for (const filename of await listFiles(releaseDir)) {
      const data = await readFile(path.join(releaseDir, filename))
      await mkdir(path.dirname(path.join(working, filename)), { recursive: true })
      await writeFile(path.join(working, filename), data, { flag: 'wx' })
    }
    command(['add', '--', 'dist', 'Dockerfile', 'server.mjs', 'README.md', 'version.json'])
    if (attributes) command(['update-index', '--add', '--cacheinfo', attributes[1], attributes[2], '.gitattributes'])
    const tree = command(['write-tree'])
    const commit = command(['commit-tree', tree, ...(parent ? ['-p', parent] : [])], `Deploy campus guide ${version.commit}\n`)
    if (!/^[a-f0-9]{40}$/.test(commit)) fail('Unexpected Git commit result.')
    // Server-side fast-forward protection also handles a concurrent publisher.
    command(['push', '--quiet', 'origin', `${commit}:refs/heads/master`])
    await request(`/studios/${id}/deploy`, { method: 'POST' })
    return { studio: id, sourceCommit: version.commit, studioCommit: commit, url: `https://modelscope.cn/studios/${id}`, status: 'deployment-requested' }
  } finally { await rm(temporary, { recursive: true, force: true }) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...options] = process.argv.slice(2)
    if (options.some((option) => option !== '--allow-demo') || (options.length && command !== 'prepare')) fail('Usage: node scripts/modelscope-release.mjs prepare [--allow-demo] | deploy')
    if (command === 'prepare') {
      const result = await prepareRelease({ allowDemo: options.includes('--allow-demo') })
      console.log(`Prepared ${result.fileCount} files for source ${result.commit} (${result.mode}).`)
    } else if (command === 'deploy') {
      const result = await deployRelease()
      console.log(`Deployment requested for ${result.studio}, source ${result.sourceCommit}. Check build/run status: ${result.url}`)
    } else fail('Usage: node scripts/modelscope-release.mjs prepare [--allow-demo] | deploy')
  } catch (error) {
    // Deliberately suppress filesystem paths, child stderr, server bodies and credentials.
    console.error(error instanceof ReleaseError ? error.message : 'Release processing failed. Check the local build, manifest and file permissions.')
    process.exitCode = 1
  }
}
