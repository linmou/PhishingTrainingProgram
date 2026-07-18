import { buildPromptfooViewModel, filterResultRows, metricPassRates } from './promptfooResultsModel.js';

// Relative first so GitHub Pages (/repo/eval/) and Cloudflare (/eval/) both work.
const RESULTS_PATHS = [
  '../promptfoo/results/latest.json',
  '/promptfoo/results/latest.json',
  'promptfoo/results/latest.json',
];

const state = {
  model: null,
  filterMode: 'all',
  search: '',
  detail: null, // { row, promptIdx } | null
  showCharts: true,
  visibleVars: null, // null = default primary vars
};

const PRIMARY_VARS = ['case_id', 'student_message', 'expected_behavior_focus'];

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const percent = (value, digits = 0) => `${(Number(value) * 100).toFixed(digits)}%`;
const fmtScore = (value) => Number(value ?? 0).toFixed(2);

function passRate(prompt) {
  const pass = prompt.metrics.testPassCount ?? 0;
  const fail = prompt.metrics.testFailCount ?? 0;
  const total = pass + fail + (prompt.metrics.testErrorCount ?? 0);
  return total === 0 ? 0 : pass / total;
}

async function loadLatestJson() {
  let lastError;
  for (const path of RESULTS_PATHS) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Unable to load results/latest.json');
}

function activeVarColumns(model) {
  if (state.visibleVars) return state.visibleVars;
  return model.varColumns.filter((column) => PRIMARY_VARS.includes(column));
}

function renderPassBadge(success) {
  return success
    ? '<span class="badge pass">PASS</span>'
    : '<span class="badge fail">FAIL</span>';
}

function renderNamedScores(namedScores = {}) {
  const entries = Object.entries(namedScores);
  if (entries.length === 0) return '';
  return `<div class="named-scores">${entries.map(([metric, score]) => {
    const tone = Number(score) >= 1 ? 'pass' : Number(score) > 0 ? 'partial' : 'fail';
    return `<span class="chip ${tone}" title="${escapeHtml(metric)}">${escapeHtml(metric)}: ${fmtScore(score)}</span>`;
  }).join('')}</div>`;
}

function renderOutputCell(row, output, prompt) {
  const truncated = (output.output || '').slice(0, 420);
  return `<td class="output-cell ${output.success ? 'is-pass' : 'is-fail'}" data-open-detail data-test-idx="${row.testIdx}" data-prompt-idx="${output.promptIdx}">
    <div class="cell-head">
      ${renderPassBadge(output.success)}
      <strong>${fmtScore(output.score)}</strong>
      <span class="muted">${escapeHtml(prompt.shortLabel)}</span>
    </div>
    ${renderNamedScores(output.namedScores)}
    <pre class="cell-output">${escapeHtml(truncated)}${output.output.length > 420 ? '…' : ''}</pre>
    ${output.reason ? `<div class="cell-reason">${escapeHtml(output.reason.slice(0, 180))}${output.reason.length > 180 ? '…' : ''}</div>` : ''}
  </td>`;
}

function renderCharts(model) {
  if (!state.showCharts) return '';
  const rates = metricPassRates(model.prompts);
  const passBars = model.prompts.map((prompt) => {
    const rate = passRate(prompt);
    return `<div class="chart-bar-row">
      <span>${escapeHtml(prompt.shortLabel)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(rate * 100).toFixed(1)}%"></div></div>
      <strong>${percent(rate, 1)}</strong>
      <em>${prompt.metrics.testPassCount}/${prompt.metrics.testPassCount + prompt.metrics.testFailCount}</em>
    </div>`;
  }).join('');

  const metricRows = rates.map((row) => {
    const cells = row.values.map((value, index) => {
      const count = row.counts[index] || 0;
      const max = Math.max(...row.values, 1);
      const width = Math.max(4, (value / max) * 100);
      return `<div class="mini-metric">
        <div class="bar-track thin"><div class="bar-fill secondary" style="width:${width}%"></div></div>
        <span>${escapeHtml(String(value))}${count ? ` / ${count}` : ''}</span>
      </div>`;
    }).join('');
    return `<tr><th>${escapeHtml(row.metric)}</th><td>${cells}</td></tr>`;
  }).join('');

  return `<section class="charts-panel" aria-label="Results charts">
    <div class="chart-card">
      <h3>Pass rate</h3>
      ${passBars}
    </div>
    <div class="chart-card wide">
      <h3>Named metrics (sum of scores)</h3>
      <table class="metric-table"><tbody>${metricRows}</tbody></table>
      <p class="muted chart-legend">${model.prompts.map((prompt) => escapeHtml(prompt.shortLabel)).join(' · ')}</p>
    </div>
  </section>`;
}

