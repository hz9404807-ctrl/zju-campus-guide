import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStaticServer } from '../deployment/modelscope/server.mjs';

async function fixture(t) {
  const workspace = await mkdtemp(join(tmpdir(), 'campus-static-'));
  const distDir = join(workspace, 'dist');
  await mkdir(join(distDir, 'assets'), { recursive: true });
  await mkdir(join(distDir, 'images'));
  await mkdir(join(distDir, 'sources', '裁剪后'), { recursive: true });
  await mkdir(join(distDir, '.private'));
  await writeFile(join(distDir, 'index.html'), '<!doctype html><title>Campus guide</title>');
  await writeFile(join(distDir, 'assets', 'index-AbC12345.js'), 'console.info("campus")');
  await writeFile(join(distDir, 'assets', 'index-AbC12345.css'), 'body{color:blue}');
  await writeFile(join(distDir, 'images', 'campus.png'), Buffer.from([137, 80, 78, 71]));
  await writeFile(join(distDir, 'sources', '裁剪后', '彩虹人生.jpg'), 'source screenshot');
  await writeFile(join(distDir, '.env.local'), 'SECRET=not-public');
  await writeFile(join(distDir, '.private', 'settings.json'), '{"private":true}');
  await writeFile(join(distDir, 'private.pem'), 'private server source');
  await writeFile(join(workspace, 'outside.txt'), 'outside dist');
  const server = await createStaticServer({ distDir });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(workspace, { recursive: true, force: true });
  });
  const port = server.address().port;
  const get = (path, options = {}) => new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port, path, ...options }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString(),
      }));
    });
    request.on('error', reject);
    request.end();
  });
  return { get, distDir, workspace };
}

test('serves HTML and BrowserRouter deep links, preserving query-independent routing', async (t) => {
  const { get } = await fixture(t);
  for (const path of ['/', '/index.html', '/food?campus=紫金港', '/food/login', '/food/new', '/food/mine', '/food/food-01', '/food/food-01/edit', '/account', '/about', '/guides', '/guides/campus-card?route=online', '/sites/website-01', '/unknown-route']) {
    const result = await get(encodeURI(path), { headers: { Accept: 'text/html,application/xhtml+xml;q=0.9' } });
    assert.equal(result.status, 200, path);
    assert.match(result.body, /Campus guide/);
    assert.match(result.headers['content-type'], /^text\/html/);
    assert.equal(result.headers['cache-control'], 'no-cache');
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
  }
});

test('source-directory app routes refresh correctly without masking screenshot directories or missing resources', async (t) => {
  const { get } = await fixture(t);
  for (const path of ['/sources', '/sources/', '/sources?kind=websites&q=成绩单', '/sources/account-01']) {
    const result = await get(encodeURI(path), { headers: { Accept: 'text/html' } });
    assert.equal(result.status, 200, path);
    assert.match(result.body, /Campus guide/);
    assert.equal(result.headers['cache-control'], 'no-cache');
  }
  const head = await get('/sources', { method: 'HEAD', headers: { Accept: 'text/html' } });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  const screenshot = await get(encodeURI('/sources/裁剪后/彩虹人生.jpg'), { headers: { Accept: 'text/html' } });
  assert.equal(screenshot.status, 200);
  assert.equal(screenshot.body, 'source screenshot');
  assert.equal(screenshot.headers['content-type'], 'image/jpeg');
  for (const path of ['/sources/裁剪后', '/sources/裁剪后/', '/sources/裁剪后/missing.jpg', '/sources/裁剪后/missing', '/sources/missing.png']) {
    const result = await get(encodeURI(path), { headers: { Accept: 'text/html' } });
    assert.equal(result.status, 404, path);
    assert.doesNotMatch(result.body, /Campus guide|source screenshot/);
  }
});

test('serves correct static types and gives immutable cache only to hashed assets', async (t) => {
  const { get } = await fixture(t);
  const script = await get('/assets/index-AbC12345.js');
  assert.equal(script.status, 200);
  assert.equal(script.body, 'console.info("campus")');
  assert.match(script.headers['content-type'], /^text\/javascript/);
  assert.equal(script.headers['cache-control'], 'public, max-age=31536000, immutable');
  const stylesheet = await get('/assets/index-AbC12345.css');
  assert.match(stylesheet.headers['content-type'], /^text\/css/);
  const image = await get('/images/campus.png');
  assert.equal(image.status, 200);
  assert.equal(image.headers['content-type'], 'image/png');
  assert.equal(image.headers['cache-control'], 'public, max-age=0, must-revalidate');
});

test('missing assets, directories, non-HTML requests never receive the SPA shell', async (t) => {
  const { get } = await fixture(t);
  for (const path of ['/assets/missing.js', '/missing.css', '/images/missing.png', '/assets/missing', '/assets', '/assets/', '/images/']) {
    const result = await get(path, { headers: { Accept: 'text/html' } });
    assert.equal(result.status, 404, path);
    assert.doesNotMatch(result.body, /Campus guide/);
  }
  for (const accept of ['application/json', 'text/html;q=0', '*/*']) {
    assert.equal((await get('/unknown-route', { headers: { Accept: accept } })).status, 404);
  }
});

test('blocks traversal, encoded traversal, hidden files and unknown file types', async (t) => {
  const { get } = await fixture(t);
  for (const path of ['/../outside.txt', '/%2e%2e/outside.txt', '/%2e%2e%2foutside.txt', '/foo/../../outside.txt', '/foo%5c..%5coutside.txt', '/C%3A/outside.txt', '/.env.local', '/%2eenv.local', '/.private/settings.json', '/private.pem', '/bad%00.png', '/bad%zz']) {
    const result = await get(path, { headers: { Accept: 'text/html' } });
    assert.equal(result.status, 404, path);
    assert.doesNotMatch(result.body, /SECRET|outside dist|Campus guide|private server/);
  }
});

test('does not follow symlink files or directory junctions even to extensionless routes', async (t) => {
  const { get, distDir, workspace } = await fixture(t);
  await mkdir(join(workspace, 'private'));
  await writeFile(join(workspace, 'private', 'secret.json'), '{"secret":true}');
  // Directory junctions work on Windows without developer-mode symlink privileges.
  await symlink(join(workspace, 'private'), join(distDir, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await get('/linked/secret.json')).status, 404);
  assert.equal((await get('/linked', { headers: { Accept: 'text/html' } })).status, 404);
  if (process.platform !== 'win32') {
    await symlink(join(workspace, 'outside.txt'), join(distDir, 'outside.txt'));
    assert.equal((await get('/outside.txt')).status, 404);
  }
});

test('HEAD omits bodies while retaining lengths; health is uncached; writes are rejected', async (t) => {
  const { get } = await fixture(t);
  const page = await get('/account', { headers: { Accept: 'text/html' } });
  const head = await get('/account', { method: 'HEAD', headers: { Accept: 'text/html' } });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], page.headers['content-length']);
  const health = await get('/healthz');
  assert.equal(health.status, 200);
  assert.equal(health.body, 'ok');
  assert.equal(health.headers['cache-control'], 'no-store');
  assert.equal((await get('/healthz', { method: 'HEAD' })).body, '');
  const post = await get('/food', { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});

test('refuses missing index and symlinked dist roots at startup', async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), 'campus-static-invalid-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await assert.rejects(createStaticServer({ distDir: workspace }), /index\.html/);
  const actual = join(workspace, 'actual');
  await mkdir(actual);
  await writeFile(join(actual, 'index.html'), '<title>test</title>');
  const linked = join(workspace, 'linked');
  await symlink(actual, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(createStaticServer({ distDir: linked }), /real directory/);
});
