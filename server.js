// Minimal static file server: `npm start`, then open the address it prints.
// If the port is busy (for example an old server is still running), it uses the next free port.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
const handler = async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
};

const start = (port, tries) => {
  const server = http.createServer(handler);
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && tries > 0) start(port + 1, tries - 1);
    else { console.error(`Could not start the server: port ${port} is in use. Try: PORT=9000 npm start`); process.exit(1); }
  });
  server.listen(port, () => console.log(`Aerhelgard is running at http://localhost:${port}`));
};
start(+process.env.PORT || 8080, 20);
