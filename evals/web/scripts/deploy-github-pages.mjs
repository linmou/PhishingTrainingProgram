#!/usr/bin/env node
// Deploy evals/public-dist to a public GitHub repo so Pages can host it stably.
// Default target: linmou/phishing-tutor-eval (public). Override with EVAL_PUBLIC_REPO.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../public-dist');
const REPO = process.env.EVAL_PUBLIC_REPO || 'linmou/phishing-tutor-eval';
const BRANCH = process.env.EVAL_PUBLIC_BRANCH || 'gh-pages';

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim();
    throw new Error(`${cmd} ${args.join(' ')} failed: ${err}`);
  }
  return (result.stdout || '').trim();
}

function gh(args, opts = {}) {
  return run('gh', args, opts);
}

function main() {
  if (!existsSync(path.join(DIST, 'eval/index.html'))) {
    throw new Error(`Missing built site at ${DIST}. Run: npm run build:public`);
  }
  if (!existsSync(path.join(DIST, 'promptfoo/results/latest.json'))) {
    throw new Error(`Missing results in ${DIST}/promptfoo/results/latest.json`);
  }

  // Ensure public repo exists
  const view = spawnSync('gh', ['repo', 'view', REPO, '--json', 'name,visibility,url'], { encoding: 'utf8' });
  if (view.status !== 0) {
    console.log(`Creating public repo ${REPO}…`);
    gh([
      'repo', 'create', REPO,
      '--public',
      '--description', 'Public Promptfoo eval results viewer for phishing tutor prompts',
      '--confirm',
    ]);
  } else {
    const info = JSON.parse(view.stdout);
    if (String(info.visibility).toLowerCase() !== 'public') {
      console.log(`Making ${REPO} public…`);
      gh(['repo', 'edit', REPO, '--visibility', 'public', '--accept-visibility-change-consequences']);
    }
  }

  const work = mkdtempSync(path.join(tmpdir(), 'eval-public-'));
  try {
    run('git', ['init'], { cwd: work });
    run('git', ['checkout', '-b', BRANCH], { cwd: work });
    cpSync(DIST, work, { recursive: true });
    // Ensure nojekyll
    writeFileSync(path.join(work, '.nojekyll'), '');
    run('git', ['add', '-A'], { cwd: work });
    const status = run('git', ['status', '--porcelain'], { cwd: work });
    if (!status) {
      console.log('No changes to deploy.');
    } else {
      run('git', ['-c', 'user.email=eval-bot@users.noreply.github.com', '-c', 'user.name=eval-public-deploy', 'commit', '-m', 'Deploy promptfoo eval viewer'], { cwd: work });
    }
    run('git', ['remote', 'add', 'origin', `https://github.com/${REPO}.git`], { cwd: work });
    run('git', ['push', '-f', 'origin', BRANCH], { cwd: work });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  // Enable GitHub Pages from gh-pages branch root
  const pagesGet = spawnSync('gh', ['api', `repos/${REPO}/pages`], { encoding: 'utf8' });
  if (pagesGet.status !== 0) {
    console.log('Enabling GitHub Pages…');
    const create = spawnSync('gh', [
      'api', `repos/${REPO}/pages`,
      '-X', 'POST',
      '-f', 'build_type=legacy',
      '-f', 'source[branch]=gh-pages',
      '-f', 'source[path]=/',
    ], { encoding: 'utf8' });
    if (create.status !== 0) {
      // fallback older API shape
      const create2 = spawnSync('gh', [
        'api', `repos/${REPO}/pages`,
        '-X', 'POST',
        '--input', '-',
      ], {
        encoding: 'utf8',
        input: JSON.stringify({ source: { branch: BRANCH, path: '/' } }),
      });
      if (create2.status !== 0) {
        console.warn('Pages enable warning:', create.stderr || create2.stderr || create.stdout || create2.stdout);
      }
    }
  } else {
    // keep source on gh-pages
    spawnSync('gh', [
      'api', `repos/${REPO}/pages`,
      '-X', 'PUT',
      '--input', '-',
    ], {
      encoding: 'utf8',
      input: JSON.stringify({ source: { branch: BRANCH, path: '/' }, build_type: 'legacy' }),
    });
  }

  const pages = spawnSync('gh', ['api', `repos/${REPO}/pages`], { encoding: 'utf8' });
  let htmlUrl = `https://${REPO.split('/')[0]}.github.io/${REPO.split('/')[1]}/`;
  if (pages.status === 0) {
    try {
      const data = JSON.parse(pages.stdout);
      if (data.html_url) htmlUrl = data.html_url.endsWith('/') ? data.html_url : `${data.html_url}/`;
    } catch {
      // keep default
    }
  }

  const evalUrl = `${htmlUrl}eval/`;
  console.log('');
  console.log('Public site deployed.');
  console.log(`  repo:  https://github.com/${REPO}`);
  console.log(`  home:  ${htmlUrl}`);
  console.log(`  eval:  ${evalUrl}`);
  console.log('');
  console.log('GitHub Pages can take 1–2 minutes after first enable.');
  writeFileSync(path.join(DIST, 'DEPLOYED_URL.txt'), `${evalUrl}\n`, 'utf8');
}

main();
