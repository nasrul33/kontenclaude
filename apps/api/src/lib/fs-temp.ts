// Per-job temp directories. CLAUDE.md invariants #1, #13.
//
// NOTE: CLAUDE.md spells the temp dir as `/tmp/clipflow-{jobId}`. We instead use
// `/tmp/clipflow/{jobId}` (a subdir) so every working path lives under the single
// root `/tmp/clipflow` that sanitizeFfmpegPath() chroots to (invariant #5). Same
// guarantee, one fewer special case.
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

export const TMP_ROOT = process.env.CLIPFLOW_TMP_ROOT ?? '/tmp/clipflow';

export function jobTmpDir(jobId: string): string {
  // jobId is a sha256 hex or BullMQ id — no separators — but resolve() is defensive.
  return resolve(TMP_ROOT, jobId.replace(/[^a-zA-Z0-9_-]/g, '_'));
}

/**
 * Run `fn` with a freshly-created temp dir, always cleaned up afterward
 * (success OR failure) per invariant #13.
 */
export async function withTmpDir<T>(jobId: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = jobTmpDir(jobId);
  await mkdir(dir, { recursive: true });
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
