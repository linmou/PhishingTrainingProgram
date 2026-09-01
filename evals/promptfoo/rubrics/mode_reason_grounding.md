# Guard Mode Reason Grounding Rubric

Judge only the parsed `mode_reason` and the supplied conversation history. Pass when the reason briefly cites an observable conversational fact that supports the selected mode. Fail when it is empty, generic, cites facts not present in the history, or uses a repetition count as the reason. A reason must not reveal internal evaluator metadata to the student.
