// Purpose: in-memory fake of the Supabase surfaces the app uses (PostgREST, assessment-api, other Edge
// Functions, storage, auth, realtime), served through Playwright routes. Just enough to drive the two-tab
// identity journeys. It does NOT reproduce server seat rules, RLS or SQL triggers; join_room below is a model:
// the owner observes, the first student claims an empty seat, the seated learner records one visit per visit_key.
'use strict';

const crypto = require('node:crypto');

const MOCK_ORIGIN = 'https://e2e-tabs-mock.supabase.co';

function createBackend() {
  const db = {
    users: [], rooms: [], sessions: [], messages: [], message_feedback: [], tutor_images: [],
    session_checklists: [], checklist_items: [], ai_assistant_configs: [], ai_assistant_config_logs: [],
    ai_suggestion_feedback: [], room_templates: [], avatars: [],
  };
  const visits = [];        // {room_id, user_id, visit_key, at}
  const claims = [];        // {room_id, user_id, at} — seat transitions from empty to seated
  const assessmentCalls = []; // every assessment-api call with header and outcome
  const unknown = [];       // requests the mock did not model

  const now = () => new Date().toISOString();
  const uuid = () => crypto.randomUUID();

  function seatOf(roomId) {
    return db.sessions.find(s => s.room_id === roomId && s.status === 'active' && s.student_id);
  }

  function assessmentApi(body, userId) {
    const op = body.operation;
    const fail = (code, message, status = 400) => ({ status, json: { ok: false, error: { code, message, retryable: false } } });
    if (!userId) return fail('UNAUTHENTICATED', 'x-application-user-id required', 401);
    const user = db.users.find(u => u.id === userId);
    if (!user) return fail('UNKNOWN_USER', 'unknown application user', 403);
    const ok = data => ({ status: 200, json: { ok: true, data } });
    switch (op) {
      case 'join_room': {
        const room = db.rooms.find(r => r.id === body.room_id);
        if (!room) return fail('ROOM_NOT_FOUND', 'room not found', 404);
        let seat = seatOf(room.id);
        if (room.tutor_id === userId) return ok({ room_id: room.id, learner_id: seat?.student_id ?? null, room_role: 'observer' });
        if (!seat && user.current_role === 'student') {
          seat = { id: uuid(), room_id: room.id, tutor_id: room.tutor_id, student_id: userId, status: 'active', created_at: now(), updated_at: now() };
          db.sessions.push(seat);
          claims.push({ room_id: room.id, user_id: userId, at: now() });
        }
        if (seat && seat.student_id === userId) {
          if (body.visit_key && !visits.some(v => v.room_id === room.id && v.visit_key === body.visit_key)) {
            visits.push({ room_id: room.id, user_id: userId, visit_key: body.visit_key, at: now() });
          }
          return ok({ room_id: room.id, learner_id: userId, room_role: 'student' });
        }
        return ok({ room_id: room.id, learner_id: seat?.student_id ?? null, room_role: 'observer' });
      }
      case 'initialize_checklist': {
        const room = db.rooms.find(r => r.id === body.room_id);
        if (!room || room.tutor_id !== userId) return fail('FORBIDDEN', 'only the room tutor may save targets', 403);
        const id = uuid();
        const checklist = {
          id, room_id: room.id, session_id: null, student_id: body.student_id, tutor_id: userId, status: 'active',
          progress_policy_version: 'transfer_v1', is_active: true, created_at: now(), updated_at: now(),
        };
        db.session_checklists.push(checklist);
        (body.items || []).forEach((item, index) => db.checklist_items.push({
          id: uuid(), checklist_id: id, area_text: item.area_text, item_type: item.item_type, priority: item.priority,
          status: 'pending', transfer_status: 'pending', order_index: index, created_at: now(), updated_at: now(),
        }));
        return ok({ checklist_id: id });
      }
      case 'post_message': {
        const room = db.rooms.find(r => r.id === body.room_id);
        const seat = room && seatOf(room.id);
        if (!room || !seat || seat.student_id !== userId) return fail('NOT_ROOM_LEARNER', 'only the seated learner may post', 403);
        const message = {
          id: uuid(), room_id: room.id, user_id: userId, content: body.content, user_role: 'student',
          parent_message_id: body.parent_message_id ?? null, ai_model_used: null, ai_response_time_ms: null, created_at: now(),
        };
        db.messages.push(message);
        return ok({ message });
      }
      case 'read_learning_evidence':
        return ok([]);
      case 'analyze_message':
        return ok({ analyzed: false });
      default:
        unknown.push({ kind: 'assessment-api', op });
        return ok({});
    }
  }

  // ---- PostgREST ----
  function parseValue(v) {
    if (v === 'null') return null;
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v;
  }
  function matches(row, key, expr) {
    const not = expr.startsWith('not.');
    const e = not ? expr.slice(4) : expr;
    const dot = e.indexOf('.');
    const op = e.slice(0, dot);
    const raw = e.slice(dot + 1);
    const val = row[key];
    let r;
    switch (op) {
      case 'eq': r = String(val) === String(parseValue(raw)) || val === parseValue(raw); break;
      case 'neq': r = String(val) !== raw; break;
      case 'is': r = val === parseValue(raw) || (parseValue(raw) === null && val === undefined); break;
      case 'in': {
        const list = raw.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''));
        r = list.includes(String(val));
        break;
      }
      case 'gt': r = val > raw; break;
      case 'gte': r = val >= raw; break;
      case 'lt': r = val < raw; break;
      case 'lte': r = val <= raw; break;
      default: unknown.push({ kind: 'filter-op', key, expr }); r = true;
    }
    return not ? !r : r;
  }
  const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

  function embed(rows, select) {
    if (!select) return rows;
    const re = /(\w+):(\w+)!(\w+)\(\*\)/g;
    let m;
    const embeds = [];
    while ((m = re.exec(select))) embeds.push({ alias: m[1], table: m[2], fk: m[3] });
    if (!embeds.length) return rows;
    return rows.map(row => {
      const out = { ...row };
      for (const e of embeds) out[e.alias] = (db[e.table] || []).find(x => x.id === row[e.fk]) || null;
      return out;
    });
  }

  function rest(method, table, params, body, headers) {
    if (!db[table]) { db[table] = []; unknown.push({ kind: 'table', table, method }); }
    const filters = [...params.entries()].filter(([k]) => !RESERVED.has(k));
    const filtered = () => db[table].filter(row => filters.every(([k, v]) => {
      if (k === 'or' || k === 'and') { unknown.push({ kind: 'logic-filter', k, v }); return true; }
      return matches(row, k, v);
    }));
    const single = /vnd\.pgrst\.object/.test(headers.accept || '');
    const respond = rows => {
      if (single) {
        if (rows.length !== 1) return { status: 406, json: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${rows.length} rows`, hint: null } };
        return { status: 200, json: rows[0] };
      }
      return { status: 200, json: rows };
    };
    if (method === 'GET' || method === 'HEAD') {
      let rows = filtered();
      const select = params.get('select') || '*';
      if (/^\s*count\s*$/.test(select)) return { status: 200, json: [{ count: rows.length }] };
      const order = params.get('order');
      if (order) {
        const [col, dir] = order.split(',')[0].split('.');
        rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1));
      }
      const offset = Number(params.get('offset') || 0);
      const limit = params.get('limit');
      rows = rows.slice(offset, limit ? offset + Number(limit) : undefined);
      rows = embed(rows, select);
      const r = respond(rows);
      r.headers = { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` };
      return r;
    }
    if (method === 'POST') {
      const items = (Array.isArray(body) ? body : [body]).map(item => ({ id: uuid(), created_at: now(), updated_at: now(), ...item }));
      const conflict = params.get('on_conflict');
      const out = [];
      for (const item of items) {
        const key = conflict || 'id';
        const existing = db[table].find(r => key.split(',').every(k => r[k] === item[k]));
        if (existing && /resolution=merge-duplicates/.test(headers.prefer || '')) { Object.assign(existing, item); out.push(existing); continue; }
        if (existing && /resolution=ignore-duplicates/.test(headers.prefer || '')) { out.push(existing); continue; }
        if (existing) return { status: 409, json: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        db[table].push(item); out.push(item);
      }
      return respond(out);
    }
    if (method === 'PATCH') {
      const rows = filtered();
      rows.forEach(r => Object.assign(r, body));
      return respond(rows);
    }
    if (method === 'DELETE') {
      const rows = filtered();
      db[table] = db[table].filter(r => !rows.includes(r));
      return respond(rows);
    }
    return { status: 405, json: {} };
  }

  async function handle(route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const headers = request.headers();
    let body = null;
    try { body = request.postData() ? JSON.parse(request.postData()) : null; } catch { body = request.postData(); }
    const cors = {
      'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,PUT,OPTIONS,HEAD', 'access-control-expose-headers': '*',
    };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let result;
    const path = url.pathname;
    if (path.startsWith('/rest/v1/rpc/')) {
      unknown.push({ kind: 'rpc', fn: path.slice(13) });
      result = { status: 200, json: null };
    } else if (path.startsWith('/rest/v1/')) {
      result = rest(method, path.slice(9), url.searchParams, body, headers);
    } else if (path === '/functions/v1/assessment-api') {
      result = assessmentApi(body || {}, headers['x-application-user-id']);
      assessmentCalls.push({ at: now(), operation: body?.operation, header: headers['x-application-user-id'] ?? null, body, status: result.status });
    } else if (path.startsWith('/functions/v1/')) {
      unknown.push({ kind: 'function', path });
      result = { status: 503, json: { ok: false, error: { code: 'MOCK_UNAVAILABLE', message: 'mocked provider unavailable', retryable: false } } };
    } else if (path.startsWith('/storage/v1/')) {
      result = { status: 404, json: { error: 'not found' } };
    } else if (path.startsWith('/auth/v1/')) {
      result = { status: 200, json: {} };
    } else {
      unknown.push({ kind: 'path', path });
      result = { status: 404, json: {} };
    }
    return route.fulfill({ status: result.status, headers: { ...cors, 'content-type': 'application/json', ...(result.headers || {}) }, body: JSON.stringify(result.json) });
  }

  // Realtime: accept the socket and acknowledge joins/heartbeats so the client stays quiet.
  function realtime(ws) {
    ws.onMessage(message => {
      let m; try { m = JSON.parse(String(message)); } catch { return; }
      const reply = (payload) => ws.send(JSON.stringify({ topic: m.topic, event: 'phx_reply', payload, ref: m.ref, join_ref: m.join_ref }));
      if (m.event === 'phx_join') reply({ status: 'ok', response: { postgres_changes: (m.payload?.config?.postgres_changes || []).map((c, i) => ({ ...c, id: i + 1 })) } });
      else reply({ status: 'ok', response: {} });
    });
  }

  return { db, visits, claims, assessmentCalls, unknown, handle, realtime, MOCK_ORIGIN };
}

module.exports = { createBackend, MOCK_ORIGIN };
