// Generic Claude caller with Zod-validated output. CLAUDE.md invariants #10, AI Usage section.
// - DO NOT log full prompt (may contain sensitive transcripts).
// - Strip ``` fences before JSON.parse.
// - Retry once on JSON / Zod failure with a "fix your output" follow-up.
import Anthropic from '@anthropic-ai/sdk';
import type { ZodSchema } from 'zod';
import { AIOutputInvalidError } from '@clipflow/shared';
import { loadEnv } from '../lib/env.js';

const MODEL = 'claude-sonnet-4-6';

let cached: Anthropic | null = null;
function client(): Anthropic {
  if (cached) return cached;
  cached = new Anthropic({ apiKey: loadEnv().ANTHROPIC_API_KEY });
  return cached;
}

function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

export async function callAI<T>(opts: {
  prompt: string;
  schema: ZodSchema<T>;
  maxTokens?: number;
  systemPrompt?: string;
}): Promise<T> {
  const { prompt, schema, maxTokens = 2048, systemPrompt } = opts;
  const c = client();

  const baseMsg = {
    model: MODEL,
    max_tokens: maxTokens,
    ...(systemPrompt ? { system: systemPrompt } : {}),
  };

  const first = await c.messages.create({
    ...baseMsg,
    messages: [{ role: 'user', content: prompt }],
  });
  const firstText = extractText(first);

  let parsed = tryParse(firstText, schema);
  if (parsed.ok) return parsed.value;

  // Retry once with a tight repair prompt — DO NOT include the original prompt.
  const retry = await c.messages.create({
    ...baseMsg,
    messages: [
      { role: 'user', content: prompt },
      { role: 'assistant', content: firstText },
      {
        role: 'user',
        content: `Your previous reply failed validation: ${parsed.error}. Return JSON only, matching the schema. No prose.`,
      },
    ],
  });
  const retryText = extractText(retry);
  const second = tryParse(retryText, schema);
  if (second.ok) return second.value;

  throw new AIOutputInvalidError(`AI output failed validation twice: ${second.error}`);
}

function extractText(msg: Anthropic.Message): string {
  const part = msg.content.find(p => p.type === 'text');
  return part && 'text' in part ? part.text : '';
}

function tryParse<T>(raw: string, schema: ZodSchema<T>): { ok: true; value: T } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch (e) {
    return { ok: false, error: `JSON.parse: ${(e as Error).message}` };
  }
  const result = schema.safeParse(json);
  if (!result.success) return { ok: false, error: result.error.issues.map(i => i.message).join('; ') };
  return { ok: true, value: result.data };
}
