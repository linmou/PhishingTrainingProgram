# 01 — Behavior and user experience

**Behavior ID:** `multi-character-demo`.
**Status:** proposed implementation specification, not an adopted revision of the global tutor policy or an evaluated prompt version.

The user authorized the simulated misleading-character concept. The specific routing rules below are implementation defaults. The exception permitting a fictional character to make a wrong argument is local to this demonstration; it does not authorize the tutor to give wrong advice or change the policy for ordinary rooms.

## 1. Character responsibilities

**Tutor (`tutor`).** Retain the normal tutor's educational role: guide phishing analysis, distinguish genuine confusion from demonstrated understanding, protect against an imminent unsafe action, correct a misconception when appropriate, and work on one relevant target at a time. Use the familiar label **AI Tutor** in this standalone page. Preserve its supportive, plain-language voice; do not invent a second tutor personality.

**Riley (`misleading_peer`).** Add one simulated participant who advocates a tempting wrong choice using a plausible misconception, shortcut, or social-pressure argument grounded in the supplied scenario. Riley is not another helpful tutor, a random source of nonsense, or a real student. The human editor identifies the role as “Riley — misleading participant”; the learner preview identifies the speaker as “Riley · AI participant.”

At the top of the learner preview, display: **“Simulated phishing-training discussion. AI participants may give poor advice; evaluate their claims. Use fictional information only.”** Render all scenario and message content as text, not active links, HTML, or executable instructions.

## 2. Observable requirements

### MC-01 — One coherent sequence

**Trigger:** a learner submits a message, or the tutor regenerates an unsent draft.
**Result:** author the complete next sequence in one model call. Permit exactly `[tutor]` or `[misleading_peer, tutor]`. In a pair, the two messages address the same immediate learning target and the tutor responds coherently to the peer's proposal. Do not invent an intervening learner reply.
**Grounding:** the requested multi-character experience, bounded turn-taking, and the existing tutor's single-target teaching behavior. This changes presentation and the demo output contract, not the ordinary tutor API.

### MC-02 — The misleading role must actually mislead

**Trigger:** a contrast sequence is appropriate because there is a relevant unexamined misconception or tempting shortcut.
**Result:** Riley presents one plausible wrong recommendation, tied to an actual scenario detail. The contribution should make the learner evaluate a claim, not announce the correct answer. Do not turn Riley into a cautious second tutor or an obviously absurd villain.
**Boundary:** Riley may recommend a wrong choice *inside the fictional scenario*. The application does not solicit real credentials, money, private links, or real-world harmful actions; it provides no actionable links or tools. No fabricated personal experience, relationship, or verified authority is needed for the role.
**Grounding:** the user's explicit new-character goal, scoped to a disclosed training simulation. This is a role-specific exception; it does not apply to the tutor.

### MC-03 — Tutor guidance remains trustworthy

**Trigger:** the tutor speaks, whether alone or after Riley.
**Result:** tutor content is factually sound and focused. For a useful contrast, give a foothold and invite the learner to examine the bad recommendation rather than mechanically providing the full answer. When direct protection or correction is needed, provide it instead of insisting on a question.
**Boundary:** the tutor must not endorse Riley's false premise, shame the learner, claim that a tool certified safety, or invent facts about a sender or official website. A pair should normally end with at most one learner-directed question. Target at most two short sentences and roughly 35 words per message; this is a content-review target, not a brittle sentence-count parser rule.
**Grounding:** core instructional and content-precision behavior in the inspected active tutor prompt; the Guard participation state machine is outside this demo.

### MC-04 — Tutor-only overrides theatrical contrast

Select the pattern using this priority order:

| Learner/context evidence | Required response pattern |
|---|---|
| Learner intends to click/open/use a suspect page, submit real information, or act on unsafe advice now | Tutor only: first stop that action and give a safe independent alternative |
| Learner has adopted the wrong recommendation, or repeated a wrong answer after a focused scaffold | Tutor only: directly correct the particular inference and give the connected safe step |
| Learner is distressed, asks to stop, or asks for a direct clarification | Tutor only: address the immediate request; no added pressure |
| Learner correctly rejected the same bait or demonstrated the current point | Tutor only: recognize actual evidence and advance/consolidate; do not repeat the resolved bait |
| A new, relevant misconception or shortcut would create a meaningful comparison | Riley then tutor |
| No useful grounded misleading contribution exists | Tutor only |

