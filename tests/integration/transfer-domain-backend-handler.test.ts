#!/usr/bin/env -S deno test --allow-env --allow-net --allow-read --allow-run
// Purpose: prove the 101 resolver's actual result flows through the 102 Edge handler into the trusted persistence RPC and that the committed RPC result is projected back to the caller.

import {
  type AssessmentApiDependencies,
  createAssessmentApiHandler,
} from "../../tutor-system/supabase/functions/assessment-api/index.ts";
import { resolveTransferAnswer } from "../../tutor-system/src/services/transferAssessmentOrchestrator.ts";

type AttemptCase = {
  name: string;
  acceptedAttemptCount: 0 | 1;
  selectedOptionIds: string[];
  expectedOutcome: "retry" | "passed" | "failed" | null;
};

type PersistedAttemptCase = AttemptCase & {
  expectedOutcome: "retry" | "passed" | "failed";
};

const OPTIONS = [
  { id: "A", text: "Trust the displayed sender name" },
  { id: "B", text: "Verify through a separate trusted channel" },
  { id: "C", text: "Forward the message to coworkers" },
  { id: "D", text: "Open the link to inspect it" },
];

const CASES: AttemptCase[] = [
  {
    name: "first incorrect answer remains retryable",
    acceptedAttemptCount: 0,
    selectedOptionIds: ["A"],
    expectedOutcome: "retry",
  },
  {
    name: "correct first answer passes",
    acceptedAttemptCount: 0,
    selectedOptionIds: ["B"],
    expectedOutcome: "passed",
  },
  {
    name: "second incorrect answer fails terminally",
    acceptedAttemptCount: 1,
    selectedOptionIds: ["A"],
    expectedOutcome: "failed",
  },
  {
    name: "ambiguous single-answer selection is clarified without persistence",
    acceptedAttemptCount: 0,
    selectedOptionIds: ["A", "B"],
    expectedOutcome: null,
  },
];

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(
  actual: unknown,
  expected: unknown,
  message = "values differ",
): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) {
    throw new Error(`${message}: expected ${right}, received ${left}`);
  }
}

function hasCommittedOutcome(
  testCase: AttemptCase,
): testCase is PersistedAttemptCase {
  return testCase.expectedOutcome !== null;
}

function attemptContext(acceptedAttemptCount: 0 | 1) {
  const assessmentId = "assessment-1";
  return {
    progress: { status: "partially_covered", understanding_level: "basic" },
    participation_mode: "tutoring",
    progress_snapshot_hash: "snapshot-1",
    feedback_required: false,
    eligible_assessment_item_ids: ["item-1"],
    unresolved_assessment: { id: assessmentId },
    pending_repair_message_id: null,
    attempt_snapshot: {
      assessment_id: assessmentId,
      accepted_attempt_count: acceptedAttemptCount,
      resolution: "open",
      processed_answer_message_ids: acceptedAttemptCount === 1
        ? ["answer-1"]
        : [],
    },
  };
}

function committedResult(
  testCase: PersistedAttemptCase,
): Record<string, unknown> {
  const attemptNumber = testCase.acceptedAttemptCount + 1;
  const terminal = testCase.expectedOutcome !== "retry";
  return {
    message_id: `answer-${attemptNumber}`,
    assessment_id: "assessment-1",
    processing_state: "applied",
    answer_outcome: testCase.expectedOutcome,
    attempt_number: attemptNumber,
    attempts_used: attemptNumber,
    attempts_remaining: testCase.expectedOutcome === "retry" ? 1 : 0,
    selected_option_ids: testCase.selectedOptionIds,
    terminal,
    transition: terminal
      ? {
        event: `assessment_${
          testCase.expectedOutcome === "passed" ? "pass" : "fail"
        }`,
      }
      : null,
    feedback_required: terminal,
    code: null,
    already_processed: false,
    terminal_failure_feedback: testCase.expectedOutcome === "failed"
      ? {
        correct_option_ids: ["B"],
        learner_safe_explanation: "Use a separate trusted channel.",
      }
      : null,
  };
}