function renderDetail(model) {
  if (!state.detail) return '';
  const row = model.rows.find((item) => item.testIdx === state.detail.testIdx);
  if (!row) return '';
  const promptIdx = state.detail.promptIdx;
  const prompt = model.prompts[promptIdx];
  const output = row.outputs[promptIdx];
  const assertions = (output.assertions ?? []).map((assertion) => `
    <article class="assertion ${assertion.pass ? 'pass' : 'fail'}">
      <header>
        ${renderPassBadge(assertion.pass)}
        <strong>${escapeHtml(assertion.metric)}</strong>
        <span class="muted">${fmtScore(assertion.score)}</span>
      </header>
      <p>${escapeHtml(assertion.reason || 'No reason provided')}</p>
    </article>`).join('') || '<p class="muted">No assertion breakdown</p>';

  return `<aside class="detail-drawer" role="dialog" aria-label="Output details">
    <div class="detail-head">
      <div>
        <div class="eyebrow">Case detail</div>
        <h2>${escapeHtml(row.caseId)}</h2>
        <p class="muted">${escapeHtml(prompt.shortLabel)} · ${escapeHtml(prompt.provider)} · ${escapeHtml(prompt.sourcePath)}</p>
      </div>
      <button type="button" class="icon-btn" data-close-detail aria-label="Close">×</button>
    </div>
    <div class="detail-meta">
      ${renderPassBadge(output.success)}
      <strong>score ${fmtScore(output.score)}</strong>
      <span class="muted">${output.latencyMs} ms</span>
    </div>
    <section>
      <h3>Variables</h3>
      <dl class="var-list">${Object.entries(row.vars).map(([key, value]) => `
        <div><dt>${escapeHtml(key)}</dt><dd><pre>${escapeHtml(value)}</pre></dd></div>`).join('')}
      </dl>
    </section>
    <section>
      <h3>Output</h3>
      <pre class="detail-output">${escapeHtml(output.output)}</pre>
    </section>
    <section>
      <h3>Grading</h3>
      <p class="reason-block">${escapeHtml(output.reason || '—')}</p>
      <div class="assertion-list">${assertions}</div>
    </section>
  </aside>`;
}

function renderTable(model, rows) {
  const varCols = activeVarColumns(model);
  const head = `
    <tr>
      ${varCols.map((column) => `<th class="var-col">${escapeHtml(column)}</th>`).join('')}
      ${model.prompts.map((prompt) => `<th class="prompt-col">
        <div>${escapeHtml(prompt.shortLabel)}</div>
        <div class="muted">${escapeHtml(prompt.provider)}</div>
        <div class="prompt-score">${percent(passRate(prompt), 1)} pass · score ${fmtScore(prompt.metrics.score)}</div>
      </th>`).join('')}
    </tr>`;

  const body = rows.map((row) => `
    <tr class="${row.different ? 'row-different' : ''} ${row.anyFail ? 'row-has-fail' : 'row-all-pass'}">
      ${varCols.map((column) => `<td class="var-col"><pre>${escapeHtml(row.vars[column] ?? '')}</pre></td>`).join('')}
      ${row.outputs.map((output, index) => renderOutputCell(row, output, model.prompts[index])).join('')}
    </tr>`).join('');

  return `<div class="table-wrap"><table class="results-table"><thead>${head}</thead><tbody>${body || '<tr><td colspan="99" class="empty">No rows match this filter.</td></tr>'}</tbody></table></div>`;
}

function renderSummary(model) {
  return `<section class="summary-strip">
    ${model.prompts.map((prompt) => {
      const rate = passRate(prompt);
      return `<article class="prompt-card">
        <div class="eyebrow">${escapeHtml(prompt.shortLabel)}</div>
        <strong class="${rate >= 0.8 ? 'good' : rate >= 0.5 ? 'mid' : 'bad'}">${percent(rate, 1)}</strong>
        <p>${prompt.metrics.testPassCount} pass · ${prompt.metrics.testFailCount} fail · ${prompt.metrics.testErrorCount} err</p>
        <p class="muted">${escapeHtml(prompt.sourcePath)}</p>
        <p class="muted">score ${fmtScore(prompt.metrics.score)} · ${prompt.metrics.totalLatencyMs} ms</p>
      </article>`;
    }).join('')}
    <article class="prompt-card stats">
      <div class="eyebrow">Eval</div>
      <strong>${escapeHtml(model.evalId || '—')}</strong>
      <p>${model.rows.length} cases · ${model.prompts.length} prompts</p>
      <p class="muted">${escapeHtml(model.timestamp || '')}</p>
      <p class="muted">source: evals/promptfoo/results/latest.json</p>
    </article>
  </section>`;
}

