#!/usr/bin/env node
/**
 * Test responsible for running plan/multi-character_initial/behavior-cases.json through the real
 * production ecological request path with interaction_mode=multi_agent, and recording per-case
 * metadata (mode, instruction, parser result, tag order, repair retry, contract outcome).
 *
 * Live run: RUN_LIVE_QWEN_TESTS=true npx react-scripts test --watchAll=false --runInBand \
 *   --testPathPattern="multi_agent_behavior_cases"
 */

import fs from 'fs';
import path from 'path';
import { DEFAULT_AI_MODEL, TUTOR_DECISION_REPAIR_INSTRUCTION, parseTutorActionDecision } from '../services/aiService';
import { buildEcologicalChatCompletionMessages, formatRoomScenarioContext } from '../services/ecologicalTutorCall';
import { generateSystemPrompt, PRESET_CONFIGS } from '../services/systemPrompts';

const describeLiveQwen = process.env.RUN_LIVE_QWEN_TESTS === 'true' ? describe : describe.skip;

const repoRoot = path.resolve(__dirname, '../../..');
const casesPath = path.join(repoRoot, 'plan', 'multi-character_initial', 'behavior-cases.json');
const resultsDir = path.join(repoRoot, 'evals', 'promptfoo', 'results');

/** Production call parameters: aiService caps room max_tokens at 120 and uses a 0.3 temperature. */
const TEMPERATURE = 0.3;
const MAX_TOKENS = 120;

const SPEAKER_LABELS: Record<string, string> = {
  learner: 'Student',
  tutor: 'AI Tutor',
  misleading_peer: 'Simulated AI participant Riley'
};

interface BehaviorCase {
  caseId: string;
  label: string;
  requirements: string[];
  input: {
    scenario: { title: string; description: string; learningTargets: string[] };
    transcript: Array<{ id: string; speakerId: string; content: string; createdAt: string }>;
    focusLearnerMessageId: string;
  };
  expected: {
    must: string[];
    mustNot: string[];
    allowedDecisions: Array<{ mode: string; instruction: string | null }>;
    responseContract: {
      multiagentTagsProhibited?: boolean;
      requiredTags?: string[];
      allowedOrders?: string[][];
      messageCount?: number;
    };
  };
}

const readCases = (): BehaviorCase[] => JSON.parse(fs.readFileSync(casesPath, 'utf8')).cases;

const buildCaseMessages = (testCase: BehaviorCase, interactionMode: 'single_agent' | 'multi_agent') => {
  const { scenario, transcript, focusLearnerMessageId } = testCase.input;
  const focusIndex = transcript.findIndex((message) => message.id === focusLearnerMessageId);
  const studentMessage = focusIndex >= 0 ? transcript[focusIndex].content : '';
  const conversationHistory = transcript
    .filter((_, index) => index !== focusIndex)
    .map((message) => `${SPEAKER_LABELS[message.speakerId] || message.speakerId}: ${message.content}`)
    .join('\n');

  const systemPrompt = generateSystemPrompt({
    ...PRESET_CONFIGS.supportive_adult,
    detection_areas: scenario.learningTargets,
    verification_steps: scenario.learningTargets
  });

  return buildEcologicalChatCompletionMessages(systemPrompt, {
    scenario_context: formatRoomScenarioContext(scenario.title, scenario.description),
    conversation_history: conversationHistory,
    student_message: studentMessage,
    prior_mode: 'unknown',
    interaction_mode: interactionMode
  });
};

