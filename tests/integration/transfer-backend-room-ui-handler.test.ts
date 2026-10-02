#!/usr/bin/env -S deno test --allow-env --allow-net --allow-read --allow-run
/// <reference lib="dom" />
// Test responsible for the 102 Edge/service to 103 room UI handoff, including reviewed-draft validation.

import {
  type AssessmentApiDependencies,
  createAssessmentApiHandler,
} from "../../tutor-system/supabase/functions/assessment-api/index.ts";
import {
  answerLifecycleFromProcessed,
  projectRoomMessage,
} from "../../tutor-system/src/contexts/transferAssessmentUiAdapter.ts";
import { TransferAssessmentService } from "../../tutor-system/src/services/transferAssessmentService.ts";
import { resolveTransferAnswer } from "../../tutor-system/src/services/transferAssessmentOrchestrator.ts";
import type {
  AssessmentOption,
  PrivateAssessment,
} from "../../tutor-system/src/types/assessment.ts";

const OPTIONS: AssessmentOption[] = [
  { id: "A", text: "Trust the displayed sender name" },
  { id: "B", text: "Verify through a separate trusted channel" },
  { id: "C", text: "Forward the message to coworkers" },
  { id: "D", text: "Open the link to inspect it" },
];

function assertEquals(
  actual: unknown,
  expected: unknown,
  message: string,
): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) {
    throw new Error(`${message}: expected ${right}, received ${left}`);
  }
}

function createService(
  handler: ReturnType<typeof createAssessmentApiHandler>,
): TransferAssessmentService {
  return new TransferAssessmentService({
    api: {
      invoke: async (body) => {
        const response = await handler(
          new Request("http://localhost/assessment-api", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: "Bearer test",
            },
            body: JSON.stringify(body),
          }),
        );
        return { data: await response.json(), error: null };
      },
    },
    requestId: () => "00000000-0000-4000-8000-000000000001",
  });
}

function dependencies(
  rpc: AssessmentApiDependencies["rpc"],
  canReviewAssessment: boolean,
): AssessmentApiDependencies {
  return {
    featureEnabled: true,
    verifier: {
      verify: async () => ({
        principal_id: "principal-1",
        application_user_id: canReviewAssessment ? "tutor-1" : "learner-1",
        allowed_room_ids: ["room-1"],
        can_review_assessment: canReviewAssessment,
      }),
    },
    rpc,
    env: () => undefined,
    fetch: globalThis.fetch,
    resolveAnswer: resolveTransferAnswer,
  };
}

function context(acceptedAttemptCount: 0 | 1) {
  return {
    progress: { status: "partially_covered", understanding_level: "basic" },
    participation_mode: "tutoring",
    progress_snapshot_hash: "snapshot-1",
    feedback_required: false,
    eligible_assessment_item_ids: ["item-1"],
    unresolved_assessment: { id: "assessment-1" },
    pending_repair_message_id: null,
    attempt_snapshot: {
      assessment_id: "assessment-1",
      accepted_attempt_count: acceptedAttemptCount,
      resolution: "open",
      processed_answer_message_ids: acceptedAttemptCount === 1
        ? ["answer-1"]
        : [],
    },
  };
}

Deno.test("E02: real 101 retry and failure results reach the 103 lifecycle adapter through 102", async () => {
  let acceptedAttemptCount: 0 | 1 = 0;
  const rpc = async (name: string, args: Record<string, unknown>) => {
    if (name === "get_transfer_assessment_processing_context_v1") {
      const answerId = String(args.p_message_id);
      return {
        data: {
          context: context(acceptedAttemptCount),
          assessment: {
            id: "assessment-1",
            item_id: "item-1",
            selection_type: "single",
            options: OPTIONS,
            correct_option_ids: ["B"],
            learner_safe_explanation: "Use a separate trusted channel.",
            progress_snapshot_hash: "snapshot-1",
          },
          answer: {
            message_id: answerId,
            selected_option_ids: ["A"],
            references_message_id: "question-1",
          },
        },
        error: null,
      };
    }
    if (name === "process_assessment_message_v2") {
      const attemptNumber = Number(args.p_expected_attempt_count) + 1;
      const answerOutcome = args.p_answer_outcome;
      if (answerOutcome !== "retry" && answerOutcome !== "failed") {
        throw new Error(`unexpected 101 outcome ${String(answerOutcome)}`);
      }
      acceptedAttemptCount = attemptNumber === 1 ? 1 : acceptedAttemptCount;
      return {
        data: {
          message_id: `answer-${attemptNumber}`,
          assessment_id: "assessment-1",
          processing_state: "applied",
          answer_outcome: answerOutcome,
          attempt_number: attemptNumber,
          attempts_used: attemptNumber,
          attempts_remaining: answerOutcome === "retry" ? 1 : 0,
          selected_option_ids: args.p_selected_option_ids,
          terminal: answerOutcome === "failed",
          transition: answerOutcome === "failed"
            ? { event: "assessment_fail" }
            : null,
          feedback_required: answerOutcome === "failed",
          code: null,
          already_processed: false,
          terminal_failure_feedback: answerOutcome === "failed"
            ? {
              correct_option_ids: ["B"],
              learner_safe_explanation: "Use a separate trusted channel.",
            }
            : null,
        },
        error: null,
      };
    }
    throw new Error(`unexpected RPC ${name}`);
  };
  const service = createService(
    createAssessmentApiHandler(dependencies(rpc, false)),
  );

  const retry = await service.processMessage("answer-1", "assessment-1");
  assertEquals(
    answerLifecycleFromProcessed(retry),
    {
      state: "retry",
      messageId: "answer-1",
      assessmentId: "assessment-1",
      processingState: "applied",
      answerOutcome: "retry",
      attemptNumber: 1,
      attemptsUsed: 1,
      attemptsRemaining: 1,
      selectedOptionIds: ["A"],
      terminal: false,
      transition: null,
      code: null,
      feedbackRequired: false,
      alreadyProcessed: false,
      terminalFailureFeedback: null,
    },
    "the first real handler result stays retryable without terminal disclosure",
  );

  const failure = await service.processMessage("answer-2", "assessment-1");
  const failureView = answerLifecycleFromProcessed(failure);
  assertEquals(
    failureView.state,
    "failed",
    "the real second-attempt result is terminal failure",
  );
  assertEquals(
    failureView.attemptsUsed,
    2,
    "the adapter preserves server attempt count",
  );
  assertEquals(failureView.terminalFailureFeedback, {
    correct_option_ids: ["B"],
    learner_safe_explanation: "Use a separate trusted channel.",
  }, "terminal failure feedback is preserved only on the failed result");
});

