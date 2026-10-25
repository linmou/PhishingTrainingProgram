// Inspect learner data, never application JavaScript or teacher review traffic.
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const PRIVATE_FIELDS = new Set(['assessment_key', 'assessment_transfer_basis', 'correct_option_ids',
  'learner_safe_explanation', 'transfer_basis', 'rationale', 'raw_model_output', 'raw_provider_output',
  'reviewed_payload', 'reviewed_private_payload', 'private_payload', 'source_transfer_basis', 'raw_response', 'request_payload', 'reason', 'rendered_text']);
const normalized = text => text.replace(/\s+/g, ' ').trim();

function inspectLearnerData(value, { privateValues = [], approvedResults = [], surface = 'network' } = {}) {
  const violations = [];
  const approved = result => approvedResults.find(row => row.id === result?.id &&
    row.assessment_event?.assessment_id === result.assessment_event?.assessment_id &&
    row.assessment_event.kind === 'result' && row.assessment_event.outcome === 'failed' &&
    row.assessment_event.attempt_number === 2 && row.assessment_event.terminal === true &&
    result.assessment_event?.kind === 'result' && result.assessment_event.outcome === 'failed' &&
    result.assessment_event.attempt_number === 2 && result.assessment_event.terminal === true &&
    row.content === result.content);
  function text(input, location, allowed = '') {
    let checked = normalized(input);
    if (allowed) checked = checked.split(normalized(allowed)).join('');
    if (surface === 'export_txt' || surface === 'dom') {
      for (const row of approvedResults) checked = checked.split(normalized(row.content)).join('');
      if (surface === 'export_txt' && approvedResults.length) {
        const safe = privateValues.find(entry => entry.label === 'safe_explanation')?.value;
        if (safe) checked = checked.split(normalized(`Final answer: incorrect. Explanation: ${safe}`)).join('');
      }
    }
    for (const { label, value: secret } of privateValues) {
      if (secret && checked.includes(normalized(secret))) violations.push({ kind: 'private_value', path: location, label });
    }
  }
  function walk(input, location, terminalExplanationAllowed = false) {
    if (typeof input === 'string') {
      text(input, location);
      if (/^\s*[\[{]/.test(input)) {
        try { const decoded = JSON.parse(input); if (decoded && typeof decoded === 'object') walk(decoded, location + '.decoded'); } catch { /* Plain text remains scanned by value. */ }
      }
      return;
    }
    if (!input || typeof input !== 'object') return;
    if (Array.isArray(input)) { input.forEach((item, index) => walk(item, `${location}[${index}]`)); return; }
    const published = approved(input);
    // The legacy learner response may additionally return these two fields only beside its trusted result.
    const feedbackAllowed = input.answer_outcome === 'failed' && input.terminal === true &&
      input.attempts_used === 2 && approved(input.result_message) &&
      input.assessment_id === input.result_message.assessment_event.assessment_id;
    for (const [key, nested] of Object.entries(input)) {
      const keyContainsPrivateValue = privateValues.some(entry => entry.value && key.includes(entry.value));
      const child = `${location}.${keyContainsPrivateValue ? '<private-key>' : key}`;
      text(key, child + '.key');
      if (PRIVATE_FIELDS.has(key)) violations.push({ kind: 'private_field', path: child });
      if (key === 'terminal_explanation' && terminalExplanationAllowed &&
        nested === privateValues.find(entry => entry.label === 'safe_explanation')?.value) continue;
      if (key === 'answer_lifecycle' && surface === 'export_json' && nested &&
        approvedResults.some(row => row.assessment_event.question_message_id === input.id &&
          row.assessment_event.assessment_id === nested.assessment_id && input.public_question?.id === nested.assessment_id) &&
        nested.state === 'failed' && nested.answer_outcome === 'failed' && nested.terminal === true &&
        nested.attempt_number === 2 && nested.attempts_used === 2 && nested.attempts_remaining === 0) {
        walk(nested, child, true);
      } else if (key === 'content' && published && typeof nested === 'string') text(nested, child, published.content);
      else if (key === 'terminal_failure_feedback' && feedbackAllowed && nested) {
        const expected = privateValues.find(entry => entry.label === 'safe_explanation')?.value;
        const keyIds = input.result_message.content.match(/Correct option\(s\): ([A-D](?:, [A-D])*)\./)?.[1].split(', ');
        if (Object.keys(nested).sort().join(',') !== 'correct_option_ids,learner_safe_explanation' ||
          nested.learner_safe_explanation !== expected ||
          JSON.stringify(nested.correct_option_ids) !== JSON.stringify(keyIds)) {
          violations.push({ kind: 'invalid_terminal_disclosure', path: child });
        }
      } else walk(nested, child);
    }
  }
  walk(value, '$');
  return violations;
}

function captureLearnerData(page, projectUrl) {
  const pending = new Set();
  const records = [];
  const sockets = [];
  const captureErrors = [];
  const record = (surface, data, status) => records.push({ surface, data, status });
  function onRequest(request) {
    const url = new URL(request.url());
    if (url.origin !== projectUrl || !/^\/(rest|functions)\/v1\//.test(url.pathname)) return;
    const body = request.postData();
    if (!body) return;
    let data = body;
    try { data = JSON.parse(body); } catch { /* Plain request text is still scanned by value. */ }
    record('network_request', data);
  }
  function onResponse(response) {
    const url = new URL(response.url());
    if (url.origin !== projectUrl || !/^\/(rest|functions)\/v1\//.test(url.pathname)) return;
    const task = (async () => {
      if (response.request().method() === 'OPTIONS') return;
      const body = await response.text();
      let data = body;
      try { data = JSON.parse(body); } catch { /* Error text must still be scanned. */ }
      record(response.status() >= 400 ? 'error' : 'network', data, response.status());
    })().catch(() => captureErrors.push('A learner HTTP body could not be captured'));
    pending.add(task);
    task.finally(() => pending.delete(task));
  }
  function onSocket(socket) {
    if (!socket.url().startsWith(projectUrl.replace(/^http/, 'ws') + '/realtime/v1/')) return;
    const listener = event => {
      try { record('realtime', JSON.parse(String(event.payload))); }
      catch { captureErrors.push('A learner realtime frame could not be decoded'); }
    };
    socket.on('framereceived', listener);
    sockets.push({ socket, listener });
  }
  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('websocket', onSocket);
  return {
    record,
    // Needed to prove that an actual row event, not a heartbeat, was inspected.
    hasRealtimeRow(id) {
      return records.some(row => {
        if (row.surface !== 'realtime') return false;
        const frame = row.data;
        const event = Array.isArray(frame) ? frame[3] : frame.event;
        const payload = Array.isArray(frame) ? frame[4] : frame.payload;
        const change = payload?.data;
        return event === 'postgres_changes' && change?.table === 'messages' &&
          ['INSERT', 'UPDATE'].includes(change.type) && change.record?.id === id;
      });
    },
    async checkpoint(options) {
      while (pending.size) await Promise.all([...pending]);
      assert.equal(captureErrors.length, 0, captureErrors.join('; '));
      const summaries = records.splice(0).map(({ surface, data, status }) => ({
        surface, status, sha256: crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),
        violations: inspectLearnerData(data, { ...options, surface })
      }));
      return summaries;
    },
    stop() {
      page.off('request', onRequest); page.off('response', onResponse); page.off('websocket', onSocket);
      for (const { socket, listener } of sockets) socket.off('framereceived', listener);
    }
  };
}
module.exports = { inspectLearnerData, captureLearnerData };
