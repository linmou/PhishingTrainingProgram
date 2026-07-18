#!/usr/bin/env node
// Public static server for the Promptfoo eval viewer.
// Mounts:
//   /eval/*      -> evals/web
//   /promptfoo/* -> evals/promptfoo
// Then expose with: cloudflared tunnel --url http://127.0.0.1:4175

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { contentTypeFor, resolvePublicPath, WEB_ROOT, PROMPTFOO_ROOT } from './publicPaths.mjs';

const HOST = process.env.EVAL_PUBLIC_HOST || '127.0.0.1';
const PORT = Number(process.env.EVAL_PUBLIC_PORT || 4175);

function isInside(root, filePath) {
  const resolved = path.resolve(filePath);
  const base = path.resolve(root);
  return resolved === base || resolved.startsWith(base + path.sep);
}

async function sendFile(res, filePath) {
  if (!isInside(WEB_ROOT, filePath) && !isInside(PROMPTFOO_ROOT, filePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': contentTypeFor(filePath),
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Server error');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const mapped = resolvePublicPath(url.pathname);

  if (!mapped) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found. Open /eval/');
    return;
  }

  if (mapped.type === 'redirect') {
    res.writeHead(302, { Location: mapped.location });
    res.end();
    return;
  }

  // Directory-style /eval without trailing slash breaks relative asset URLs.
  if (url.pathname === '/eval') {
    res.writeHead(302, { Location: '/eval/' });
    res.end();
    return;
  }

  await sendFile(res, mapped.filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`Eval public server http://${HOST}:${PORT}/eval/`);
  console.log(`  local web root: ${WEB_ROOT}`);
  console.log(`  promptfoo root: ${PROMPTFOO_ROOT}`);
  console.log('Expose with:');
  console.log(`  cloudflared tunnel --url http://${HOST}:${PORT}`);
});