const callModel = async (messages: Array<{ role: string; content: string }>): Promise<string> => {
  const response = await fetch(`${process.env.REACT_APP_OAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.REACT_APP_OAI_API_KEY}`
    },
    body: JSON.stringify({
      model: DEFAULT_AI_MODEL,
      messages,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      enable_thinking: false,
      response_format: { type: 'json_object' }
    })
  });
  if (!response.ok) {
    throw new Error(`Qwen API error: ${response.status} - ${await response.text()}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

/** Same one-shot format-repair retry the production service applies. */
const runCase = async (testCase: BehaviorCase, interactionMode: 'single_agent' | 'multi_agent') => {
  const messages = buildCaseMessages(testCase, interactionMode);
  const rawOutputs: Array<{ attempt: number; content: string; error?: string }> = [];
  let repairUsed = false;
  let requestMessages = messages;
  let decision: ReturnType<typeof parseTutorActionDecision> | null = null;
  let parserError: string | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const content = await callModel(requestMessages);
    try {
      decision = parseTutorActionDecision(content, { allowMultiagent: interactionMode === 'multi_agent' });
      rawOutputs.push({ attempt, content });
      parserError = null;
      break;
    } catch (error) {
      parserError = error instanceof Error ? error.message : String(error);
      rawOutputs.push({ attempt, content, error: parserError });
      const repairable = parserError.startsWith('AI response ') || parserError.startsWith('AI tutor decision ');
      if (!repairable || attempt === 2) break;
      repairUsed = true;
      const last = requestMessages[requestMessages.length - 1];
      requestMessages = [
        ...requestMessages.slice(0, -1),
        { ...last, content: `${last.content}\n\n${TUTOR_DECISION_REPAIR_INSTRUCTION}` }
      ];
    }
  }

  const { allowedDecisions, responseContract } = testCase.expected;
  const allowed = decision
    ? allowedDecisions.some((entry) => entry.mode === decision!.mode && entry.instruction === decision!.instruction)
    : false;
  const agentTags = decision ? Array.from(decision.suggested_response.matchAll(/\[agent:([a-z_-]+)\]/gi)).map((m) => m[0]) : [];

  return {
    caseId: testCase.caseId,
    label: testCase.label,
    requirements: testCase.requirements,
    interaction_mode: interactionMode,
    model: DEFAULT_AI_MODEL,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
    parserPass: Boolean(decision),
    parserError,
    repairUsed,
    mode: decision?.mode ?? null,
    instruction: decision?.instruction ?? null,
    reason: decision?.mode_reason ?? null,
    response: decision?.suggested_response ?? null,
    tagOrder: agentTags.length ? agentTags : null,
    allowedDecisionMatch: allowed,
    allowedDecisions,
    responseContract,
    tagsProhibited:
      responseContract.multiagentTagsProhibited === true ? agentTags.length === 0 : null,
    manualReview: { must: testCase.expected.must, mustNot: testCase.expected.mustNot },
    rawOutputs
  };
};

const summarize = (result: ReturnType<typeof runCase> extends Promise<infer R> ? R : never): string =>
  `${result.caseId} mode=${result.mode} instruction=${result.instruction} parser=${result.parserPass} repair=${result.repairUsed} tags=${result.tagOrder ? result.tagOrder.join(',') : '-'} allowed=${result.allowedDecisionMatch}`;

describeLiveQwen('Multi-agent behavior cases (live Qwen)', () => {
  jest.setTimeout(300000);

  it('runs every case with Multi-agent enabled and with the single-agent control', async () => {
    const cases = readCases();
    const results = [];
    for (const testCase of cases) {
      const singleAgent = await runCase(testCase, 'single_agent');
      console.log(`  control ${summarize(singleAgent)}`);
      const multiAgent = await runCase(testCase, 'multi_agent');
      console.log(`  multi   ${summarize(multiAgent)}`);
      results.push({ caseId: testCase.caseId, label: testCase.label, single_agent: singleAgent, multi_agent: multiAgent });
    }

    fs.mkdirSync(resultsDir, { recursive: true });
    const outputPath = path.join(resultsDir, `multi-agent-behavior-cases-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(outputPath, JSON.stringify({
      ranAt: new Date().toISOString(),
      source: path.relative(repoRoot, casesPath),
      interactions: 'plan/multi-character_initial/behavior-cases.json targetInputRule',
      contract: 'reason/decision/response through the production ecological request at both interaction modes',
      note: 'single_agent is the matched control: it shows which case outcomes come from the candidate 11 policy alone.',
      results
    }, null, 2));
    console.log(`Recorded ${results.length} case results to ${path.relative(repoRoot, outputPath)}`);

    expect(results).toHaveLength(cases.length);
    expect(results.every((result) => result.multi_agent.parserPass)).toBe(true);
    expect(results.every((result) => result.single_agent.parserPass)).toBe(true);
  });
});
