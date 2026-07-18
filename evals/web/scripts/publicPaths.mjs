// Responsible for: mapping public URL paths to local eval artifact directories.
// Purpose: serve the viewer at /eval and results at /promptfoo for Cloudflare/public access.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const WEB_ROOT = path.resolve(__dirname, '..');
export const EVALS_ROOT = path.resolve(WEB_ROOT, '..');
export const PROMPTFOO_ROOT = path.resolve(EVALS_ROOT, 'promptfoo');

/**
 * Map a request pathname to a filesystem path, or null if not allowed.
 * Public layout:
 *   /eval/*      -> evals/web/*
 *   /promptfoo/* -> evals/promptfoo/*
 *   /            -> redirect hint (handled by server)
 */
export function resolvePublicPath(pathname) {
  const raw = decodeURIComponent(String(pathname || '/').split('?')[0]);
  const clean = path.posix.normalize(raw).replace(/\\/g, '/');
  if (clean.includes('\0') || clean.includes('..')) return null;

  if (clean === '/eval' || clean === '/eval/') {
    return { type: 'file', filePath: path.join(WEB_ROOT, 'index.html') };
  }
  if (clean.startsWith('/eval/')) {
    const rel = clean.slice('/eval/'.length);
    if (!rel || rel.endsWith('/')) {
      return { type: 'file', filePath: path.join(WEB_ROOT, rel, 'index.html') };
    }
    return { type: 'file', filePath: path.join(WEB_ROOT, rel) };
  }

  if (clean === '/promptfoo' || clean === '/promptfoo/') {
    return { type: 'file', filePath: path.join(PROMPTFOO_ROOT, 'README.md') };
  }
  if (clean.startsWith('/promptfoo/')) {
    const rel = clean.slice('/promptfoo/'.length);
    if (!rel || rel.endsWith('/')) {
      return { type: 'file', filePath: path.join(PROMPTFOO_ROOT, rel, 'index.html') };
    }
    return { type: 'file', filePath: path.join(PROMPTFOO_ROOT, rel) };
  }

  if (clean === '/') {
    return { type: 'redirect', location: '/eval/' };
  }

  return null;
}

export function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.yaml': 'text/yaml; charset=utf-8',
    '.yml': 'text/yaml; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
  })[ext] || 'application/octet-stream';
}
