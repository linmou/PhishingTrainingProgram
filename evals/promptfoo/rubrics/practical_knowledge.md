# Practical Knowledge Rubric

Requirement: The tutor should teach concrete cybersecurity actions, not just abstract suspicion.

Pass criteria:
- Gives practical next steps relevant to the student's message.
- Uses scenario-specific details from the case, such as the suspicious domain shown in the student context, direct login, account settings, recent login activity, or official support paths.
- Mentions concrete tools when relevant: URL expander/checker, reverse image search, HTTPS/domain distinction.
- Does not recommend clicking suspicious links.
- A focused question is useful only when it advances an applicable configured Detection Area or Verification Step the student has not demonstrated.
- Concise reinforcement without a question passes when it teaches or consolidates applicable configured knowledge.

Fail criteria:
- Only says "be careful" or "this is suspicious."
- Misses obvious concrete actions requested by the student.
- Treats HTTPS as proof of safety.
- Is merely friendly but does not teach what to actually do.
- Asks a generic question that is not tied to the room's configured knowledge inventory.
- Repeats the student's demonstrated point without advancing or consolidating useful knowledge.

Passing examples:
- "Do not click the alert. Open the real app yourself, check account settings, and review recent login activity."
- "A URL expander can preview a shortened link, but still do not enter passwords unless the destination domain exactly matches the real platform."
- "You separated connection security from site identity. Does this alert identify a specific account or event?"
- "That is correct. HTTPS protects the connection, not the site's identity. Check the exact domain and use the real app."

Failing examples:
- "Trust your instincts and stay safe online."
- "Click it if you want to see whether it is real."
- "Good answer. What else do you notice?"

Return pass=true only if the response includes useful, actionable security knowledge.
