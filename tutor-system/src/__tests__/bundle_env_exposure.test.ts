import fs from 'fs';
import path from 'path';

// CRA inlines the entire environment object when source reads a process.env key that is not
// REACT_APP_*, NODE_ENV, PUBLIC_URL or a few CRA built-ins. That leaks every REACT_APP_* value.
const ALLOWED = /^(REACT_APP_\w+|NODE_ENV|PUBLIC_URL|FAST_REFRESH|WDS_SOCKET_\w+)$/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\.|setupTests/.test(entry.name) ? [full] : [];
  });
}

describe('public bundle environment exposure', () => {
  it('application source reads only public process.env names', () => {
    const offenders = sourceFiles(path.join(__dirname, '..')).flatMap(file => {
      const text = fs.readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      const bad: string[] = [];
      for (const match of text.matchAll(/process\.env(?:\.(\w+)|\s*\[|(?![\w.]))/g)) {
        if (!match[1] || !ALLOWED.test(match[1])) bad.push(`${path.relative(process.cwd(), file)}: ${match[0]}`);
      }
      return bad;
    });
    expect(offenders).toEqual([]);
  });
});
