'use strict';

const SHA_RE = /^[0-9a-f]{40}$/;

// Strictly require one well-formed, bounded machine-readable marker.
function jsonMarker(body, marker) {
  if (typeof body !== 'string' || body.length > 200000) return null;
  const prefix = '<!-- ' + marker;
  if (body.split(marker).length !== 2) return null;
  const start = body.indexOf(prefix);
  if (start < 0) return null;
  const end = body.indexOf('-->', start + prefix.length);
  if (end < 0) return null;
  const raw = body.slice(start + prefix.length, end).trim();
  if (!raw.startsWith('{') || raw.length > 4096) return null;
  try {
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch { return null; }
}

function exactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

function parseRiskDecision(body, sha) {
  const data = jsonMarker(body, 'ptp-review-decision:v1');
  if (!data || !exactKeys(data,
    ['schema_version', 'reviewed_commit', 'risk_decision', 'reason', 'affected_contracts', 'authorization_issue'])) return null;
  if (data.schema_version !== 1 || !SHA_RE.test(data.reviewed_commit) || data.reviewed_commit !== sha ||
      !['routine', 'human_required'].includes(data.risk_decision) ||
      typeof data.reason !== 'string' || data.reason.trim().length < 20 || data.reason.length > 2000 ||
      !Array.isArray(data.affected_contracts) || data.affected_contracts.length > 30 ||
      data.affected_contracts.some(item => typeof item !== 'string' || !item.trim() || item.length > 250)) return null;
  if (data.risk_decision === 'routine' &&
      (!Number.isSafeInteger(data.authorization_issue) || data.authorization_issue <= 0)) return null;
  if (data.risk_decision === 'human_required' && data.authorization_issue !== null) return null;
  return data;
}

function authorizedPaths(body) {
  if (typeof body !== 'string' || body.includes('ptp-routine-authorization:v1')) return [];
  const data = jsonMarker(body, 'ptp-routine-authorization:v2');
  if (!data || !exactKeys(data, ['schema_version', 'paths', 'reason']) ||
      data.schema_version !== 2 || typeof data.reason !== 'string' ||
      data.reason.trim().length < 20 || data.reason.length > 2000 ||
      !Array.isArray(data.paths)) return [];
  const paths = data.paths;
  if (paths.length === 0 || paths.length > 30 || paths.some(p =>
    typeof p !== 'string' || !p || p.startsWith('/') || p.startsWith('.') ||
    p.includes('..') || p.includes('\\') || p.includes('*') || p.includes('//') ||
    !/^[\w./-]+$/.test(p))) return [];
  return paths;
}

function acceptedFindingDecision(body, sha) {
  const data = jsonMarker(body, 'ptp-finding-acceptance:v1');
  return !!(data && exactKeys(data, ['schema_version', 'reviewed_commit', 'reason']) &&
    data.schema_version === 1 && data.reviewed_commit === sha && SHA_RE.test(sha) &&
    typeof data.reason === 'string' && data.reason.trim().length >= 20 && data.reason.length <= 2000);
}

module.exports = {jsonMarker, exactKeys, parseRiskDecision, authorizedPaths, acceptedFindingDecision};
