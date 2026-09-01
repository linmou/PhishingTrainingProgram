# Turn Rhythm Rubric

Requirement: The tutor must break the question-every-turn pattern. After a correct answer, it may give concise useful reinforcement alone or ask one focused question about any applicable configured Detection Area or Verification Step the student has not demonstrated.

Pass criteria:
- Gives concise reinforcement, substantive explanation, correction, a concrete step, or one useful focused question.
- Passes with no question when the reinforcement or teaching is concise and useful.
- If it asks a question after a correct answer, targets one eligible untouched configured knowledge point.
- Asks no more than one focused question and does not repeat the student's covered point.
- Does not rely on questions as the main response.
- Does not end with a question when the student needs direct instruction.

Fail criteria:
- Responds mostly or only with questions.
- Ends with another question after already asking one.
- Repeats a point the student already demonstrated.
- Uses a broad prompt such as "What else do you notice?" instead of selecting one configured point.
- Asks two questions or produces a question chain.
- Avoids teaching by pushing all reasoning back to the student.
- Is merely friendly but does not teach, correct, or give a concrete action.

Passing examples:
- "The risky part is the website name: `testdrive.info` is not the real platform. Open the real app yourself and check security alerts there."
- "You noticed the spelling issue. The next check is the link: it should match the real platform exactly."
- "You separated connection security from site identity. Does this alert identify a specific account or event?"
- "That is correct. HTTPS protects the connection, not the site's identity. Check the exact domain and use the real app."

Failing examples:
- "Good thought! Why do you think scammers use links like that? What else do you notice?"
- "Interesting. What would happen if you clicked? What should you check next?"
- "You know HTTPS is not identity. What else do you notice?"
- "You know HTTPS is not identity. What does HTTPS prove?"

Calibration fixtures:
- PASS — specific acknowledgment plus one untouched-point question: "You correctly chose the real app. Does the alert name a specific login event?"
- PASS — direct reinforcement plus one untouched-point question: "HTTPS protects the connection, not the site's identity. Does the sender match the real company?"
- PASS — concise reinforcement without a question: "That is correct. HTTPS protects the connection, not the site's identity. Check the exact domain and use the real app."
- PASS — a different eligible untouched point than the example: "Using the official channel avoids the link. Review recent login activity in the real account."
- FAIL — repeated covered point: student already rejected HTTPS identity; tutor asks, "What does the lock icon prove?"
- FAIL — broad question: "What else do you notice?"
- FAIL — two-question chain: "Who sent it? What domain does it use?"
- PASS — tutor-mentioned but student-undemonstrated point remains eligible: the tutor mentioned urgency, the student only chose the real app, and the response asks, "Which pressure words are rushing you?"
- PASS — no remaining useful point: "You have covered the relevant warning signs and safe checks. Keep using the real app for future alerts."

Return pass=true only if the response clearly teaches or redirects without falling into a question chain.
