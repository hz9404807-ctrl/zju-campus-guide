import { createServer } from 'node:http';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
};

function sendText(request, response, status, message, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(message),
    ...headers,
  });
  response.end(request.method === 'HEAD' ? undefined : message);
}

function requestPath(rawUrl) {
  if (!rawUrl?.startsWith('/') || rawUrl.startsWith('//') || rawUrl.length > 8192) return null;
  let pathname;
  try {
    // Inspect the original path before URL normalization can erase dot segments.
    pathname = decodeURIComponent(rawUrl.split(/[?#]/, 1)[0]);
  } catch {
    return null;
  }
  if (/[\\:\x00-\x1f\x7f]/.test(pathname)) return null;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => segment.startsWith('.') || segment === '..')) return null;
  return { pathname, segments };
}

async function openPublicFile(root, segments) {
  let filePath = root;
  try {
    for (let index = 0; index < segments.length; index += 1) {
      filePath = resolve(filePath, segments[index]);
      const stat = await lstat(filePath);
      if (stat.isSymbolicLink()) return { state: 'blocked' };
      if (index < segments.length - 1 && !stat.isDirectory()) return { state: 'missing' };
      if (index === segments.length - 1 && stat.isDirectory()) return { state: 'directory' };
      if (index === segments.length - 1 && !stat.isFile()) return { state: 'blocked' };
    }
    const file = await open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const stat = await file.stat();
    if (!stat.isFile()) {
      await file.close();
      return { state: 'blocked' };
    }
    return { state: 'file', file, size: stat.size };
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes(error.code)) return { state: 'missing' };
    if (['EACCES', 'EPERM', 'ELOOP'].includes(error.code)) return { state: 'blocked' };
    throw error;
  }
}

function allowsHtml(request) {
  return (request.headers.accept ?? '').split(',').some((entry) => {
    const [type, ...parameters] = entry.trim().toLowerCase().split(';');
    const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
    return type === 'text/html' && (!quality || Number(quality.trim().slice(2)) > 0);
  });
}

function spaFallback(segments, state) {
  if (segments.some((segment) => extname(segment))) return false;
  const [section, id, action] = segments;
  // /sources is an app route as well as the source-screenshot directory.
  // Its screenshot subtree must still behave strictly as static resources.
  if (['assets', 'images', 'icons'].includes(section)) return false;
  if (section === 'sources' && (segments.length > 2 || id === '裁剪后')) return false;
  const knownRoute = segments.length === 0
    || (['guides', 'sources'].includes(section) && segments.length <= 2)
    || (section === 'sites' && segments.length === 2)
    || (section === 'food' && (segments.length <= 2 || (segments.length === 3 && action === 'edit')))
    || (['account', 'about'].includes(section) && segments.length === 1);
  // Only known app routes can take precedence over an actual directory.
  // Other missing extensionless paths reach React's own not-found screen.
  return knownRoute || state === 'missing';
}

/** Serve only a prebuilt dist directory. Tests may supply a temporary fixture root. */
export async function createStaticServer({ distDir = resolve(dirname(fileURLToPath(import.meta.url)), 'dist') } = {}) {
  const rootStat = await lstat(distDir);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('dist must be a real directory');
  const root = await realpath(distDir);
  const initialIndex = await openPublicFile(root, ['index.html']);
  if (initialIndex.state !== 'file') throw new Error('dist/index.html must be a readable regular file');
  await initialIndex.file.close();

  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!['GET', 'HEAD'].includes(request.method)) {
      request.resume();
      sendText(request, response, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
      return;
    }
    const parsed = requestPath(request.url);
    if (!parsed) {
      sendText(request, response, 404, 'Not found');
      return;
    }
    if (parsed.pathname === '/healthz') {
      sendText(request, response, 200, 'ok');
      return;
    }
    try {
      let segments = parsed.segments.length ? parsed.segments : ['index.html'];
      let result = await openPublicFile(root, segments);
      if (['missing', 'directory'].includes(result.state) && allowsHtml(request)
        && spaFallback(parsed.segments, result.state)) {
        segments = ['index.html'];
        result = await openPublicFile(root, segments);
      }
      if (result.state !== 'file') {
        sendText(request, response, 404, 'Not found');
        return;
      }
      const filename = segments.at(-1);
      const contentType = mimeTypes[extname(filename).toLowerCase()];
      if (!contentType) {
        await result.file.close();
        sendText(request, response, 404, 'Not found');
        return;
      }
      const immutable = segments[0] === 'assets' && /-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(filename);
      response.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': result.size,
        'Cache-Control': filename === 'index.html' ? 'no-cache'
          : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
      });
      if (request.method === 'HEAD') {
        await result.file.close();
        response.end();
      } else {
        const stream = result.file.createReadStream();
        stream.on('error', () => response.destroy());
        response.on('close', () => stream.destroy());
        stream.pipe(response);
      }
    } catch {
      if (response.headersSent) response.destroy();
      else sendText(request, response, 500, 'Unable to serve this request');
    }
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = await createStaticServer();
  server.listen(7860, '0.0.0.0', () => console.info('Campus guide listening on port 7860'));
}
