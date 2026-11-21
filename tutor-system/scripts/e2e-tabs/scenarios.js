// Purpose: two-tab identity journeys (#109). Each scenario gets a fresh harness `h` (see harness.js)
// and records its checks with h.check; a scenario passes when every check passes and it does not throw.
'use strict';

const { signIn, seedRoom, userRow, seatLearner, USER_KEY } = require('./harness');

const NOTICE = 'You signed out or switched account in another tab. Sign in again to continue.';
const brief = rows => rows.map(r => ({ tab: r.tab, op: r.operation || `${r.method} ${r.path}`, appUser: r.appUser }));

// A full document load: a hash-only goto to the current URL would not remount the page.
async function load(page, url) {
  await page.goto('about:blank');
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}
async function signOutViaProfile(page, app) {
  await load(page, `${app}/#/profile`);
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await page.waitForFunction(key => !localStorage.getItem(key), USER_KEY);
}
async function expectSignedOutNotice(page) {
  await page.getByRole('alert').filter({ hasText: NOTICE }).waitFor({ timeout: 10000 });
  return { hash: await page.evaluate(() => location.hash), loginVisible: await page.getByPlaceholder('Enter your name').isVisible() };
}
const signedOutToSignIn = state => state.hash === '#/' && state.loginVisible;
async function openRoom(page, app, roomId) {
  await load(page, `${app}/#/room/${roomId}`);
  await page.getByText('Discussion (').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
}
async function typeTargets(page, lines) {
  if (!(await page.getByRole('button', { name: 'Enter Manually' }).isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /Learning Progress/ }).first().click();
  }
  await page.getByRole('button', { name: 'Enter Manually' }).click();
  await page.getByLabel('Detection Areas').fill(lines.join('\n'));
}
async function saveTargets(page, lines) {
  await typeTargets(page, lines);
  await page.locator('button[type="submit"]').filter({ hasText: /Save|Create|Submit|Set/ }).first().click();
  await page.waitForTimeout(2000);
}
async function isSignedInOnProfile(page, app) {
  await load(page, `${app}/#/profile`);
  const signOut = await page.getByRole('button', { name: 'Sign Out' }).waitFor({ timeout: 10000 }).then(() => true, () => false);
  await page.waitForTimeout(1500); // a late restore failure would redirect to sign-in
  return signOut && (await page.evaluate(() => location.hash)) === '#/profile';
}

async function A(h) {
  const a = await h.tab('A');
  const tutor = await signIn(a, h.app, 'Tess Tutor', 'tutor');
  const room = seedRoom(h.backend, tutor.id, 'Scenario A Room');
  await openRoom(a, h.app, room.id);
  const b = await h.tab('B');
  await load(b, `${h.app}/#/tutor`);
  const from = h.mark();
  await signOutViaProfile(b, h.app);
  const state = await expectSignedOutNotice(a);
  h.check('A shows the notice and lands on sign-in when B signs out', signedOutToSignIn(state), state);
  await a.waitForTimeout(4000); // room unmount, timers and realtime refetches
  const after = h.since(from, r => r.tab === 'A');
  h.check('A sends no assessment-api call after sign-out', h.assessment(from, 'A').length === 0, brief(h.assessment(from, 'A')));
  h.check('A sends no request carrying a user id after sign-out', after.every(r => !r.appUser), brief(after.filter(r => r.appUser)));
  h.check('A sends no REST write after sign-out', after.every(r => ['GET', 'HEAD'].includes(r.method)), brief(after));
  const from2 = h.mark();
  await signIn(b, h.app, 'Tess Tutor', 'tutor');
  await a.waitForTimeout(2500);
  h.check('A stays signed out when B signs the same tutor in again', await a.getByPlaceholder('Enter your name').isVisible());
  h.check('A sends no assessment-api call after B signs in again', h.assessment(from2, 'A').length === 0, brief(h.assessment(from2, 'A')));
  await h.snap(a, 'A-signed-out');
}

