# Intent
Record how tutors can open website rooms that use the improved AI tutor prompt from user feedback fixes.

## Date
- 2026-07-18

## Scope
- Seeded/updated global `room_templates` with improved `casual_peer` AI config and starter student messages.
- Room creation from those templates now enables AI automatically.
- Added re-seed script and unit coverage.

## How to use on the website
1. Log in as a tutor.
2. Create a new room.
3. Choose a template:
   - `Demo: Lock Icon Myth (Direct Correction)`
   - `Demo: Click Impulse (Practical Action)`
   - `Demo: Pressure Words (Simple Language)`
   - `Demo: Personal Story Trap (Third Person)`
   - or refreshed classics (`Account Security Alert Scam`, etc.)
4. Create the room (AI is auto-enabled with the improved prompt).
5. Open the room as tutor and generate an AI suggestion against the pre-seeded student message.

## Re-seed command
```bash
cd tutor-system
npm run seed:behavior-templates
```

## Files
- `src/services/demoRoomTemplates.ts`
- `scripts/seed-behavior-demo-templates.js`
- `src/pages/TutorView.tsx` (apply AI on template create)
- tests for templates + create flow

## Live seed result
- updated 3 classic templates
- inserted 4 Demo templates
- all ship improved prompt markers
