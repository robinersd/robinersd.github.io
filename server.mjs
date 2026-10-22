import http from 'node:http';
import { networkInterfaces } from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import robinerChat from './site/api/chat.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site');
const routes = new Set([
  '/',
  '/projects',
  '/experience',
  '/highlights',
  '/certifications',
  '/tech-stack',
  '/contact',
  '/gallery',
  '/resume',
]);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (request, response) => {
  response.status = (code) => {
    response.statusCode = code;
    return response;
  };
  response.json = (value) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(value));
  };
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname === '/api/chat') {
      if (request.method === 'POST') {
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 3 * 1024 * 1024)
            return response.status(413).json({
              error: 'Attachments are too large. Send a smaller photo or a shorter voice note.',
            });
          chunks.push(chunk);
        }
        try {
          request.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          return response.status(400).json({ error: 'Please send a valid message.' });
        }
      }
      return await robinerChat(request, response);
    }
    if (!['GET', 'HEAD'].includes(request.method))
      return response.status(405).json({ error: 'Method not allowed.' });
    const filename = routes.has(pathname.replace(/\/$/, '') || '/')
      ? 'index.html'
      : pathname.replace(/^\/+/, '');
    const resolved = path.resolve(root, filename);
    if (!resolved.startsWith(root + path.sep))
      return response.status(403).json({ error: 'Forbidden.' });
    const publicFile =
      ['index.html', 'site.webmanifest'].includes(filename) || filename.startsWith('assets/');
    if (!publicFile || filename.split(/[\\/]/).some((part) => part.startsWith('.')))
      return response.status(404).json({ error: 'Not found.' });
    const content = await fs.readFile(resolved);
    response.setHeader('Content-Type', types[path.extname(resolved)] || 'application/octet-stream');
    const isImage = ['.svg', '.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(resolved));
    response.setHeader('Cache-Control', isImage ? 'public, max-age=3600' : 'no-cache');
    const etag = `"${createHash('sha256').update(content).digest('hex').slice(0, 24)}"`;
    response.setHeader('ETag', etag);
    if (request.headers['if-none-match'] === etag) {
      response.statusCode = 304;
      return response.end();
    }
    if (path.extname(resolved) === '.mp4') {
      response.setHeader('Accept-Ranges', 'bytes');
      const range = request.headers.range;
      if (range && (!request.headers['if-range'] || request.headers['if-range'] === etag)) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        const total = content.length;
        let start = 0, end = total - 1;
        if (!match || (!match[1] && !match[2])) start = -1;
        else if (!match[1]) {
          const suffix = Number(match[2]);
          start = suffix > 0 ? Math.max(0, total - suffix) : -1;
        } else {
          start = Number(match[1]);
          if (match[2]) end = Math.min(end, Number(match[2]));
        }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= total || end < start) {
          response.statusCode = 416;
          response.setHeader('Content-Range', `bytes */${total}`);
          return response.end();
        }
        response.statusCode = 206;
        response.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        response.setHeader('Content-Length', end - start + 1);
        return response.end(request.method === 'HEAD' ? undefined : content.subarray(start, end + 1));
      }
      response.setHeader('Content-Length', content.length);
    }
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    response.status(error.code === 'ENOENT' ? 404 : 400).json({ error: 'Page unavailable.' });
  }
});
// Use the next available local port instead of crashing when another preview is open.
const requestedPort = process.env.PORT?.trim() ? Number(process.env.PORT) : 8081;
if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
  console.error('PORT must be a whole number from 0 to 65535. Leave it unset to use 8081.');
  process.exit(1);
}
let candidatePort = requestedPort;
const lastPort = Math.min(requestedPort + 9, 65535);
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE' && candidatePort > 0 && candidatePort < lastPort) {
    console.warn(`Port ${candidatePort} is already in use. Trying ${candidatePort + 1}...`);
    candidatePort += 1;
    server.listen(candidatePort, '0.0.0.0');
    return;
  }
  console.error(
    error.code === 'EADDRINUSE'
      ? 'No free preview port was found. Stop an older npm run dev terminal or choose another PORT.'
      : `Cannot start the portfolio server (${error.code || 'unknown error'}).`,
  );
  process.exitCode = 1;
});
server.on('listening', () => {
  const port = server.address().port;
  console.log(`Robiner portfolio: http://127.0.0.1:${port} (Ctrl+C to stop)`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        console.log(`Phone / LAN: http://${address.address}:${port}`);
      }
    }
  }
});
server.listen(candidatePort, '0.0.0.0');