for (const testCase of CASES) {
  Deno.test(`E01: ${testCase.name} passes the real 101 result through the 102 handler`, async () => {
    const context = attemptContext(testCase.acceptedAttemptCount);
    const assessment = {
      id: "assessment-1",
      item_id: "item-1",
      selection_type: "single",
      options: OPTIONS,
      correct_option_ids: ["B"],
      learner_safe_explanation: "Use a separate trusted channel.",
      progress_snapshot_hash: "snapshot-1",
    };
    const answerId = `answer-${testCase.acceptedAttemptCount + 1}`;
    const answer = {
      message_id: answerId,
      selected_option_ids: testCase.selectedOptionIds,
      references_message_id: "question-1",
    };
    const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    let resolverResult: ReturnType<typeof resolveTransferAnswer> | undefined;

    const dependencies: AssessmentApiDependencies = {
      featureEnabled: true,
      verifier: {
        verify: async () => ({
          principal_id: "principal-1",
          application_user_id: "learner-1",
          allowed_room_ids: ["room-1"],
          can_review_assessment: false,
        }),
      },
      rpc: async (name, args) => {
        rpcCalls.push({ name, args });
        if (name === "get_transfer_assessment_processing_context_v1") {
          return { data: { context, assessment, answer }, error: null };
        }
        if (name === "process_assessment_message_v2") {
          if (!hasCommittedOutcome(testCase)) {
            throw new Error("clarification must not call the persistence RPC");
          }
          return { data: committedResult(testCase), error: null };
        }
        throw new Error(`unexpected RPC ${name}`);
      },
      env: () => undefined,
      fetch: globalThis.fetch,
      resolveAnswer: (storedContext, input) => {
        resolverResult = resolveTransferAnswer(storedContext, input);
        return resolverResult;
      },
    };

    const handler = createAssessmentApiHandler(dependencies);
    const response = await handler(
      new Request("http://localhost/assessment-api", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test",
        },
        body: JSON.stringify({
          operation: "process_message",
          request_id: "00000000-0000-4000-8000-000000000001",
          room_id: "room-1",
          assessment_id: "assessment-1",
          message_id: answerId,
        }),
      }),
    );
    const payload = await response.json();
    const readCall = rpcCalls[0];
    const commitCall = rpcCalls[1];
    const result = resolverResult;

    assert(response.status === 200, `handler returned ${response.status}`);
    assert(
      payload.ok === true,
      `handler rejected the answer: ${JSON.stringify(payload)}`,
    );
    assert(result !== undefined, "102 did not call the 101 resolver");
    assertEquals(rpcCalls.map((call) => call.name), [
      "get_transfer_assessment_processing_context_v1",
      ...(hasCommittedOutcome(testCase)
        ? ["process_assessment_message_v2"]
        : []),
    ]);
    assertEquals(readCall.args.p_assessment_id, "assessment-1");
    assertEquals(readCall.args.p_message_id, answerId);

    if (!hasCommittedOutcome(testCase)) {
      assertEquals(result.disposition, "unresolved");
      assert(
        "attempt_snapshot" in result,
        "the real 101 attempt-aware result includes its snapshot",
      );
      assertEquals(result.attempt_snapshot.accepted_attempt_count, 0);
      assertEquals(payload.data.processing_state, "rejected");
      assertEquals(payload.data.answer_outcome, null);
      assertEquals(payload.data.attempts_used, 0);
      assertEquals(payload.data.transition, null);
      assert(payload.data.code, "clarification keeps its server code");
      return;
    }

    const resolverOutcome = result.disposition === "retryable"
      ? "retry"
      : result.disposition;
    assertEquals(
      resolverOutcome,
      testCase.expectedOutcome,
      "the 101 result matches the scenario",
    );
    assertEquals(
      commitCall.args.p_expected_attempt_count,
      testCase.acceptedAttemptCount,
    );
    assertEquals(commitCall.args.p_expected_resolution, "open");
    assertEquals(commitCall.args.p_answer_outcome, resolverOutcome);
    assertEquals(
      commitCall.args.p_selected_option_ids,
      testCase.selectedOptionIds,
    );
    assertEquals(commitCall.args.p_next_progress, result.progress);
    assertEquals(
      commitCall.args.p_applied_transition,
      result.applied_transition,
    );

    const committed = committedResult(testCase);
    assertEquals(payload.data, {
      message_id: committed.message_id,
      assessment_id: committed.assessment_id,
      processing_state: committed.processing_state,
      answer_outcome: committed.answer_outcome,
      attempt_number: committed.attempt_number,
      attempts_used: committed.attempts_used,
      attempts_remaining: committed.attempts_remaining,
      selected_option_ids: committed.selected_option_ids,
      terminal: committed.terminal,
      transition: committed.transition,
      feedback_required: committed.feedback_required,
      code: committed.code,
      already_processed: committed.already_processed,
      terminal_failure_feedback: committed.terminal_failure_feedback,
    });
  });
}