async function B(h) {
  // B1: tab B still shows the sign-in form from before tab A signed in; a student signs in there.
  const b = await h.tab('B');
  await load(b, `${h.app}/`);
  await b.getByPlaceholder('Enter your name').waitFor();
  const a = await h.tab('A');
  const tutor = await signIn(a, h.app, 'Tess Tutor', 'tutor');
  const room = seedRoom(h.backend, tutor.id, 'Scenario B Room');
  await openRoom(a, h.app, room.id);
  const from = h.mark();
  await b.getByPlaceholder('Enter your name').fill('Stu Beta');
  await b.locator('input[type="radio"][value="student"]').check();
  await b.locator('form button[type="submit"]').first().click();
  await b.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').current_role === 'student', USER_KEY);
  const student = await b.evaluate(key => JSON.parse(localStorage.getItem(key)), USER_KEY);
  const state = await expectSignedOutNotice(a);
  h.check('B1: A signs out with the notice when B signs in a different user', signedOutToSignIn(state), state);
  await a.waitForTimeout(4000);
  h.check('B1: A sends no join_room or other assessment-api call', h.assessment(from, 'A').length === 0, brief(h.assessment(from, 'A')));
  h.check('B1: no request from A carries the student id', h.since(from, r => r.tab === 'A' && r.appUser === student.id).length === 0);
  // B2: A is the tutor in the room again; B signs out, signs in another student and opens the room link.
  await signOutViaProfile(b, h.app);
  await signIn(a, h.app, 'Tess Tutor', 'tutor');
  await openRoom(a, h.app, room.id);
  const from2 = h.mark();
  await signOutViaProfile(b, h.app);
  const student2 = await signIn(b, h.app, 'Stu Gamma', 'student');
  await expectSignedOutNotice(a);
  await openRoom(b, h.app, room.id);
  await a.waitForTimeout(3000);
  h.check('B2: A sends no assessment-api call after B signs in another student', h.assessment(from2, 'A').length === 0, brief(h.assessment(from2, 'A')));
  h.check('B2: no request from A carries the second student id', h.since(from2, r => r.tab === 'A' && r.appUser === student2.id).length === 0);
  h.check('No seat claimed by any tab', h.backend.claims.length === 0, h.backend.claims);
  await h.snap(a, 'A-signed-out');
}

async function C(h) {
  const a = await h.tab('A');
  const tutor = await signIn(a, h.app, 'Tess Tutor', 'tutor');
  const room = seedRoom(h.backend, tutor.id, 'Scenario C Room');
  const learner = userRow('Lena Learner', 'student');
  h.backend.db.users.push(learner);
  seatLearner(h.backend, room, learner);
  await openRoom(a, h.app, room.id);
  const b = await h.tab('B');
  await load(b, `${h.app}/#/profile`);
  await b.getByRole('button', { name: 'Edit Profile' }).click();
  await b.getByPlaceholder('Enter your display name').fill('Tess Renamed');
  await b.getByRole('button', { name: 'Save' }).click();
  await b.getByText('Profile updated successfully!').waitFor();
  await a.getByText('Tess Renamed').first().waitFor({ timeout: 8000 }).catch(() => {});
  await a.waitForTimeout(1500);
  const hash = await a.evaluate(() => location.hash);
  h.check('A stays in the room', hash === `#/room/${room.id}`, hash);
  h.check('A shows no signed-out notice', (await a.getByRole('alert').filter({ hasText: NOTICE }).count()) === 0);
  h.check('A shows the new display name in place', await a.getByText('Tess Renamed').first().isVisible());
  h.check('A no longer shows the old display name', (await a.getByText('Tess Tutor', { exact: true }).count()) === 0);
  const from = h.mark();
  await saveTargets(a, ['Urgent language pressure']);
  const init = h.assessment(from, 'A').filter(r => r.operation === 'initialize_checklist');
  h.check('A still acts as the same tutor id', init.length === 1 && init[0].appUser === tutor.id, brief(init));
  await h.snap(a, 'A-renamed');
}

