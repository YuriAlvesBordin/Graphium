import http from 'http';
import fs from 'fs';
import path from 'path';

const port = 8123;
const publicDir = path.resolve('.');
const framesDir = path.join(publicDir, 'scripts', 'media', 'frames');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
};

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/frame')) {
    const url = new URL(req.url, 'http://localhost');
    const scene = url.searchParams.get('scene')?.replace(/[^a-z0-9-]/gi, '') || 'scene';
    const index = String(parseInt(url.searchParams.get('i') || '0', 10)).padStart(4, '0');
    const dir = path.join(framesDir, scene);
    fs.mkdirSync(dir, { recursive: true });
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      fs.writeFileSync(path.join(dir, `${index}.png`), Buffer.concat(chunks));
      res.writeHead(204).end();
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/done') {
    fs.writeFileSync(path.join(framesDir, 'DONE'), String(Date.now()));
    res.writeHead(204).end();
    return;
  }
  const filePath = path.join(publicDir, decodeURIComponent(req.url === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, () => console.log(`capture server on http://localhost:${port}`));
