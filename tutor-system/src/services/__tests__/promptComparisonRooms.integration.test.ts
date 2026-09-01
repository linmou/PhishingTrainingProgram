#!/usr/bin/env node
/**
 * File: src/services/aiService.ts, scripts/seed-behavior-demo-templates.js, and scripts/browser-capture-prompt-contrast.js
 * Purpose: prove Phase 0/refined comparison rooms cross real local HTTP/process boundaries with controlled prompts, seeded pairs, and non-cherry-picked capture retries.
 */

import { createServer, request as httpRequest, Server } from 'http';
import { createHash } from 'crypto';
import { AddressInfo } from 'net';
import { spawn } from 'child_process';
import path from 'path';
import type { AIAssistantConfig, AIResponse, ConversationMessage } from '../../types';

type CapturedRequest = {
  method: string;
  url: string;
  body: string;
  authorization?: string;
};

const readBody = (request: import('http').IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });

const createNodeFetch = () => ((input: RequestInfo | URL, init?: RequestInit) =>
  new Promise((resolve, reject) => {
    const target = typeof input === 'string' ? input : input.toString();
    const request = httpRequest(
      target,
      {
        method: init?.method || 'GET',
        headers: init?.headers as Record<string, string> | undefined,
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          text += chunk;
        });
        response.on('end', () => {
          const status = response.statusCode || 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: async () => text,
            json: async () => JSON.parse(text),
          } as Response);
        });
      }
    );
    request.on('error', reject);
    if (init?.body) request.write(String(init.body));
    request.end();
  })) as typeof fetch;

const listen = (server: Server): Promise<number> =>
  new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as AddressInfo).port);
    });
  });

const close = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const basePromptConfig = (version: 'phase0' | 'refined') => ({
  role: { role: 'low' as const },
  communication_style: {
    teen_slang: 'low' as const,
    conversational_markers: 'low' as const,
    uncertainty_expression: 'low' as const,
  },
  cognitive_parameters: {
    concept_density: 'low' as const,
    perspective_taking: 'low' as const,
    personal_examples: 'low' as const,
    consequence_highlighting: 'low' as const,
  },
  emotional_parameters: {
    enthusiasm_level: 'low' as const,
    validation_frequency: 'low' as const,
    mistake_normalization: 'low' as const,
    confidence_building: 'low' as const,
  },
  detection_areas: ['Lock icons do not prove identity'],
  verification_steps: ['Open the real app'],
  prompt_comparison: {
    version,
    pair_id: 'lock_icon',
    shared_scenario_context: 'Shared Lock Icon Myth scenario',
    system_prompt_source_commit: version === 'phase0' ? '530bd59' : 'working-tree',
  },
});

const config = (
  version: 'phase0' | 'refined',
  systemPrompt: string
): AIAssistantConfig => ({
  id: `${version}-config`,
  room_id: `${version}-room`,
  model_name: 'qwen3.5-flash',
  system_prompt: systemPrompt,
  prompt_config: basePromptConfig(version) as any,
  temperature: 0.17,
  max_tokens: 93,
  is_active: true,
  created_at: '2026-08-30T00:00:00.000Z',
  updated_at: '2026-08-30T00:00:00.000Z',
});