function renderToolbar(model, visibleCount) {
  const modes = [
    ['all', 'All'],
    ['failures', 'Failures'],
    ['passes', 'Passes'],
    ['different', 'Different'],
  ];
  return `<section class="toolbar">
    <div class="mode-group" role="tablist" aria-label="Display mode">
      ${modes.map(([id, label]) => `
        <button type="button" class="mode-btn ${state.filterMode === id ? 'active' : ''}" data-filter-mode="${id}">${label}</button>`).join('')}
    </div>
    <label class="search-field">
      <span class="sr-only">Search</span>
      <input type="search" id="search-input" placeholder="Search cases, outputs, metrics…" value="${escapeHtml(state.search)}" />
    </label>
    <div class="toolbar-meta">
      <span>${visibleCount} / ${model.rows.length} cases</span>
      <button type="button" class="ghost-btn" data-toggle-charts>${state.showCharts ? 'Hide charts' : 'Show charts'}</button>
      <button type="button" class="ghost-btn" data-toggle-vars>${state.visibleVars ? 'Fewer vars' : 'More vars'}</button>
    </div>
  </section>`;
}

function render() {
  const root = document.querySelector('#app');
  if (!state.model) {
    root.innerHTML = '<div class="boot">Loading Promptfoo results…</div>';
    return;
  }

  const model = state.model;
  const rows = filterResultRows(model.rows, { filterMode: state.filterMode, search: state.search });

  root.innerHTML = `
    <div class="viewer ${state.detail ? 'has-detail' : ''}">
      <header class="topbar">
        <div class="brand">
          <span class="logo">pf</span>
          <div>
            <div class="brand-title">promptfoo results</div>
            <div class="brand-sub">${escapeHtml(model.description)}</div>
          </div>
        </div>
        <div class="topbar-actions">
          <a class="ghost-btn" href="../promptfoo/results/latest.html" target="_blank" rel="noreferrer">Raw HTML export</a>
          <a class="ghost-btn" href="../promptfoo/README.md" target="_blank" rel="noreferrer">README</a>
        </div>
      </header>
      ${renderSummary(model)}
      ${renderCharts(model)}
      ${renderToolbar(model, rows.length)}
      ${renderTable(model, rows)}
      ${renderDetail(model)}
      ${state.detail ? '<div class="detail-backdrop" data-close-detail></div>' : ''}
    </div>`;

  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('[data-filter-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filterMode = button.getAttribute('data-filter-mode');
      render();
    });
  });

  const search = document.querySelector('#search-input');
  if (search) {
    search.addEventListener('input', (event) => {
      state.search = event.target.value;
      // keep cursor; re-render replaces input so restore focus/selection
      const start = event.target.selectionStart;
      const end = event.target.selectionEnd;
      render();
      const next = document.querySelector('#search-input');
      if (next) {
        next.focus();
        next.setSelectionRange(start, end);
      }
    });
  }

  document.querySelectorAll('[data-toggle-charts]').forEach((button) => {
    button.addEventListener('click', () => {
      state.showCharts = !state.showCharts;
      render();
    });
  });

  document.querySelectorAll('[data-toggle-vars]').forEach((button) => {
    button.addEventListener('click', () => {
      if (state.visibleVars) {
        state.visibleVars = null;
      } else {
        state.visibleVars = state.model.varColumns.slice();
      }
      render();
    });
  });

  document.querySelectorAll('[data-open-detail]').forEach((cell) => {
    cell.addEventListener('click', () => {
      state.detail = {
        testIdx: Number(cell.getAttribute('data-test-idx')),
        promptIdx: Number(cell.getAttribute('data-prompt-idx')),
      };
      render();
    });
  });

  document.querySelectorAll('[data-close-detail]').forEach((el) => {
    el.addEventListener('click', () => {
      state.detail = null;
      render();
    });
  });
}

async function boot() {
  const root = document.querySelector('#app');
  root.innerHTML = '<div class="boot">Loading Promptfoo results from evals/promptfoo…</div>';
  try {
    const latest = await loadLatestJson();
    state.model = buildPromptfooViewModel(latest);
    // URL params like promptfoo view
    const params = new URLSearchParams(window.location.search);
    if (params.get('filterMode')) state.filterMode = params.get('filterMode');
    if (params.get('search')) state.search = params.get('search');
    render();
  } catch (error) {
    root.innerHTML = `<div class="boot error">
      <h1>Could not load eval results</h1>
      <p>${escapeHtml(error.message)}</p>
      <p class="muted">Expected <code>evals/promptfoo/results/latest.json</code>. Serve from the <code>evals/</code> folder via <code>npm start</code>.</p>
    </div>`;
  }
}

boot();
