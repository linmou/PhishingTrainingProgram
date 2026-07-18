#!/usr/bin/env node
// Build a static site tree for public hosting (GitHub Pages / any static host).
// Output: evals/public-dist/{index.html,eval/**,promptfoo/**}

import { cp, mkdir, rm, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');
const EVALS_ROOT = path.resolve(WEB_ROOT, '..');
const PROMPTFOO_ROOT = path.join(EVALS_ROOT, 'promptfoo');
const OUT = path.join(EVALS_ROOT, 'public-dist');

async function mustExist(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}

async function main() {
  await mustExist(path.join(WEB_ROOT, 'index.html'), 'viewer index');
  await mustExist(path.join(PROMPTFOO_ROOT, 'results/latest.json'), 'results JSON');

  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, 'eval'), { recursive: true });
  await mkdir(path.join(OUT, 'promptfoo/results'), { recursive: true });

  await cp(path.join(WEB_ROOT, 'index.html'), path.join(OUT, 'eval/index.html'));
  await cp(path.join(WEB_ROOT, 'src'), path.join(OUT, 'eval/src'), { recursive: true });

  await cp(path.join(PROMPTFOO_ROOT, 'results/latest.json'), path.join(OUT, 'promptfoo/results/latest.json'));
  try {
    await cp(path.join(PROMPTFOO_ROOT, 'results/latest.html'), path.join(OUT, 'promptfoo/results/latest.html'));
  } catch {
    // optional
  }
  try {
    await cp(path.join(PROMPTFOO_ROOT, 'README.md'), path.join(OUT, 'promptfoo/README.md'));
  } catch {
    await writeFile(path.join(OUT, 'promptfoo/README.md'), '# Promptfoo artifacts\n', 'utf8');
  }

  await writeFile(path.join(OUT, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=./eval/" />
    <title>Redirecting to eval viewer</title>
    <link rel="canonical" href="./eval/" />
  </head>
  <body>
    <p><a href="./eval/">Open Promptfoo eval viewer</a></p>
  </body>
</html>
`, 'utf8');

  await writeFile(path.join(OUT, '.nojekyll'), '', 'utf8');
  await writeFile(path.join(OUT, 'README.md'), `# Public Promptfoo eval viewer

Static export of the Phishing Training Program prompt evaluation results.

Open **[eval/](./eval/)** for the interactive table (Current vs Improved).

Built from \`evals/web\` + \`evals/promptfoo/results\`.
`, 'utf8');

  console.log(`Built public site at ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