describe('controlled prompt comparison integration', () => {
  const originalBaseUrl = process.env.REACT_APP_OAI_BASE_URL;
  const originalApiKey = process.env.REACT_APP_OAI_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.resetModules();
    global.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.REACT_APP_OAI_BASE_URL;
    else process.env.REACT_APP_OAI_BASE_URL = originalBaseUrl;
    if (originalApiKey === undefined) delete process.env.REACT_APP_OAI_API_KEY;
    else process.env.REACT_APP_OAI_API_KEY = originalApiKey;
  });

  it('sends historical and refined prompt layers over HTTP while all non-prompt controls stay equal', async () => {
    const received: CapturedRequest[] = [];
    const server = createServer(async (request, response) => {
      received.push({
        method: request.method || 'GET',
        url: request.url || '',
        body: await readBody(request),
        authorization: request.headers.authorization,
      });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        choices: [{ message: { content: 'Captured response' } }],
      }));
    });
    const port = await listen(server);
    process.env.REACT_APP_OAI_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.REACT_APP_OAI_API_KEY = 'local-test-key';
    global.fetch = createNodeFetch();
    jest.resetModules();

    try {
      const { TutorSuggestionService } = await import('../aiService');
      const history: ConversationMessage[] = [
        {
          role: 'user',
          content: 'Student (Alex): If the site has a lock icon, it should be safe, right?',
          timestamp: 1,
        },
      ];

      const phase0Result = await TutorSuggestionService.generateSuggestion(
        history,
        { ...config('phase0', 'RAW_SYSTEM'), model_name: 'gpt-4o-mini' },
        {
          focusStudentMessage: 'If the site has a lock icon, it should be safe, right?',
          scenarioContext: 'UI label: Phase 0 Lock Icon room',
        }
      );
      const refinedResult = await TutorSuggestionService.generateSuggestion(
        history,
        config('refined', 'REFINED_SYSTEM'),
        {
          focusStudentMessage: 'If the site has a lock icon, it should be safe, right?',
          scenarioContext: 'UI label: Refined Lock Icon room',
        }
      );
      expect(phase0Result.success).toBe(true);
      expect(phase0Result.suggestion).toBe('Captured response');
      expect(refinedResult.success).toBe(true);
      expect(refinedResult.suggestion).toBe('Captured response');
    } finally {
      await close(server);
    }

    expect(received).toHaveLength(2);
    received.forEach((entry) => {
      expect(entry).toMatchObject({
        method: 'POST',
        url: '/chat/completions',
        authorization: 'Bearer local-test-key',
      });
    });
    const [raw, refined] = received.map((entry) => JSON.parse(entry.body));
    expect(raw.messages[0].content).toBe('RAW_SYSTEM');
    expect(refined.messages[0].content).toBe('REFINED_SYSTEM');
    const phase0Conversation = [
      'Scenario context: Shared Lock Icon Myth scenario',
      'user: Student (Alex): If the site has a lock icon, it should be safe, right?',
    ].join('\n');
    expect(raw.messages[1].content).toBe(
      'Based on the recent conversation below, suggest a brief follow-up question or prompt that a tutor could use to engage the student further. '
      + "The suggestion should be under 2 sentences, interactive, and focused on deepening the student's understanding.\n\n"
      + `Recent conversation:\n${phase0Conversation}\n\nTutor suggestion:`
    );
    expect(refined.messages[1].content).toContain('Draft the next tutor message');
    expect(refined.messages[1].content).toContain('Write the tutor response only');
    expect(raw.messages[1].content).toContain('Shared Lock Icon Myth scenario');
    expect(refined.messages[1].content).toContain('Shared Lock Icon Myth scenario');
    expect(raw.messages[1].content).not.toContain('UI label: Phase 0');
    expect(refined.messages[1].content).not.toContain('UI label: Refined');
    const { messages: rawMessages, ...rawControls } = raw;
    const { messages: refinedMessages, ...refinedControls } = refined;
    expect(rawControls).toEqual(refinedControls);
    expect(rawMessages[1].content).toContain(
      'Student (Alex): If the site has a lock icon, it should be safe, right?'
    );
    expect(refinedMessages[1].content).toContain(
      'Student (Alex): If the site has a lock icon, it should be safe, right?'
    );
    expect(raw.temperature).toBe(0.17);
    expect(raw.max_tokens).toBe(93);
    expect(raw.model).toBe('qwen3.5-flash');
    expect(raw.enable_thinking).toBe(false);
  });

  it('sends the direct Qwen service call over HTTP with the sole model and disabled thinking', async () => {
    const received: CapturedRequest[] = [];
    const server = createServer(async (request, response) => {
      received.push({
        method: request.method || 'GET',
        url: request.url || '',
        body: await readBody(request),
        authorization: request.headers.authorization,
      });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        choices: [{ message: { content: 'Captured response' } }],
      }));
    });
    const port = await listen(server);
    process.env.REACT_APP_OAI_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.REACT_APP_OAI_API_KEY = 'qwen-local-test-key';
    global.fetch = createNodeFetch();
    jest.resetModules();

    let directResult!: AIResponse;
    try {
      const { QwenService } = await import('../aiService');
      directResult = await QwenService.generateResponse(
        'What should I check?',
        [],
        {
          ...config('refined', 'DIRECT_QWEN_SYSTEM'),
          model_name: 'gpt-4o-mini',
          temperature: 0.25,
          max_tokens: 77,
        }
      );

      expect(directResult).toMatchObject({
        model_used: 'qwen3.5-flash',
        success: true,
      });
    } finally {
      await close(server);
    }

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      method: 'POST',
      url: '/chat/completions',
      authorization: 'Bearer qwen-local-test-key',
    });
    const body = JSON.parse(received[0].body);
    expect(body).toMatchObject({
      model: 'qwen3.5-flash',
      enable_thinking: false,
      temperature: 0.25,
      max_tokens: 77,
    });
    expect(body.messages).toEqual([
      { role: 'system', content: 'DIRECT_QWEN_SYSTEM' },
      { role: 'user', content: 'What should I check?' },
    ]);
  });

  it('seeds all six comparison templates through a real child process and local Supabase HTTP boundary', async () => {
    const received: CapturedRequest[] = [];
    const server = createServer(async (request, response) => {
      const body = await readBody(request);
      received.push({ method: request.method || 'GET', url: request.url || '', body });
      response.setHeader('Content-Type', 'application/json');
      if (request.method === 'GET') {
        response.writeHead(200);
        response.end('[]');
        return;
      }
      response.writeHead(201);
      response.end('[]');
    });
    const port = await listen(server);
    const tutorRoot = path.resolve(__dirname, '../../..');

    const childResult = await new Promise<{ code: number | null; stderr: string }>((resolve) => {
      const child = spawn(process.execPath, ['scripts/seed-behavior-demo-templates.js'], {
        cwd: tutorRoot,
        env: {
          ...process.env,
          REACT_APP_SUPABASE_URL: `http://127.0.0.1:${port}`,
          REACT_APP_SUPABASE_ANON_KEY: 'local-anon-key',
        },
      });
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('close', (code) => resolve({ code, stderr }));
    });
    await close(server);

    expect(childResult.code).toBe(0);
    expect(childResult.stderr).toBe('');
    const writtenRows = received
      .filter((entry) => entry.method === 'POST' || entry.method === 'PATCH')
      .map((entry) => JSON.parse(entry.body))
      .flat();
    const comparisonRows = writtenRows.filter((row) =>
      row.ai_config_template?.prompt_config?.prompt_comparison
    );
    expect(comparisonRows).toHaveLength(6);
    expect(comparisonRows.map((row) => row.ai_config_template.prompt_config.prompt_comparison.version).sort())
      .toEqual(['phase0', 'phase0', 'phase0', 'refined', 'refined', 'refined']);
    expect(new Set(comparisonRows.map((row) => row.ai_config_template.prompt_config.prompt_comparison.pair_id)))
      .toEqual(new Set(['lock_icon', 'click_impulse', 'personal_story']));
  }, 30000);

  it('keeps comparison templates out of the existing ecological demo catalog', async () => {
    const templates = await import('../demoRoomTemplates') as any;
    const { isBehaviorDemoTemplateName } = await import('../../utils/behaviorTestRooms');
    expect(typeof templates.getPromptComparisonTemplateSeeds).toBe('function');
    const comparisonSeeds = templates.getPromptComparisonTemplateSeeds();
    expect(comparisonSeeds).toHaveLength(6);

    const expectedStudentLines: Record<string, string> = {
      lock_icon: 'If the site has HTTPS or a lock icon, then it should be safe, right?',
      click_impulse: 'I would click it quickly just in case.',
      personal_story: 'Did this ever happen to you?',
    };
    Object.entries(expectedStudentLines).forEach(([pairId, studentLine]) => {
      const pair = comparisonSeeds.filter((seed: any) =>
        seed.ai_config_template.prompt_config.prompt_comparison.pair_id === pairId
      );
      expect(pair).toHaveLength(2);
      expect(pair.map((seed: any) =>
        seed.ai_config_template.prompt_config.prompt_comparison.version
      ).sort()).toEqual(['phase0', 'refined']);
      expect(pair[0].pre_populated_dialogue).toEqual(pair[1].pre_populated_dialogue);
      pair.forEach((seed: any) => {
        expect(seed.pre_populated_dialogue).toEqual(expect.arrayContaining([
          expect.objectContaining({ role: 'student', message: studentLine }),
        ]));
        expect(seed.ai_config_template).toMatchObject({
          model_name: 'qwen3.5-flash',
          temperature: 0,
          max_tokens: 100,
        });
        expect(seed.ai_config_template.prompt_config.prompt_comparison.shared_scenario_context)
          .toBe(pair[0].ai_config_template.prompt_config.prompt_comparison.shared_scenario_context);
        expect(isBehaviorDemoTemplateName(seed.template_name)).toBe(true);
      });
    });

    const phase0Seeds = comparisonSeeds.filter((seed: any) =>
      seed.ai_config_template.prompt_config.prompt_comparison.version === 'phase0'
    );
    phase0Seeds.forEach((seed: any) => {
      expect(seed.ai_config_template.prompt_config.prompt_comparison.system_prompt_source_commit)
        .toBe('530bd59');
      expect(seed.ai_config_template.system_prompt).toHaveLength(9403);
      expect(createHash('sha256').update(seed.ai_config_template.system_prompt).digest('hex'))
        .toBe('4a4b9c23aa64ff3ece9a3160b33aeb9d76036f23ba2cfa08bb1e3777e97cf3a1');
    });

    const currentPrompt = templates.buildCasualPeerAIConfig('Account Security Alert', []).system_prompt;
    comparisonSeeds
      .filter((seed: any) =>
        seed.ai_config_template.prompt_config.prompt_comparison.version === 'refined'
      )
      .forEach((seed: any) => {
        expect(seed.ai_config_template.system_prompt).toBe(currentPrompt);
      });

    const coreIds = new Set(templates.getDemoRoomTemplateSeeds().map((seed: any) => seed.case_id));
    comparisonSeeds.forEach((seed: any) => {
      expect(coreIds.has(seed.case_id)).toBe(false);
    });
    expect(new Set(templates.getEcologicalCasesFromTemplates().map((item: any) => item.case_id)))
      .toEqual(new Set([
        'webpage_account_security_alert_classic',
        'webpage_nintendo_click_deal',
        'webpage_itunes_professional_photo',
        'webpage_demo_lock_icon_myth',
        'webpage_demo_click_impulse',
        'webpage_demo_correct_safe_action',
        'webpage_demo_correct_lock_reasoning',
        'webpage_demo_pressure_words',
        'webpage_demo_personal_story_trap',
      ]));
  });

  it('retries only a transport failure and retains successful low-quality content without regeneration', async () => {
    const runner = require('../../../scripts/browser-capture-prompt-contrast.js');
    let transportAttempts = 0;
    const afterTransportRetry = await runner.generateWithTransportRetry(async () => {
      transportAttempts += 1;
      if (transportAttempts === 1) {
        throw new runner.TransportGenerationError('temporary timeout');
      }
      return 'second attempt succeeded';
    });
    expect(afterTransportRetry).toBe('second attempt succeeded');
    expect(transportAttempts).toBe(2);

    let contentAttempts = 0;
    const lowQuality = await runner.generateWithTransportRetry(async () => {
      contentAttempts += 1;
      return 'What do you think?';
    });
    expect(lowQuality).toBe('What do you think?');
    expect(contentAttempts).toBe(1);

    const records = ['lock_icon', 'click_impulse', 'personal_story'].flatMap((pairId) =>
      (['phase0', 'refined'] as const).map((version, index) => runner.buildCaptureRecord({
        comparison: { pairId, version },
        template: { id: `template-${pairId}-${version}` },
        room: { id: `room-${pairId}-${version}` },
        input: {
          scenarioContext: `Shared ${pairId} context`,
          conversationHistory: `History for ${pairId}`,
          studentMessage: expectedManifestStudentLine(pairId),
          systemPromptSourceCommit: version === 'phase0' ? '530bd59' : 'working-tree',
          systemPromptSha256: `${pairId}-${version}-sha256`,
          userTurn: `${version} complete user turn`,
        },
        controls: { modelName: 'qwen3.5-flash', temperature: 0, maxTokens: 100 },
        generation: {
          response: `${version} captured response`,
          latencyMs: 100 + index,
          heuristicScores: { concise: true, safeAction: version === 'refined' },
        },
        screenshotPath: `screenshots/${pairId}-${version}.png`,
      }))
    );
    expect(records[0]).toEqual({
      pairId: 'lock_icon',
      version: 'phase0',
      templateId: 'template-lock_icon-phase0',
      roomId: 'room-lock_icon-phase0',
      scenarioContext: 'Shared lock_icon context',
      conversationHistory: 'History for lock_icon',
      studentMessage: 'If the site has HTTPS or a lock icon, then it should be safe, right?',
      modelName: 'qwen3.5-flash',
      temperature: 0,
      maxTokens: 100,
      systemPromptSourceCommit: '530bd59',
      systemPromptSha256: 'lock_icon-phase0-sha256',
      userTurn: 'phase0 complete user turn',
      response: 'phase0 captured response',
      latencyMs: 100,
      heuristicScores: { concise: true, safeAction: false },
      screenshotPath: 'screenshots/lock_icon-phase0.png',
    });
    const manifest = runner.buildRunManifest({
      runId: 'run-20260830',
      startedAt: '2026-08-30T12:00:00.000Z',
      appCommit: 'test-commit',
      records,
    });
    expect(manifest).toEqual({
      runId: 'run-20260830',
      startedAt: '2026-08-30T12:00:00.000Z',
      appCommit: 'test-commit',
      records,
    });
    expect(manifest.records).toHaveLength(6);
    expect(new Set(manifest.records.map((record: any) => record.screenshotPath)).size).toBe(6);
    manifest.records.forEach((record: any) => {
      expect(record).toEqual(expect.objectContaining({
        pairId: expect.any(String),
        version: expect.stringMatching(/^(phase0|refined)$/),
        roomId: expect.any(String),
        userTurn: expect.any(String),
        response: expect.any(String),
        latencyMs: expect.any(Number),
        heuristicScores: expect.any(Object),
        screenshotPath: expect.stringMatching(/\.png$/),
      }));
    });
  });
});

function expectedManifestStudentLine(pairId: string): string {
  return {
    lock_icon: 'If the site has HTTPS or a lock icon, then it should be safe, right?',
    click_impulse: 'I would click it quickly just in case.',
    personal_story: 'Did this ever happen to you?',
  }[pairId] || '';
}
