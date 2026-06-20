import { evalWorkspaceSeed } from './evalWorkspaceSeed.js';
import {
  applyNaturalLanguageEvalChange,
  buildEvalWorkspaceSnapshot,
  composePrompt,
  estimateDraftEvaluation,
  exportEvalCasesAsJson,
  updatePromptSection,
} from './evalWorkspaceService.js';

const percent = (value) => `${Math.round(value * 100)}%`;
const signed = (value, digits = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const state = {
  promptSections: structuredClone(evalWorkspaceSeed.promptSections),
  evalCases: structuredClone(evalWorkspaceSeed.evalCases),
  plainEnglishChange: '',
  lastGeneratedMessage: '',
};

function metricBar(metric) {
  return `
    <div class="eval-metric-row">
      <div class="eval-metric-label">
        <strong>${escapeHtml(metric.metric)}</strong>
        <span>Δ ${signed(metric.delta, 1)}</span>
      </div>
      <div class="eval-bars" aria-label="${escapeHtml(metric.metric)} metric comparison">
        <div class="eval-bar eval-bar-baseline" style="width: ${percent(metric.baselineRate)}">Current ${percent(metric.baselineRate)}</div>
        <div class="eval-bar eval-bar-candidate" style="width: ${percent(metric.candidateRate)}">Improved ${percent(metric.candidateRate)}</div>
      </div>
    </div>`;
}

function caseChangeCard(comparison) {
  return `
    <details class="eval-case-change ${escapeHtml(comparison.status)}">
      <summary>
        <span class="eval-case-id">${escapeHtml(comparison.caseId)}</span>
        <span class="eval-pill">${escapeHtml(comparison.status)}</span>
        <span>score Δ ${signed(comparison.scoreDelta, 2)}</span>
      </summary>
      <div class="eval-case-outputs">
        <section>
          <h4>Current prompt output</h4>
          <p>${escapeHtml(comparison.baseline.output)}</p>
          <small>${escapeHtml(comparison.baseline.reason)}</small>
        </section>
        <section>
          <h4>Improved prompt output</h4>
          <p>${escapeHtml(comparison.candidate.output)}</p>
          <small>${escapeHtml(comparison.candidate.reason)}</small>
        </section>
      </div>
      ${comparison.metricsChanged.length > 0 ? `<p class="eval-muted">Changed rubric scores: ${escapeHtml(comparison.metricsChanged.map((metric) => `${metric.metric} ${signed(metric.delta, 1)}`).join(', '))}</p>` : ''}
    </details>`;
}

function render() {
  const snapshot = buildEvalWorkspaceSnapshot(evalWorkspaceSeed);
  const composedPrompt = composePrompt(state.promptSections);
  const exportText = exportEvalCasesAsJson(state.evalCases);
  const draftEvaluation = estimateDraftEvaluation(composedPrompt, state.evalCases);
  const comparison = snapshot.promptComparison;

  document.querySelector('#app').innerHTML = `
    <header class="eval-hero">
      <div>
        <p class="eval-eyebrow">Standalone promptfoo eval website</p>
        <h1>Eval Workspace</h1>
        <p>
          A non-technical view of ../promptfoo: how the tutor prompt is composed, what cases are tested,
          which parameters matter, and what changed between the current and improved prompts.
        </p>
        <p class="eval-note">
          This site is now separate from tutor-system. Browser edits are safe drafts. Export the prompt or eval set and copy it back into evals/promptfoo when ready.
          Running live Promptfoo still requires the CLI and provider API keys.
        </p>
      </div>
      <div class="eval-hero-card">
        <strong>${escapeHtml(evalWorkspaceSeed.metadata.scenarioTemplate)}</strong>
        <span>Agent preset: ${escapeHtml(evalWorkspaceSeed.metadata.agentPreset)}</span>
        <span>Eval ID: ${escapeHtml(evalWorkspaceSeed.metadata.evalId)}</span>
        <span>Source: evals/promptfoo/results/latest.json</span>
      </div>
    </header>

    <section class="eval-grid two-columns">
      <div class="eval-panel">
        <h2>Prompt Composer</h2>
        <p class="eval-muted">Edit plain-language sections and watch the composed prompt preview update.</p>
        ${state.promptSections.map((section) => `
          <label class="eval-section-editor">
            <span>${escapeHtml(section.title)}</span>
            <small>${escapeHtml(section.plainLanguagePurpose)}</small>
            <textarea data-section-id="${escapeHtml(section.id)}" aria-label="${escapeHtml(section.title)}">${escapeHtml(section.content)}</textarea>
          </label>
        `).join('')}
      </div>

      <div class="eval-panel prompt-preview">
        <h2>Composed Prompt Preview</h2>
        <p class="eval-muted">Prompt length: ${composedPrompt.length.toLocaleString()} characters</p>
        <pre>${escapeHtml(composedPrompt)}</pre>
      </div>
    </section>

    <section class="eval-grid two-columns">
      <div class="eval-panel" data-testid="eval-set-builder">
        <h2>Eval Set Builder</h2>
        <label class="eval-section-editor">
          <span>Describe an eval change in plain English</span>
          <small>Example: Add a case where a student trusts a Discord Nitro giveaway because it has many comments.</small>
          <textarea id="plain-english-change" aria-label="Describe an eval change in plain English">${escapeHtml(state.plainEnglishChange)}</textarea>
        </label>
        <button id="generate-case" class="eval-button" ${state.plainEnglishChange.trim() ? '' : 'disabled'}>Generate/Update Eval Case</button>
        ${state.lastGeneratedMessage ? `<p class="eval-success">${escapeHtml(state.lastGeneratedMessage)}</p>` : ''}
        <div class="eval-case-list">
          ${state.evalCases.map((testCase) => `
            <article class="eval-case-card">
              <h3>${escapeHtml(testCase.caseId)}</h3>
              <p>${escapeHtml(testCase.studentMessage)}</p>
              <small>${escapeHtml(testCase.applicableRequirements.join(', '))}</small>
            </article>
          `).join('')}
        </div>
      </div>

      <div class="eval-panel">
        <h2>Exportable eval set</h2>
        <p class="eval-muted">Copy this draft into a repo file or a backend save flow.</p>
        <textarea aria-label="Exportable eval set" class="eval-export" readonly>${escapeHtml(exportText)}</textarea>
      </div>
    </section>

    <section class="eval-panel">
      <h2>Parameter Dashboard</h2>
      <div class="eval-parameter-grid">
        <div><strong>Target model</strong><span>${escapeHtml(comparison.candidate.provider)}</span></div>
        <div><strong>Configured model</strong><span>${escapeHtml(evalWorkspaceSeed.seedConfig.model_name)}</span></div>
        <div><strong>Temperature</strong><span>${evalWorkspaceSeed.seedConfig.temperature}</span></div>
        <div><strong>Max tokens</strong><span>${evalWorkspaceSeed.seedConfig.max_tokens}</span></div>
        <div><strong>Judge model</strong><span>${escapeHtml(evalWorkspaceSeed.seedConfig.judge_model)}</span></div>
        <div><strong>Judge temperature</strong><span>${evalWorkspaceSeed.seedConfig.judge_temperature}</span></div>
        <div><strong>Cases</strong><span>${state.evalCases.length}</span></div>
        <div><strong>Rubrics</strong><span>${comparison.metricComparisons.length}</span></div>
        <div><strong>Draft prompt quality</strong><span>${percent(draftEvaluation.promptQuality)}</span></div>
        <div><strong>Draft pass estimate</strong><span>${draftEvaluation.passedCases}/${draftEvaluation.caseCount}</span></div>
      </div>
    </section>

    <section class="eval-panel">
      <h2>Before/After Impact</h2>
      <div class="eval-score-cards">
        <div><strong>Draft prompt impact</strong><span>${percent(draftEvaluation.passRate)}</span></div>
        <div><strong>Draft score estimate</strong><span>${draftEvaluation.score.toFixed(2)}</span></div>
        <div><strong>Draft cases passing</strong><span>${draftEvaluation.passedCases} pass / ${draftEvaluation.failedCases} fail</span></div>
        <div><strong>Prompt length</strong><span>${draftEvaluation.promptLength.toLocaleString()} chars</span></div>
      </div>
      <p class="eval-muted">Draft prompt impact is a local heuristic preview for immediate feedback. The baseline vs improved numbers below come from the saved Promptfoo run.</p>

      <div class="eval-score-cards">
        <div><strong>Current pass rate</strong><span>${percent(comparison.baseline.testPassRate)}</span></div>
        <div><strong>Improved pass rate</strong><span>${percent(comparison.candidate.testPassRate)}</span></div>
        <div><strong>Score Δ</strong><span>${signed(comparison.scoreDelta, 2)}</span></div>
        <div><strong>Case changes</strong><span>${snapshot.changeCounts.improved} improved / ${snapshot.changeCounts.regressed} regressed</span></div>
      </div>

      <div class="eval-metric-list">${comparison.metricComparisons.map(metricBar).join('')}</div>
      <h3>Case-level changes</h3>
      ${snapshot.caseComparisons.map(caseChangeCard).join('')}
    </section>`;

  attachHandlers();
}

function attachHandlers() {
  document.querySelectorAll('[data-section-id]').forEach((textarea) => {
    textarea.addEventListener('input', (event) => {
      state.promptSections = updatePromptSection(state.promptSections, event.target.dataset.sectionId, event.target.value);
      render();
    });
  });

  const plainEnglishInput = document.querySelector('#plain-english-change');
  plainEnglishInput?.addEventListener('input', (event) => {
    state.plainEnglishChange = event.target.value;
    render();
  });

  document.querySelector('#generate-case')?.addEventListener('click', () => {
    const result = applyNaturalLanguageEvalChange(state.evalCases, state.plainEnglishChange);
    state.evalCases = result.cases;
    state.lastGeneratedMessage = `${result.message} ${result.generatedCase.caseId}`;
    render();
  });
}

render();
