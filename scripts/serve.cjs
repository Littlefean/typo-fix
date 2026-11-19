// Local development file server only. API requests go directly from the browser
// to the configured AI endpoint; this server never receives or forwards keys or correction text.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };
const files = new Set(['index.html', 'styles.css', 'theme.css', 'theme.js', 'app.js', 'core.js', 'api.js', 'favicon.svg', 'vendor/diff.min.js']);
const server = http.createServer((request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!['GET', 'HEAD'].includes(request.method) || !files.has(name)) {
    response.writeHead(404); response.end('Not found'); return;
  }
  response.setHeader('Content-Type', types[path.extname(name)] || 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method === 'HEAD') { response.end(); return; }
  fs.createReadStream(path.join(root, name)).on('error', () => { response.statusCode = 500; response.end('Unable to read file'); }).pipe(response);
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Run with PORT=4174 npm start.` : error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`AI改错别字 · Local: http://127.0.0.1:${port}`));
