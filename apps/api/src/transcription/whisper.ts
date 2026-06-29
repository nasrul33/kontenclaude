import { execa } from 'execa';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import type { TranscriptSegment } from './srt.js';

const WhisperOutputSchema = z.object({
  language: z.string(),
  segments: z.array(
    z.object({ start: z.number(), end: z.number(), text: z.string() }),
  ),
});

export interface WhisperResult {
  language: string;
  segments: TranscriptSegment[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
// apps/api/src/transcription -> apps/api/python/transcribe.py
const SCRIPT = resolve(__dirname, '../../python/transcribe.py');
const PYTHON = process.env.PYTHON_BIN ?? 'python';

export async function runWhisper(audioPath: string, langCode?: string): Promise<WhisperResult> {
  const args = [SCRIPT, audioPath, ...(langCode ? [langCode] : [])];
  // execa (no shell) — args passed as array, never interpolated into a command string.
  const { stdout } = await execa(PYTHON, args, { maxBuffer: 50 * 1024 * 1024 });
  const parsed = WhisperOutputSchema.parse(JSON.parse(stdout));
  return parsed;
}
