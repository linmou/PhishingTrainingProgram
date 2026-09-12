#!/usr/bin/env node
/**
 * Purpose: seed the two manual-test rooms for the student rating gate
 * (case A: pre-populated tutor line only; case B: pre-populated line plus a
 * persisted unrated AI/tutor reply). Re-running resets both rooms.
 *
 * Usage: node scripts/create-rating-test-rooms.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const supabase = createClient(env.REACT_APP_SUPABASE_URL, env.REACT_APP_SUPABASE_ANON_KEY);

const TUTOR_ID = process.env.TEST_TUTOR_ID || '1218b752-21d7-4319-a415-5113740a1218';
const TITLES = {
  a: 'Rating check A - seeded dialogue only',
  b: 'Rating check B - seeded dialogue plus real reply'
};
const DIALOGUE = [
  { role: 'others', user_name: 'Friend', message: 'did you get the alert about your account?' },
  { role: 'tutor', user_name: 'Smoke Tutor', message: 'Let us look at that message together. What stands out to you first?' },
  { role: 'student', user_name: 'You', message: 'it says my account will be locked in 1 hour' }
];

const createRoom = async (title, description, dialogue) => {
  const { data, error } = await supabase
    .from('rooms')
    .insert({ tutor_id: TUTOR_ID, title, description, is_active: true, ai_assistant_enabled: false, pre_populated_dialogue: dialogue })
    .select('id')
    .single();
  if (error) throw new Error(`${title}: ${error.message}`);
  return data.id;
};

(async () => {
  for (const title of Object.values(TITLES)) {
    const { error } = await supabase.from('rooms').delete().eq('title', title);
    if (error) throw new Error(`reset ${title}: ${error.message}`);
  }

  const roomA = await createRoom(TITLES.a, 'Case A: the only tutor turn is pre-populated. Expected: send a reply, no rating dialog.', DIALOGUE);
  const roomB = await createRoom(TITLES.b, 'Case B: a real unrated tutor reply sits beside the pre-populated lines. Expected: rating dialog appears and shows the real reply.', DIALOGUE);

  const { error: msgError } = await supabase.from('messages').insert({
    room_id: roomB,
    user_id: TUTOR_ID,
    content: 'REAL REPLY (persisted, unrated): check the sender address before you click anything.',
    user_role: 'tutor',
    is_ai_generated: true
  });
  if (msgError) throw new Error(`room B message: ${msgError.message}`);

  console.log('room A (pre-populated only)        :', roomA, `-> http://localhost:3001/#/room/${roomA}`);
  console.log('room B (pre-populated + real reply):', roomB, `-> http://localhost:3001/#/room/${roomB}`);
})();
