import Anthropic from '@anthropic-ai/sdk';
import { loadEnv } from '../../lib/env.js';
import type { Complete } from './types.js';

let cached: Anthropic | null = null;
function client(): Anthropic {
  if (cached) return cached;
  cached = new Anthropic({ apiKey: loadEnv().ANTHROPIC_API_KEY });
  return cached;
}

export const complete: Complete = async ({ messages, maxTokens, system }) => {
  const env = loadEnv();
  const res = await client().messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });
  const part = res.content.find(p => p.type === 'text');
  return part && 'text' in part ? part.text : '';
};
