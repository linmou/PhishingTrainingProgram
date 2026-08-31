#!/usr/bin/env node
/**
 * Purpose: prove the Qwen production HTTP paths preserve provider content and
 * carry the sole-model request controls without runtime clipping or retries.
 */

import { createServer, request as httpRequest, Server } from 'http';
import { AddressInfo } from 'net';
import fs from 'fs';
import path from 'path';
import type { AIAssistantConfig, ConversationMessage } from '../../types';

const readBody = (request: import('http').IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });

const createNodeFetch = () => ((input: RequestInfo | URL, init?: RequestInit) =>
  new Promise((resolve, reject) => {
    const target = typeof input === 'string' ? input : input.toString();
    const request = httpRequest(target, {
      method: init?.method || 'GET',
      headers: init?.headers as Record<string, string> | undefined,
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        const status = response.statusCode || 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          text: async () => text,
          json: async () => JSON.parse(text),
        } as Response);
      });
    });
    request.on('error', reject);
    if (init?.body) request.write(String(init.body));
    request.end();
  })) as typeof fetch;

const listen = (server: Server): Promise<number> =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () =>
    resolve((server.address() as AddressInfo).port)));

const close = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

const config = (systemPrompt: string): AIAssistantConfig => ({
  id: 'qwen-brevity-test',
  room_id: 'qwen-brevity-room',
  model_name: 'gpt-4o-mini',
  system_prompt: systemPrompt,
  prompt_config: null,
  temperature: 0.25,
  max_tokens: 77,
  is_active: true,
  created_at: '2026-08-30T00:00:00.000Z',
  updated_at: '2026-08-30T00:00:00.000Z',
});

describe('Qwen prompt brevity HTTP behavior', () => {
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

  it('specifies the complete transport contract at the production boundary', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../aiService.ts'), 'utf8');
    expect(source).toMatch(/class QwenService/);
    expect(source).toMatch(/method:\s*['"]POST['"]/);
    expect(source).toMatch(/model:\s*QWEN_MODEL/);
    expect(source).toMatch(/enable_thinking:\s*false/);
    expect(source).toMatch(/temperature/);
    expect(source).toMatch(/max_tokens/);
    expect(source).toMatch(/Qwen API error/);
    expect(source).toMatch(/TutorSuggestionService[\s\S]*Qwen API error/);
  });

  it('preserves an over-limit response exactly on both production paths', async () => {
    const received: Array<{ url: string; method?: string; authorization?: string; body: string }> = [];
    const overLimit = 'One. Two. Three. Four. ' + Array.from({ length: 51 }, (_, index) => `word${index + 1}`).join(' ');
    const server = createServer(async (request, response) => {
      received.push({
        url: request.url || '',
        method: request.method,
        authorization: request.headers.authorization,
        body: await readBody(request),
      });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ choices: [{ message: { content: overLimit } }] }));
    });
    const port = await listen(server);
    process.env.REACT_APP_OAI_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.REACT_APP_OAI_API_KEY = 'qwen-brevity-test-key';
    global.fetch = createNodeFetch();
    jest.resetModules();

    try {
      const aiService = await import('../aiService') as any;
      expect(aiService.QwenService).toBeDefined();
      const history: ConversationMessage[] = [{ role: 'user', content: 'The alert looks real.', timestamp: 1 }];
      const direct = await aiService.QwenService.generateResponse('What should I check?', history, config('DIRECT'));
      const suggestion = await aiService.TutorSuggestionService.generateSuggestion(history, config('SUGGESTION'), {
        focusStudentMessage: 'The alert looks real?',
        scenarioContext: 'Account Security Alert',
      });

      expect(direct.success).toBe(true);
      expect(direct.content).toBe(overLimit);
      expect(suggestion.success).toBe(true);
      expect(suggestion.suggestion).toBe(overLimit);
    } finally {
      await close(server);
    }

    expect(received).toHaveLength(2);
    received.forEach((entry) => {
      expect(entry.url).toBe('/chat/completions');
      expect(entry.method).toBe('POST');
      expect(entry.authorization).toBe('Bearer qwen-brevity-test-key');
      expect(JSON.parse(entry.body)).toMatchObject({
        model: 'qwen3.5-flash',
        enable_thinking: false,
      });
      expect(JSON.parse(entry.body).temperature).toBe(0.25);
      expect(JSON.parse(entry.body).max_tokens).toBe(77);
    });
    const directBody = JSON.parse(received[0].body);
    expect(directBody.messages).toEqual([
      { role: 'system', content: 'DIRECT' },
      { role: 'user', content: 'The alert looks real.' },
      { role: 'user', content: 'What should I check?' }
    ]);
    const suggestionBody = JSON.parse(received[1].body);
    const { buildEcologicalChatCompletionMessages } = await import('../ecologicalTutorCall');
    expect(suggestionBody.messages).toEqual(buildEcologicalChatCompletionMessages('SUGGESTION', {
      scenario_context: 'Account Security Alert',
      conversation_history: 'Participant: The alert looks real.',
      student_message: 'The alert looks real?'
    }));
  });

  it('keeps Qwen transport failures visible instead of replacing them with dummy content', async () => {
    const server = createServer(async (_request, response) => {
      response.writeHead(502, { 'Content-Type': 'text/plain' });
      response.end('upstream unavailable');
    });
    const port = await listen(server);
    process.env.REACT_APP_OAI_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.REACT_APP_OAI_API_KEY = 'qwen-brevity-test-key';
    global.fetch = createNodeFetch();
    jest.resetModules();

    try {
      const aiService = await import('../aiService') as any;
      expect(aiService.TutorSuggestionService).toBeDefined();
      const result = await aiService.QwenService.generateResponse('Check this.', [], config('ERROR'));
      expect(result.success).toBe(false);
      expect(result.content).toBe('');
      expect(result.error).toContain('Qwen API error: 502');
      const suggestion = await aiService.TutorSuggestionService.generateSuggestion([], config('ERROR'));
      expect(suggestion.success).toBe(false);
      expect(suggestion.suggestion).toBe('');
      expect(suggestion.error).toContain('Qwen API error: 502');
    } finally {
      await close(server);
    }
  });
});