Deno.test("E03: a real 102 reviewed delivery reaches the 103 public question adapter", async () => {
  const privateAssessment: PrivateAssessment = {
    selection_type: "single",
    stem: "What is the strongest evidence this message is suspicious?",
    rendered_text: "What is the strongest evidence this message is suspicious?",
    options: OPTIONS,
    correct_option_ids: ["B"],
    learner_safe_explanation: "Verify through a separate trusted channel.",
    transfer_basis: {
      concept_rule: "Verify unexpected requests through a trusted channel.",
      source_context: "The displayed sender appears familiar.",
      changed_context:
        "The destination is outside the known organization domain.",
      source_evidence_message_ids: ["source-1"],
    },
  };
  const storedAssessment = {
    id: "question-1",
    student_id: "learner-1",
    ...privateAssessment,
  };
  const rpc = async (name: string) => {
    if (name !== "send_reviewed_transfer_assessment_v1") {
      throw new Error(`unexpected RPC ${name}`);
    }
    return {
      data: {
        message: {
          id: "question-1",
          room_id: "room-1",
          user_id: "tutor-1",
          content: privateAssessment.stem,
          user_role: "tutor",
          parent_message_id: "source-1",
          response_mode: "assessment",
          assessment: storedAssessment,
          created_at: "2026-09-26T00:00:00.000Z",
        },
        room: { id: "room-1" },
      },
      error: null,
    };
  };
  const service = createService(
    createAssessmentApiHandler(dependencies(rpc, true)),
  );
  const delivered = await service.sendReviewed({
    reviewedPayload: {
      reason: "The untrusted destination is the relevant clue.",
      target_item_id: "item-1",
      assessment: privateAssessment,
    },
    roomId: "room-1",
    studentId: "learner-1",
    checklistId: "checklist-1",
    itemId: "item-1",
    focusStudentMessageId: "source-1",
  });

  const view = projectRoomMessage(
    delivered.message as unknown as Record<string, unknown>,
  );
  assertEquals(view.publicQuestion, {
    id: "question-1",
    studentId: "learner-1",
    stem: privateAssessment.stem,
    options: OPTIONS,
    selectionType: "single",
  }, "the exact 102 public DTO becomes the 103 learner question");
  assertEquals(Object.keys(delivered.message.assessment ?? {}).sort(), [
    "id",
    "options",
    "selection_type",
    "stem",
    "student_id",
  ], "the 102 service DTO contains only public question fields");
});

Deno.test("E03: the handler rejects a retired tutor decision before calling persistence", async () => {
  let rpcCalls = 0;
  const handler = createAssessmentApiHandler(dependencies(async () => {
    rpcCalls += 1;
    return { data: {}, error: null };
  }, true));
  const response = await handler(new Request("http://localhost/assessment-api", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test" },
    body: JSON.stringify({
      operation: "send_reviewed",
      request_id: "00000000-0000-4000-8000-000000000002",
      room_id: "room-1",
      student_id: "learner-1",
      checklist_id: "checklist-1",
      item_id: "item-1",
      focus_student_message_id: "source-1",
      reviewed_payload: {
        reason: "Assess transfer.",
        decision: { mode: "assessment", instruction: "transfer_assess", target_item_id: "item-1" },
        response: "Which action is safest?",
        assessment: {},
      },
    }),
  }));
  const body = await response.json();
  assertEquals(body.error.code, "ITEM_VALIDATION_FAILED", "the old shape must fail server validation");
  assertEquals(rpcCalls, 0, "invalid drafts must not reach the send RPC");
});
