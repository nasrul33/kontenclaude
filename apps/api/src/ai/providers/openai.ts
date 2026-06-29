import OpenAI from 'openai';
import { loadEnv } from '../../lib/env.js';
import type { Complete } from './types.js';

let cached: OpenAI | null = null;
function client(): OpenAI {
  if (cached) return cached;
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required for AI_PROVIDER=openai');
  cached = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return cached;
}

export const complete: Complete = async ({ messages, maxTokens, system }) => {
  const env = loadEnv();
  // json_object mode forces valid JSON; prompts already say "Output ... JSON".
  const res = await client().chat.completions.create({
    model: env.OPENAI_MODEL,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ],
  });
  return res.choices[0]?.message?.content ?? '';
};
