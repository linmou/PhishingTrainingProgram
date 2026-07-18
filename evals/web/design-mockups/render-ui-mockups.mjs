#!/usr/bin/env node
// Purpose: render static UX mock websites for the eval review workspace page model.

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const htmlDir = path.join(__dirname, 'html');
const projectRoot = path.resolve(__dirname, '../../..');

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') {
      throw error;
    }
    const siblingPlaywright = path.join(projectRoot, 'tutor-system/node_modules/playwright/index.mjs');
    return (await import(siblingPlaywright)).chromium;
  }
}

function findCachedChromiumExecutable() {
  const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(systemChrome)) {
    return systemChrome;
  }

  const cacheRoot = path.join(process.env.HOME ?? '', 'Library/Caches/ms-playwright');
  if (!existsSync(cacheRoot)) {
    return null;
  }

  const candidates = readdirSync(cacheRoot)
    .filter((entry) => entry.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse()
    .map((entry) => path.join(cacheRoot, entry, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'))
    .filter((entryPath) => existsSync(entryPath));

  return candidates[0] ?? null;
}

const navItems = [
  ['00-new-eval-run.png', 'New Run'],
  ['01-evaluation-lineage.png', 'Lineage'],
  ['02-run-detail.png', 'Run Detail'],
  ['03-diagnosis-notebook.png', 'Diagnosis'],
  ['04-prompt-versions.png', 'Prompt Versions'],
  ['06-ab-changed-case-inspector.png', 'A/B Cases'],
  ['08-dataset-distribution.png', 'Dataset Distribution'],
  ['09-rubric-inspect.png', 'Rubric Inspect'],
  ['10-provenance-export-authority.png', 'Export'],
];

const esc = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function metric(label, value, note, tone = 'info') {
  return `<article class="metric ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><em>${esc(note)}</em></article>`;
}


function panel(title, content, extraClass = '') {
  return `<section class="panel ${extraClass}"><div class="panel-title">${esc(title)}</div>${content}</section>`;
}

function pill(label, tone = 'info') {
  return `<span class="pill ${tone}">${esc(label)}</span>`;
}

function artifact(label, value, tone = 'info') {
  return `<div class="artifact ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function versionRow(id, meta, note, selected = false) {
  return `
    <button class="version-row ${selected ? 'selected' : ''}" type="button">
      <code>${esc(id)}</code>
      <span>${esc(meta)}</span>
      <strong>${esc(note)}</strong>
    </button>`;
}

function caseRow(id, summary, delta, priority, decision, selected = false) {
  return `
    <button class="case-row ${selected ? 'selected' : ''}" type="button">
      <code>${esc(id)}</code>
      <span>${esc(summary)}</span>
      <strong>${esc(delta)}</strong>
      <em>${esc(priority)}</em>
      <b>${esc(decision)}</b>
    </button>`;
}

function caseReviewTable(rows) {
  return `
    <table class="case-table">
      <thead>
        <tr>
          <th>Case ID</th>
          <th>Case title</th>
          <th>Rubric change</th>
          <th>Review comment</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr class="${row.selected ? 'selected' : ''}">
            <td><code>${esc(row.id)}</code></td>
            <td>${esc(row.caseTitle)}</td>
            <td>${esc(row.rubricChange)}</td>
            <td>${esc(row.reviewComment)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function matrix(rows) {
  return `
    <div class="matrix">
      <div class="matrix-row head"><span>Rubric</span><span>Improved</span><span>Regressed</span><span>Net</span></div>
      ${rows.map((row) => `<div class="matrix-row"><span>${esc(row[0])}</span><strong class="good">${esc(row[1])}</strong><strong class="bad">${esc(row[2])}</strong><strong>${esc(row[3])}</strong></div>`).join('')}
    </div>`;
}

function diffView(lines) {
  return `
    <pre class="diff-view">${lines.map(([type, text]) => `<span class="${type}">${esc(text)}</span>`).join('\n')}</pre>`;
}

function runCard(id, title, prompt, measurement, score, diagnosis, starred = false) {
  return `
    <article class="run-card ${starred ? 'starred' : ''}">
      <div><code>${esc(id)}</code>${starred ? '<b class="star">Starred</b>' : ''}</div>
      <h3>${esc(title)}</h3>
      <p><b>Subject</b> ${esc(prompt)}</p>
      <p><b>Measurement</b> ${esc(measurement)}</p>
      <div class="run-summary"><strong>${esc(score)}</strong><span>${esc(diagnosis)}</span></div>
    </article>`;
}

const promptDiff = [
  ['meta', 'diff --git a/prompts/ai_tutor.md b/prompts/ai_tutor.md'],
  ['meta', 'index prompt_v13..prompt_v14 100644'],
  ['meta', '--- a/prompts/ai_tutor.md'],
  ['meta', '+++ b/prompts/ai_tutor.md'],
  ['hunk', '@@ safety_guidance @@'],
  ['del', '- Tell the learner the final answer as soon as the link is suspicious.'],
  ['add', '+ Ask for one observable clue before giving the final safety correction.'],
  ['add', '+ Explain why urgency and login links are high-risk phishing signals.'],
  ['hunk', '@@ response_style @@'],
  ['del', '- Keep encouragement broad and upbeat.'],
  ['add', '+ Keep acknowledgement brief; do not praise risky assumptions.'],
];

const promptDraft = `SYSTEM: You are the AI Tutor for phishing training.

Ask the learner to identify one visible clue before giving a direct correction.
If the learner is about to click, clearly state the safer action and why.`;

const rubricDirectDiff = [
  ['meta', 'diff --git a/rubrics/direct_correction.md b/rubrics/direct_correction.md'],
  ['meta', 'index rubric_v3..rubric_v4 100644'],
  ['meta', '--- a/rubrics/direct_correction.md'],
  ['meta', '+++ b/rubrics/direct_correction.md'],
  ['hunk', '@@ scoring_rule @@'],
  ['del', '- Full credit if the answer eventually says the message may be phishing.'],
  ['add', '+ Full credit requires an explicit correction before recommending any action.'],
  ['add', '+ Partial credit if correction is implied but not stated plainly.'],
];

const rubricDirectDraft = `# direct_correction.md

Full credit requires an explicit correction before recommending any action.
Partial credit if correction is implied but not stated plainly.`;

const rubricKnowledgeDiff = [
  ['meta', 'diff --git a/rubrics/practical_knowledge.md b/rubrics/practical_knowledge.md'],
  ['meta', 'index rubric_v3..rubric_v4 100644'],
  ['meta', '--- a/rubrics/practical_knowledge.md'],
  ['meta', '+++ b/rubrics/practical_knowledge.md'],
  ['hunk', '@@ examples @@'],
  ['add', '+ Strong answer names the channel, sender mismatch, URL risk, and safe next step.'],
];

function newEvalRun() {
  return `
    <div class="top-summary cols-4">
      ${metric('Run name', 'prompt_v14 eval')}
      ${metric('Dataset', 'dataset_v5')}
      ${metric('Rubric', 'rubric_v3')}
      ${metric('Next page', 'Run Detail')}
    </div>
    <div class="layout-main">
      ${panel('Run inputs', `
        ${artifact('Prompt', 'prompt_v14 draft')}
        ${artifact('Dataset', 'dataset_v5 account security')}
        ${artifact('Rubric', 'rubric_v3')}
        ${artifact('Evaluator', 'judge_v1')}
      `)}
      ${panel('Evaluation settings', `
        ${artifact('Model', 'gpt-4o-mini')}
        ${artifact('Cases', '120')}
        ${artifact('Temperature', '0.0')}
        ${artifact('Output', 'results/run_004.json')}
      `)}
    </div>
    <div class="layout-main">
      ${panel('Run command preview', `
        <pre class="diff"><span class="meta">promptfoo eval --config promptfoo.yaml</span>
<span class="meta">--prompt prompts/prompt_v14.txt</span>
<span class="meta">--vars dataset_v5.yaml</span>
<span class="meta">--output results/run_004.json</span></pre>
      `)}
      ${panel('Launch handoff', `
        ${artifact('Primary action', 'Start eval run', 'good')}
        ${artifact('After launch', 'Open Run Detail')}
        ${artifact('Failure path', 'Keep inputs editable')}
      `)}
    </div>
  `;
}

function evaluationLineage() {
  return `
    <div class="grid cols-4">
      ${metric('Current Baseline', 'prompt_v12', 'model_config_v2')}
      ${metric('Trusted Measurement', 'dataset_v5', 'rubric_v3 / judge_v1')}
      ${metric('Active Threads', '3', '1 needs review', 'warn')}
      ${metric('Starred Runs', '1', 'run_003 follow-up')}
    </div>
    <div class="layout-main">
      ${panel('Experiment Thread: beginner safety guidance', `
        <div class="run-sequence">
          ${runCard('run_001', 'Original saved baseline', 'prompt_v12 / model_config_v2', 'dataset_v5 / rubric_v3 / judge_v1', '82%', 'baseline anchor')}
          ${runCard('run_002', 'Helpfulness attempt', 'prompt_v13 / model_config_v2', 'dataset_v5 / rubric_v3 / judge_v1', '86%', 'too direct before inspection')}
          ${runCard('run_003', 'Guided correction attempt', 'prompt_v14 / model_config_v2', 'dataset_v5 / rubric_v3 / judge_v1', '88%', '14 changed cases, 2 regressions', true)}
        </div>
      `, 'wide')}
      ${panel('Selected comparison tray', `
        ${artifact('Run A', 'run_002')}
        ${artifact('Run B', 'run_003')}
        ${artifact('Comparison Type', 'clean prompt A/B', 'good')}
        <button class="primary">Inspect changed cases</button>
      `)}
    </div>`;
}

function runDetail() {
  return `
    <div class="grid cols-4">
      ${metric('Run', 'run_003', '2026-06-21 14:32')}
      ${metric('Score', '88%', '+2 pts from run_002', 'good')}
      ${metric('Changed Cases', '14', '2 regressions', 'warn')}
      ${metric('Star', 'Starred', 'Revisit safety regressions')}
    </div>
    <div class="layout-main">
      ${panel('Subject artifacts', `
        ${artifact('Prompt', 'prompt_v14')}
        ${artifact('Model config', 'model_config_v2')}
      `)}
      ${panel('Measurement artifacts', `
        ${artifact('Dataset', 'dataset_v5', 'good')}
        ${artifact('Rubric', 'rubric_v3', 'good')}
        ${artifact('Evaluator', 'judge_v1', 'good')}
      `)}
      ${panel('Evidence routes', `
        ${artifact('Diagnosis', 'diagnosis_002')}
        ${artifact('A/B evidence', 'run_002 vs run_003')}
        ${artifact('Provenance', 'results/run_003.json')}
        <button class="primary">Open A/B Cases</button>
      `, 'wide')}
    </div>`;
}

function diagnosisNotebook() {
  return `
    <div class="layout-main">
      ${panel('Structured diagnosis', `
        <label>Observed issue<textarea>Beginner safety cases improved overall, but two outputs still correct the learner before asking for one observable clue.</textarea></label>
        <label>Suspected cause<select><option>prompt</option></select></label>
        <label>Target artifact<select><option>prompt</option></select></label>
        <label>Next hypothesis<textarea>Restore one guided observation step before direct correction.</textarea></label>
      `, 'wide form-panel')}
      ${panel('Evidence links', `
        ${artifact('Run pair', 'run_002 vs run_003')}
        ${artifact('Changed cases', 'eval_024, eval_083')}
        ${artifact('Target page', 'Prompt Versions')}
        ${pill('One artifact role', 'good')}
      `)}
    </div>`;
}

function promptVersions() {
  return `
    <div class="grid cols-3">
      ${metric('Base prompt', 'prompt_v13', 'run_002')}
      ${metric('Compare prompt', 'prompt_v14', 'run_003')}
      ${metric('Diff stats', '+3 / -2', 'source-level git diff')}
    </div>
    <div class="layout-main">
      ${panel('Prompt version log', `
        ${versionRow('prompt_v12', 'run_001', 'baseline')}
        ${versionRow('prompt_v13', 'run_002', 'base selected', true)}
        ${versionRow('prompt_v14', 'run_003', 'compare selected', true)}
      `)}
      ${panel('Git diff view', diffView(promptDiff), 'wide')}
    </div>
    ${panel('Prompt Editor', `
      ${artifact('Editing', 'Draft prompt')}
      <label>Draft prompt<textarea>${esc(promptDraft)}</textarea></label>
      <button class="primary">Save prompt draft</button>
    `, 'form-panel')}`;
}

function abCases() {
  return `
    <div class="grid cols-4">
      ${metric('Run A', 'run_002', 'prompt_v13')}
      ${metric('Run B', 'run_003', 'prompt_v14')}
      ${metric('Comparison', 'clean prompt A/B', 'measurement stable', 'good')}
      ${metric('Visible cases', '14', 'changed only')}
    </div>
    ${panel('Rubric Delta Matrix', matrix([
      ['Direct correction', '5', '2', '+3'],
      ['Practical knowledge', '7', '1', '+6'],
      ['Reading level', '3', '0', '+3'],
      ['Low boilerplate praise', '1', '2', '-1'],
    ]))}
    ${panel('Changed case queue', `
      ${caseReviewTable([
        {
          id: 'eval_024',
          caseTitle: 'Beginner trusts urgent bank alert with login link',
          rubricChange: 'Direct correction +3; Practical knowledge +6',
          reviewComment: 'Correction improved, but the login-link warning became too terse.',
          selected: true,
        },
        {
          id: 'eval_083',
          caseTitle: 'Learner trusts Discord giveaway because comments look real',
          rubricChange: 'Practical knowledge +6',
          reviewComment: 'Good practical example; no extra workflow needed.',
        },
        {
          id: 'eval_117',
          caseTitle: 'Parent asks whether a shortened school-payment URL is safe',
          rubricChange: 'Low boilerplate praise -1; Reading level +3',
          reviewComment: 'Readable, but the praise rubric change needs reviewer judgment.',
        },
      ])}
    `)}`;
}

function caseEvidence() {
  return `
    <div class="crumb">A/B Cases / Case Evidence</div>
    <div class="grid cols-4">
      ${metric('Run A: run_002', 'prompt_v13', 'dataset_v5 rubric_v3')}
      ${metric('Run B: run_003', 'prompt_v14', 'dataset_v5 rubric_v3')}
      ${metric('Case', 'eval_024', 'bank alert urgency')}
      ${metric('Movement', 'mixed', 'direct correction -1', 'warn')}
    </div>
    <div class="layout-main">
      ${panel('Side-by-side tutor outputs', `
        <div class="compare-output">
          <article><h3>Version A</h3><p>The message is probably suspicious. Do not click the link.</p><em>Direct but skips learner inspection.</em></article>
          <article><h3>Version B</h3><p>What clue do you notice in the sender or link? The urgent login request is a phishing signal.</p><em>Better guidance, still needs clearer correction.</em></article>
        </div>
      `, 'wide')}
      ${panel('Review decision', `
        ${artifact('Decision', 'Needs prompt revision', 'warn')}
        ${artifact('Required note', 'Clarify correction before safe action')}
        <button class="primary">Save Review Decision</button>
        <button>Next changed case</button>
      `)}
    </div>`;
}

function datasetDistribution() {
  return `
    <div class="grid cols-4">
      ${metric('Dataset', 'dataset_v5', '118 cases')}
      ${metric('Analysis type', 'N-gram analysis', 'deterministic')}
      ${metric('Token scope', 'learner situation', 'case title text')}
      ${metric('Minimum count', '3', 'common phrases only')}
    </div>
    <div class="layout-main">
      ${panel('Top 1-grams', `
        <div class="bar-row"><span>account</span><b style="width:54%"></b><strong>54</strong></div>
        <div class="bar-row"><span>link</span><b style="width:42%"></b><strong>42</strong></div>
        <div class="bar-row"><span>password</span><b style="width:31%"></b><strong>31</strong></div>
        <div class="bar-row"><span>bank</span><b style="width:24%"></b><strong>24</strong></div>
      `, 'wide')}
      ${panel('Top 2-grams', `
        <div class="bar-row"><span>bank account</span><b style="width:36%"></b><strong>36</strong></div>
        <div class="bar-row"><span>reset password</span><b style="width:27%"></b><strong>27</strong></div>
        <div class="bar-row"><span>click link</span><b style="width:19%"></b><strong>19</strong></div>
      `)}
    </div>
    ${panel('Top 3-grams', `
      <div class="bar-row"><span>verify bank account</span><b style="width:18%"></b><strong>18</strong></div>
      <div class="bar-row"><span>urgent password reset</span><b style="width:12%"></b><strong>12</strong></div>
      <div class="bar-row"><span>avoid clicking link</span><b style="width:9%"></b><strong>9</strong></div>
    `)}`;
}

function rubricDiffs() {
  return `
    <div class="grid cols-4">
      ${metric('Base rubric', 'rubric_v3', 'run_003')}
      ${metric('Compare rubric', 'rubric_v4', 'draft')}
      ${metric('Changed files', '2', 'review one file at a time', 'warn')}
      ${metric('Selected file', 'direct_correction.md', '+3 / -1')}
    </div>
    <div class="layout-main">
      ${panel('Rubric version log', `
        ${versionRow('rubric_v2', 'run_001', 'older baseline')}
        ${versionRow('rubric_v3', 'run_003', 'base selected', true)}
        ${versionRow('rubric_v4', 'draft', 'compare selected', true)}
      `)}
      ${panel('Changed rubric files', `
        ${versionRow('rubrics/direct_correction.md', 'modified', '+3 / -1', true)}
        ${versionRow('rubrics/practical_knowledge.md', 'modified', '+1 / -0')}
        ${versionRow('rubrics/reading_level.md', 'unchanged', '0 / 0')}
      `)}
    </div>
    <div class="layout-main">
      ${panel('Selected file diff', diffView(rubricDirectDiff), 'wide')}
    </div>
    <div class="layout-main">
      ${panel('Rubric Editor: selected file', `
        ${artifact('Selected file', 'rubrics/direct_correction.md')}
        <label>Draft rubric<textarea class="rubric-editor-large">${esc(rubricDirectDraft)}</textarea></label>
        <button class="primary">Save rubric draft</button>
      `, 'form-panel wide')}
    </div>`;
}

function exportAuthority() {
  return `
    <div class="grid cols-4">
      ${metric('Bundle', 'review_packet_2026_06_23', 'ready')}
      ${metric('Prompt diffs', '1', 'prompt_v13..prompt_v14')}
      ${metric('AI variables', '1', 'emotional resistance')}
      ${metric('Unresolved cases', '2', 'export flagged', 'warn')}
    </div>
    <div class="layout-main">
      ${panel('Included evidence', `
        ${artifact('Evaluation Runs', 'run_002, run_003')}
        ${artifact('Case decisions', '3 saved')}
        ${artifact('Dataset variable metadata', 'model/config/provenance')}
        ${artifact('Rubric diffs', 'rubric_v3..rubric_v4')}
      `, 'wide')}
      ${panel('Authority', `
        ${pill('Promptfoo authoritative', 'good')}
        ${pill('Browser does not mutate source files', 'info')}
        ${pill('Heuristic previews are not eval results', 'warn')}
        <button class="primary">Export review bundle</button>
      `)}
    </div>`;
}

const pages = [
  { filename: '00-new-eval-run.png', title: 'New Eval Run', eyebrow: 'Start a measured evaluation', body: newEvalRun() },
  { filename: '01-evaluation-lineage.png', title: 'Evaluation Lineage', eyebrow: 'Orient across runs', body: evaluationLineage() },
  { filename: '02-run-detail.png', title: 'Run Detail', eyebrow: 'One evaluation observation', body: runDetail() },
  { filename: '03-diagnosis-notebook.png', title: 'Diagnosis Notebook', eyebrow: 'Interpret before changing', body: diagnosisNotebook() },
  { filename: '04-prompt-versions.png', title: 'Prompt Versions', eyebrow: 'Source diff, not composition parsing', body: promptVersions() },
  { filename: '06-ab-changed-case-inspector.png', title: 'A/B Changed Case Inspector', eyebrow: 'Changed cases only', body: abCases() },
  { filename: '07-case-evidence-view.png', title: 'Case Evidence View', eyebrow: 'Selected comparison detail', body: caseEvidence() },
  { filename: '08-dataset-distribution.png', title: 'Dataset Distribution', eyebrow: 'Simple n-gram coverage', body: datasetDistribution() },
  { filename: '09-rubric-inspect.png', title: 'Rubric Inspect', eyebrow: 'Selected rubric file review', body: rubricDiffs() },
  { filename: '10-provenance-export-authority.png', title: 'Provenance and Export', eyebrow: 'Review packet authority', body: exportAuthority() },
];

function css() {
  return `
    :root {
      --sidebar: #13272d;
      --ink: #172024;
      --muted: #637178;
      --line: #d9e2e5;
      --soft: #f3f7f8;
      --panel: #ffffff;
      --mint: #61c2a2;
      --blue: #4f7ea8;
      --amber: #d8a12e;
      --red: #c85b4b;
      --green: #3f8f6b;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: #edf3f4; }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 230px 1fr; }
    aside { background: var(--sidebar); color: #edf7f6; padding: 24px 18px; display: flex; flex-direction: column; gap: 24px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .mark { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 8px; background: var(--mint); color: #0b2325; font-weight: 800; }
    .brand span, .side-foot span { display: block; color: #a9c0c4; font-size: 12px; margin-top: 2px; }
    nav { display: grid; gap: 6px; }
    nav a { color: #d7e6e8; text-decoration: none; padding: 9px 10px; border-radius: 6px; font-size: 14px; }
    nav a.active { background: rgba(255,255,255,.12); color: #fff; box-shadow: inset 3px 0 0 var(--mint); }
    .side-foot { margin-top: auto; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.18); }
    main { padding: 26px 30px 38px; }
    .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; color: var(--muted); font-size: 13px; }
    .hero { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 22px; margin-bottom: 18px; display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: end; }
    .eyebrow { color: var(--blue); text-transform: uppercase; font-size: 12px; font-weight: 800; letter-spacing: 0; }
    h1 { margin: 6px 0 0; font-size: 30px; line-height: 1.1; letter-spacing: 0; }
    .metric, .artifact { border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; min-width: 168px; background: var(--soft); }
    .metric span, .artifact span { display: block; font-size: 12px; color: var(--muted); }
    .metric strong, .artifact strong { display: block; margin-top: 4px; font-size: 16px; }
    .metric.good, .artifact.good { border-color: #b9ddcd; background: #edf8f3; }
    .metric.warn, .artifact.warn { border-color: #ecd38d; background: #fff8df; }
    .metric.bad, .artifact.bad { border-color: #e8b9af; background: #fff0ed; }
    .grid { display: grid; gap: 12px; margin-bottom: 16px; }
    .cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .metric { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; min-height: 86px; }
    .metric em { display: block; margin-top: 8px; color: var(--muted); font-style: normal; font-size: 12px; }
    .layout-main { display: grid; grid-template-columns: 1fr 1.6fr; gap: 16px; margin-bottom: 16px; align-items: start; }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .panel.wide { grid-column: span 1; }
    .layout-main > .panel.wide { grid-column: 1 / -1; }
    .panel-title { font-size: 13px; color: var(--muted); text-transform: uppercase; font-weight: 800; margin-bottom: 12px; letter-spacing: 0; }
    .run-sequence { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .run-card { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: #fbfdfd; min-height: 190px; }
    .run-card h3 { margin: 12px 0; font-size: 16px; }
    .run-card p { margin: 8px 0; color: var(--muted); font-size: 13px; }
    .run-summary { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--line); padding-top: 10px; margin-top: 12px; font-size: 12px; }
    .star, .pill { float: right; border-radius: 999px; padding: 3px 8px; background: #fff3ce; color: #76540d; font-size: 12px; }
    .pill { float: none; display: inline-flex; margin: 4px 6px 4px 0; background: #e7f1f3; color: #31545d; }
    .pill.good { background: #e5f5ee; color: var(--green); }
    .pill.warn { background: #fff3ce; color: #76540d; }
    .artifact { border: 1px solid var(--line); border-radius: 6px; padding: 10px; margin-bottom: 8px; background: #f9fbfb; }
    button { border: 1px solid var(--line); border-radius: 6px; background: #fff; color: var(--ink); padding: 9px 12px; font-weight: 700; }
    button.primary { background: var(--sidebar); color: #fff; border-color: var(--sidebar); }
    .version-row, .case-row { width: 100%; display: grid; grid-template-columns: 150px 1fr 150px; gap: 10px; text-align: left; align-items: center; margin-bottom: 8px; }
    .case-row { grid-template-columns: 120px 1fr 170px 120px 140px; }
    .version-row.selected, .case-row.selected { border-color: var(--mint); background: #effaf6; }
    .case-table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; font-size: 13px; }
    .case-table th, .case-table td { padding: 11px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    .case-table th { background: var(--soft); color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0; }
    .case-table tr:last-child td { border-bottom: 0; }
    .case-table tr.selected td { background: #effaf6; }
    .case-table .pill { margin: 0; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; background: #eef4f5; padding: 2px 5px; border-radius: 4px; }
    .diff-view { margin: 0; border: 1px solid var(--line); border-radius: 8px; background: #0f1d22; color: #d7e6e8; padding: 14px; line-height: 1.45; font-size: 13px; overflow: hidden; }
    .diff-view span { display: block; white-space: pre-wrap; }
    .diff-view .meta { color: #9ab5bb; }
    .diff-view .hunk { color: #ffd166; }
    .diff-view .add { color: #a7e3bd; }
    .diff-view .del { color: #ffaaa0; }
    .matrix { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    .matrix-row { display: grid; grid-template-columns: 1.3fr repeat(4, 1fr); gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--line); align-items: center; }
    .matrix-row:last-child { border-bottom: 0; }
    .matrix-row.head { background: var(--soft); font-size: 12px; color: var(--muted); font-weight: 800; }
    .good { color: var(--green); }
    .bad { color: var(--red); }
    .form-panel label { display: block; margin-bottom: 12px; font-size: 13px; font-weight: 700; }
    textarea, select { width: 100%; margin-top: 6px; border: 1px solid var(--line); border-radius: 6px; padding: 9px; font: inherit; background: #fff; }
    textarea { min-height: 90px; resize: none; }
    textarea.rubric-editor-large { min-height: 220px; }
    .compare-output { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .compare-output article { border: 1px solid var(--line); border-radius: 8px; padding: 14px; background: #f9fbfb; }
    .compare-output h3 { margin-top: 0; }
    .compare-output em { color: var(--muted); font-style: normal; font-size: 12px; }
    .crumb { color: var(--muted); font-size: 13px; font-weight: 800; margin-bottom: 12px; }
    .bar-row { display: grid; grid-template-columns: 160px 1fr 60px; align-items: center; gap: 10px; margin: 10px 0; }
    .bar-row b { display: block; height: 14px; border-radius: 4px; background: var(--mint); }
    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }
      aside { position: static; }
      .layout-main, .grid, .run-sequence, .compare-output { grid-template-columns: 1fr; }
      .hero { grid-template-columns: 1fr; }
    }
  `;
}

function renderPage(pageData) {
  const nav = navItems.map(([filename, label]) => {
    const active = filename === pageData.filename ? 'active' : '';
    const htmlName = filename.replace('.png', '.html');
    return `<a class="${active}" href="${htmlName}">${esc(label)}</a>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(pageData.title)}</title>
  <style>${css()}</style>
</head>
<body>
  <div class="shell">
    <aside>
      <div class="brand"><div class="mark">PE</div><div><strong>Prompt Eval</strong><span>Review Workspace</span></div></div>
      <nav aria-label="Mockup pages">${nav}</nav>
      <div class="side-foot"><strong>Promptfoo authoritative</strong><span>Browser review mockup</span></div>
    </aside>
    <main>
      <div class="topbar"><span>Tutor System / AI Tutor Eval</span><span>dataset_v5 / rubric_v3 / judge_v1</span></div>
      <section class="hero">
        <div><div class="eyebrow">${esc(pageData.eyebrow)}</div><h1>${esc(pageData.title)}</h1></div>
      </section>
      ${pageData.body}
    </main>
  </div>
</body>
</html>`;
}

async function main() {
  mkdirSync(htmlDir, { recursive: true });
  readdirSync(htmlDir)
    .filter((entryName) => /^[0-9]{2}-.+\.html$/.test(entryName))
    .forEach((entryName) => rmSync(path.join(htmlDir, entryName)));

  const renderedHtmlPages = pages.map((pageData) => {
    const html = renderPage(pageData);
    const htmlName = pageData.filename.replace('.png', '.html');
    const htmlPath = path.join(htmlDir, htmlName);
    writeFileSync(htmlPath, html);
    return { ...pageData, html };
  });

  const chromium = await loadChromium();
  let browser;

  try {
    const executablePath = findCachedChromiumExecutable();
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: executablePath ?? undefined,
      headless: true,
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });

    for (const pageData of renderedHtmlPages) {
      await page.setContent(pageData.html, { waitUntil: 'load' });
      await page.screenshot({ path: path.join(__dirname, pageData.filename), fullPage: true });
    }
  } catch (error) {
    console.warn(`Rendered ${renderedHtmlPages.length} HTML mockups, but PNG screenshots were skipped: ${error.message}`);
  } finally {
    await browser?.close();
  }

  console.log(`Rendered ${renderedHtmlPages.length} eval web mockup HTML files to ${htmlDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
