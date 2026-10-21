// #!/usr/bin/env node
// Purpose: map pinned Copilot posts into the platform's room and template scenario contract.
import type { CyberbullyingScenario, PrePopulatedMessage } from '../types';

export const COPILOT_SOURCE_COMMIT = '89e7fda14b9a330c1ae796ca605971a7dc7b1b9b';

function record(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Cyberbullying scenario');
  return value as Record<string, any>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Incomplete Cyberbullying scenario');
  return value;
}
function author(value: unknown): CyberbullyingScenario['post']['author'] {
  const data = record(value);
  return { id: text(data.id), name: text(data.name), profile_picture: text(data.profile_picture), role: text(data.role) };
}
export function mapCopilotScenarios(value: unknown): CyberbullyingScenario[] {
  if (!Array.isArray(value) || !value.length) throw new Error('Cyberbullying scenarios are unavailable');
  return value.map(entry => {
    const source = record(entry);
    if (!Number.isInteger(source.id) || !Array.isArray(source.comments)) throw new Error('Invalid scenario identity');
    const content = record(source.content);
    return {
      id: 'copilot-' + source.id, source_commit: COPILOT_SOURCE_COMMIT,
      post: { text: text(content.text), image: text(content.image), timestamp: text(source.timestamp), author: author(source.author) },
      initial_comments: source.comments.map((entry: unknown) => {
        const comment = record(entry);
        return { id: text(comment.id), text: text(record(comment.content).text), timestamp: text(comment.timestamp), author: author(comment.author) };
      }),
    };
  });
}
export async function loadCyberbullyingScenarios(): Promise<CyberbullyingScenario[]> {
  const response = await fetch('/cyberbullying/scenarios.json');
  if (!response.ok) throw new Error('Could not load Cyberbullying scenarios');
  return mapCopilotScenarios(await response.json());
}
export function scenarioDialogue(scenario: CyberbullyingScenario): PrePopulatedMessage[] {
  return scenario.initial_comments.map(comment => ({
    source_comment_id: comment.id,
    user_name: comment.author.name, message: comment.text, role: 'others', timestamp: comment.timestamp,
    persona_id: comment.author.id, avatar_url: comment.author.profile_picture,
  }));
}