async function D(h) {
  const a = await h.tab('A');
  const tutor = await signIn(a, h.app, 'Tess Tutor', 'tutor');
  const room = seedRoom(h.backend, tutor.id, 'Scenario D Room');
  const from0 = h.mark();
  await openRoom(a, h.app, room.id);
  h.check('Owner sees no "Join as learner" button', (await a.getByRole('button', { name: 'Join as learner' }).count()) === 0);
  h.check('Owner opening the link sends no join_room and claims nothing',
    h.backend.claims.length === 0 && h.assessment(from0).filter(r => r.operation === 'join_room').length === 0, brief(h.assessment(from0)));
  await signOutViaProfile(a, h.app);
  const student = await signIn(a, h.app, 'Stu Alpha', 'student');
  const from1 = h.mark();
  await openRoom(a, h.app, room.id);
  h.check('Student direct link: no join_room and no claim on open',
    h.assessment(from1).filter(r => r.operation === 'join_room').length === 0 && h.backend.claims.length === 0, brief(h.assessment(from1)));
  h.check('Student direct link: read-only, "This room has no learner yet." and Join as learner',
    await a.getByText('You are in observer mode').isVisible() && await a.getByText('This room has no learner yet.').isVisible()
      && await a.getByRole('button', { name: 'Join as learner' }).isVisible() && (await a.getByPlaceholder('Write a comment...').count()) === 0);
  const from2 = h.mark();
  await a.getByRole('button', { name: 'Join as learner' }).click();
  await a.getByRole('button', { name: 'Join as learner' }).waitFor({ state: 'detached', timeout: 8000 });
  await a.waitForTimeout(1000);
  const joins = h.assessment(from2).filter(r => r.operation === 'join_room');
  h.check('One click sends one join_room with a visit_key as the student',
    joins.length === 1 && Boolean(joins[0].body.visit_key) && joins[0].appUser === student.id, brief(joins));
  h.check('One claim and one visit', h.backend.claims.length === 1 && h.backend.claims[0].user_id === student.id && h.backend.visits.length === 1,
    { claims: h.backend.claims.length, visits: h.backend.visits.length });
  const composer = a.getByPlaceholder('Write a comment...');
  await composer.fill('Hello, I am the learner now.');
  const from3 = h.mark();
  await composer.press('Enter');
  await a.getByText('Hello, I am the learner now.').first().waitFor({ timeout: 8000 }).catch(() => {});
  await a.waitForTimeout(1000);
  const posts = h.assessment(from3).filter(r => r.operation === 'post_message');
  h.check('The learner can post', posts.length === 1 && posts[0].appUser === student.id && h.backend.db.messages.length === 1, brief(posts));
  await h.snap(a, 'learner-posted');
}

