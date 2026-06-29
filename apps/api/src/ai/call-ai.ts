// Generic AI caller with Zod-validated output. CLAUDE.md invariants #10, AI Usage section.
// - Provider chosen by AI_PROVIDER (anthropic default, or openai).
// - DO NOT log full prompt (may contain sensitive transcripts).
// - Strip ``` fences before JSON.parse.
// - Retry once on JSON / Zod failure with a "fix your output" follow-up.
import type { ZodSchema } from 'zod';
import { AIOutputInvalidError } from '@clipflow/shared';
import { loadEnv } from '../lib/env.js';
import { complete as anthropicComplete } from './providers/anthropic.js';
import { complete as openaiComplete } from './providers/openai.js';
import type { ChatTurn, Complete } from './providers/types.js';

function pickProvider(): Complete {
  return loadEnv().AI_PROVIDER === 'openai' ? openaiComplete : anthropicComplete;
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
  const complete = pickProvider();
  const sys = systemPrompt ? { system: systemPrompt } : {};

  const messages: ChatTurn[] = [{ role: 'user', content: prompt }];
  const firstText = await complete({ messages, maxTokens, ...sys });

  const first = tryParse(firstText, schema);
  if (first.ok) return first.value;

  // Retry once with a tight repair turn — do NOT resend extra context.
  const repair: ChatTurn[] = [
    ...messages,
    { role: 'assistant', content: firstText },
    {
      role: 'user',
      content: `Your previous reply failed validation: ${first.error}. Return JSON only, matching the schema. No prose.`,
    },
  ];
  const retryText = await complete({ messages: repair, maxTokens, ...sys });
  const second = tryParse(retryText, schema);
  if (second.ok) return second.value;

  throw new AIOutputInvalidError(`AI output failed validation twice: ${second.error}`);
}

function tryParse<T>(
  raw: string,
  schema: ZodSchema<T>,
): { ok: true; value: T } | { ok: false; error: string } {
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
