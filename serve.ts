// Neon Harbor 3D — serve.ts
// Tiny static dev server on port 8080 serving game/ (and the repo root for
// screenshots). Node 22, standard library only. No dependencies.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(join(fileURLToPath(new URL('.', import.meta.url))));
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    let rel = decodeURIComponent(url.pathname);
    // The game page lives at /game/index.html; relative module paths in it
    // resolve against the page URL, so / must redirect to /game/ (keeping
    // the ?shot= query) instead of serving the file at /.
    if (rel === '/') {
      res.writeHead(302, { location: '/game/' + url.search });
      res.end();
      return;
    }
    if (rel.endsWith('/')) rel += 'index.html';
    const safe = normalize(join(ROOT, rel));
    if (!safe.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const data = await readFile(safe);
    const type = MIME[extname(safe).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`Neon Harbor dev server: http://localhost:${PORT}/`);
});