async function E(h) {
  const tutor = userRow('Tess Tutor', 'tutor');
  h.backend.db.users.push(tutor);
  seedRoom(h.backend, tutor.id, 'Scenario E Room');
  const a = await h.tab('A');
  const student = await signIn(a, h.app, 'Stu Alpha', 'student');
  await load(a, `${h.app}/#/student`);
  await a.getByRole('heading', { name: 'Scenario E Room' }).waitFor({ timeout: 15000 });
  const from1 = h.mark();
  await a.getByRole('button', { name: 'Join Room' }).first().click();
  await a.waitForURL(/#\/room\//);
  await a.getByText('Discussion (').first().waitFor();
  await a.waitForTimeout(2000);
  const joins1 = h.assessment(from1).filter(r => r.operation === 'join_room');
  h.check('Join: one claim and one visit, every join_room as the student',
    h.backend.claims.length === 1 && h.backend.visits.length === 1 && joins1.every(r => r.appUser === student.id),
    { claims: h.backend.claims.length, visits: h.backend.visits.length, joins: brief(joins1) });
  h.check('Join: composer available, no "Join as learner"',
    (await a.getByRole('button', { name: 'Join as learner' }).count()) === 0 && await a.getByPlaceholder('Write a comment...').isVisible());
  await load(a, `${h.app}/#/student`);
  await a.getByRole('button', { name: 'Rejoin Room' }).waitFor({ timeout: 15000 });
  const from2 = h.mark();
  await a.getByRole('button', { name: 'Rejoin Room' }).click();
  await a.waitForURL(/#\/room\//);
  await a.getByText('Discussion (').first().waitFor();
  await a.waitForTimeout(2000);
  const joins2 = h.assessment(from2).filter(r => r.operation === 'join_room');
  // The dev server's StrictMode repeats the entry effect; a repeat reuses the same visit_key, so it is idempotent.
  const keys2 = [...new Set(joins2.map(r => r.body.visit_key))];
  h.check('Rejoin: join_room carries one new visit_key; still one claim, two visits',
    joins2.length >= 1 && keys2.length === 1 && Boolean(keys2[0]) && keys2[0] !== h.backend.visits[0].visit_key
      && h.backend.claims.length === 1 && h.backend.visits.length === 2,
    { claims: h.backend.claims.length, visits: h.backend.visits.length, joins: brief(joins2) });
  await h.snap(a, 'after-rejoin');
}

async function F(h) {
  const a = await h.tab('A');
  const tutor = await signIn(a, h.app, 'Tess Tutor', 'tutor');
  const learner = userRow('Lena Learner', 'student');
  h.backend.db.users.push(learner);
  const room = seedRoom(h.backend, tutor.id, 'Scenario F Room');
  seatLearner(h.backend, room, learner);
  await openRoom(a, h.app, room.id);
  const from1 = h.mark();
  await saveTargets(a, ['Urgent language pressure', 'Suspicious sender address']);
  const init = h.assessment(from1, 'A').filter(r => r.operation === 'initialize_checklist');
  h.check('F1: one initialize_checklist with the tutor id and the learner',
    init.length === 1 && init[0].appUser === tutor.id && init[0].body.student_id === learner.id, brief(init));
  h.check('F1: saved (checklist stored, no "not saved" alert)',
    h.backend.db.session_checklists.length === 1 && (await a.getByText('Learning targets are not saved').count()) === 0);
  // F2: targets typed but unsaved when another tab signs out.
  const room2 = seedRoom(h.backend, tutor.id, 'Scenario F2 Room');
  seatLearner(h.backend, room2, learner);
  await openRoom(a, h.app, room2.id);
  await typeTargets(a, ['Mismatched link text']);
  const b = await h.tab('B');
  const from2 = h.mark();
  await signOutViaProfile(b, h.app);
  const state = await expectSignedOutNotice(a);
  await a.waitForTimeout(3000);
  h.check('F2: A is signed out with the notice instead of saving', signedOutToSignIn(state), state);
  h.check('F2: A sends no assessment-api call and nothing more is stored',
    h.assessment(from2, 'A').length === 0 && h.backend.db.session_checklists.length === 1, brief(h.assessment(from2, 'A')));
  await h.snap(a, 'F2-signed-out');
}

async function G(h) {
  const a = await h.tab('A');
  await signIn(a, h.app, 'Tess Tutor', 'tutor');
  h.check('Signed-in tab shows the profile', await isSignedInOnProfile(a, h.app));
  await a.reload({ waitUntil: 'domcontentloaded' });
  await a.getByRole('button', { name: 'Sign Out' }).waitFor({ timeout: 10000 }).catch(() => {});
  await a.waitForTimeout(1500);
  h.check('Reload restores the session', await a.getByRole('button', { name: 'Sign Out' }).isVisible()
    && (await a.evaluate(() => location.hash)) === '#/profile', await a.evaluate(() => location.hash));
  const b = await h.tab('B');
  h.check('A new tab restores the session', await isSignedInOnProfile(b, h.app), await b.evaluate(() => location.hash));
  const skipped = h.consoleLog.filter(c => /not restoring it/.test(c.text));
  h.check('No restore was discarded', skipped.length === 0, skipped.map(c => `${c.tab}: ${c.text}`));
  h.check('The stored user is still there', await a.evaluate(key => Boolean(localStorage.getItem(key)), USER_KEY));
  await h.snap(b, 'new-tab-restored');
}

// H: initialize_checklist is held in flight while another tab signs out. Its follow-up
// (read_learning_evidence) must not go out without the tab identity.
async function H(h) {
  const a = await h.tab('A');
  const tutor = await signIn(a, h.app, 'Tess Tutor', 'tutor');
  const learner = userRow('Lena Learner', 'student');
  h.backend.db.users.push(learner);
  const room = seedRoom(h.backend, tutor.id, 'Scenario H Room');
  seatLearner(h.backend, room, learner);
  await openRoom(a, h.app, room.id);
  const b = await h.tab('B');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await h.context.route('**/functions/v1/assessment-api', async route => {
    if (JSON.parse(route.request().postData() || '{}').operation === 'initialize_checklist') await gate;
    return route.fallback();
  });
  const from = h.mark();
  const saving = saveTargets(a, ['Spoofed display name']).catch(error => error);
  await a.waitForTimeout(1500);
  await signOutViaProfile(b, h.app);
  await expectSignedOutNotice(a);
  release();
  await saving;
  await a.waitForTimeout(2500);
  const calls = h.assessment(from, 'A');
  h.check('Only the in-flight save went out, with the tutor id; no follow-up after sign-out',
    calls.length === 1 && calls[0].operation === 'initialize_checklist' && calls[0].appUser === tutor.id, brief(calls));
  h.check('A stays signed out', await a.getByPlaceholder('Enter your name').isVisible());
  await h.snap(a, 'signed-out-after-inflight-save');
}


// Persisted learner state is visible to the owner, independently of local target drafts.
async function I(h) {
  const page = await h.tab('Owner');
  const tutor = await signIn(page, h.app, 'Irene Tutor', 'tutor');
  const empty = seedRoom(h.backend, tutor.id, 'I Empty room');
  await openRoom(page, h.app, empty.id);
  await page.getByText('No learner yet', { exact: true }).waitFor();
  h.check('I empty room identifies that there is no learner', true);
  await h.snap(page, 'owner-no-learner');

  const saved = seedRoom(h.backend, tutor.id, 'I Saved targets');
  const unsaved = seedRoom(h.backend, tutor.id, 'I Unsaved targets');
  const quiet = seedRoom(h.backend, tutor.id, 'I Quiet learner');
  const learners = ['Sally Saved', 'Uma Unsaved', 'Quinn Quiet'].map(name => userRow(name, 'student'));
  h.backend.db.users.push(...learners);
  [saved, unsaved, quiet].forEach((room, index) => {
    seatLearner(h.backend, room, learners[index]);
    h.backend.db.sessions.at(-1).started_at = '2026-11-01T12:00:00Z';
  });
  h.backend.db.session_checklists.push({ id: 'i-saved-checklist', room_id: saved.id, student_id: learners[0].id });
  h.backend.db.messages.push({ id: 'i-student-message', room_id: unsaved.id, user_id: learners[1].id,
    user_role: 'student', content: 'I am learning here.', created_at: new Date().toISOString() });
  // A checklist for a different learner never establishes that this learner's targets were saved.
  h.backend.db.session_checklists.push({ id: 'i-other-checklist', room_id: unsaved.id, student_id: learners[0].id });
  await openRoom(page, h.app, unsaved.id);
  const warning = 'Targets not saved: learner progress is not being recorded';
  await page.getByText(warning, { exact: true }).waitFor();
  h.check('I owner sees current learner, join time and missing-target warning',
    await page.getByText(/Learner: Uma Unsaved.*Joined/).isVisible());
  await h.snap(page, 'owner-unsaved-targets');
  await openRoom(page, h.app, saved.id);
  await page.getByText('Targets saved', { exact: true }).waitFor();
  h.check('I only a persisted checklist for this learner shows Targets saved', true);
  await h.snap(page, 'owner-saved-targets');

  await load(page, `${h.app}/#/tutor`);
  const card = title => page.getByTestId('room-item').filter({ hasText: title });
  await card('I Unsaved targets').getByText(warning, { exact: true }).waitFor();
  h.check('I dashboard warns for the chatting learner with no saved targets',
    await card('I Unsaved targets').getByText('Learner: Uma Unsaved', { exact: true }).isVisible());
  await card('I Quiet learner').getByText('Learner: Quinn Quiet', { exact: true }).waitFor();
  h.check('I dashboard does not warn before the learner has sent a message',
    await card('I Quiet learner').getByText(warning, { exact: true }).count() === 0);
  await card('I Saved targets').getByText('Targets saved', { exact: true }).waitFor();
  await h.snap(page, 'dashboard-learner-status');

  await signOutViaProfile(page, h.app);
  await signIn(page, h.app, 'I Observer', 'observer');
  await openRoom(page, h.app, unsaved.id);
  h.check('I observer does not see tutor learner or target status',
    await page.getByText(/^Learner:/).count() === 0 && await page.getByText(warning, { exact: true }).count() === 0);
  await h.snap(page, 'observer-no-tutor-status');
}

module.exports = {
  A: { title: 'Cross-tab sign-out', run: A },
  B: { title: 'Different user in another tab', run: B },
  C: { title: 'Display-name-only change updates in place', run: C },
  D: { title: 'Direct link to an empty room: Join as learner', run: D },
  E: { title: 'Room-list Join then Rejoin', run: E },
  F: { title: 'Learning-target save carries the tutor id', run: F },
  G: { title: 'Reload and new tab restore the session', run: G },
  H: { title: 'In-flight save sends no headerless follow-up', run: H },
  I: { title: 'Tutor sees server learner and saved-target status', run: I },
};