Distinguish *the learner's own intention* from quotation. “Riley said to click; I disagree” is not the learner intending to click. Riley's earlier unsafe proposal alone does not force the tutor-only route on every subsequent turn.

**Grounding:** safety/correction before scaffolding; progression follows actual learner evidence. These are explicit defaults to avoid unresolved behavior choices during coding.

### MC-05 — Attribute evidence to the right participant

**Trigger:** build the next model input or interpret conversation history.
**Result:** preserve `speakerId` on every message. Only `learner` messages are learner evidence. Riley's wrong claims are not student errors; the tutor's explanations are not proof of student understanding. Generated-but-unsent messages and private reasons never enter the delivered transcript.
**Grounding:** the inspected tutor policy's learner-evidence rule, applied to the new character distinction. No checklist or mastery database is updated in this demo.

### MC-06 — Human review is the publication boundary

**Trigger:** a generation returns valid output.
**Result:** show it only in the tutor control panel. Each message has a labeled textarea. Nothing reaches the learner preview until **Approve & send**. Publish the edited text, not the original AI text. After approval, freeze a copy for playback so UI changes cannot mutate it.
**Grounding:** the existing human-reviewed response workflow and the user's requested multi-message editor.

### MC-07 — Turn taking is deliberately non-interruptible

**Trigger:** the learner submits a message.
**Result:** immediately lock further learner submissions through generation, review, and playback. Allow typing, but reject submission in the handler/state transition as well as disabling the button. Re-enable submission after the final message, an explicit pre-publication discard, or Reset.
**Grounding:** the user's instruction to choose the lowest-coordination implementation. This is a local interaction guarantee, not a distributed or security guarantee.

## 3. Example to guide meaning, not exact wording

**Scenario:** a fictional campus-service alert says the account expires soon. It shows a familiar logo and asks the recipient to use a supplied link.

**Learner:** “The logo looks familiar, so it is probably fine.”

**Riley:** “The familiar logo makes it look official. Following the message's instructions seems quicker than checking somewhere else.”

**AI Tutor:** “Riley is using appearance as evidence of who sent it. What independent check would you make before trusting that recommendation?”

The tutor does not ask a question before the queued second message. The learner answers only after the pair has been published.

**Next learner:** “I'll use the real app instead of that link.”

**Next tutor:** acknowledge independent checking and address another unmet supplied target if appropriate. Do not regenerate the same logo bait simply to give Riley equal airtime.

## 4. Page and editor

Use two labeled regions: **Learner preview** and **Tutor controls**. The preview contains scenario text, delivered messages, an optional “AI Tutor is preparing a response…” interval indicator, and a learner textbox. The controls contain the private reason, one or two message cards, generation status, and actions.

Before the first learner message, the operator may edit the scenario title, description, and a short list of learning targets. These fields lock once the session starts. Reset unlocks them. Start with one fictional example; multiple templates, room importing, and scenario-image handling are not required.

Editor operations:

- Edit the text of each message. Speakers and order remain fixed.
- Remove the optional Riley card; the tutor card always remains.
- Add a blank Riley card before the tutor when there is only a tutor card. This is a manual edit requiring human review, not an automatic override of the model's safety judgment.
- Regenerate the entire unsent sequence. On failure, retain the existing edited draft and show an error.
- Discard the unsent sequence, keeping the learner's already delivered message in the transcript.
- Approve once to send the complete valid sequence. Disable approval on empty text or invalid shape.

During playback, text editing, regeneration, discard, scenario edits, and additional approvals are disabled. First message appears immediately; second appears after 3,000 ms. Use **Reset demo** as the sole playback-cancellation control: it clears the complete session, cancels timers/requests, and returns to scenario setup. This intentionally avoids partial-send recovery, pause/resume, and stopping after a misleading message while preserving it as the final advice.

Reset is enabled in every phase. Warn in the UI that it clears local work; offer **Export session JSON** before resetting, but do not implement automatic saving or importing in this version. Navigation away/unmount also cancels pending local work.

## 5. Explicit demo boundaries

There are no separate AI memories, automated agent-to-agent loops, character accounts, character configuration dashboards, global room-mode changes, automatic assessments, Guard transitions, mandatory ratings, or educational-effectiveness claims. In particular, this demo tests **a guided contrast followed by the learner's response**, not the learner's ability to resist Riley before hearing the tutor.
