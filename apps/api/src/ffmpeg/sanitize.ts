// CLAUDE.md invariant #5: FFmpeg WAJIB execa() tanpa shell:true + sanitizeFfmpegPath()
// sebelum argumen user masuk.
//
// Layered defense:
//   1. Reject shell metacharacters even though shell:false is set (subtitle filter,
//      concat protocol etc. parse args themselves).
//   2. Reject any string that LOOKS like a non-file FFmpeg protocol (concat:, http:,
//      lavfi:, data:, subfile:).
//   3. Path must be absolute and live under /tmp/clipflow/.
import { resolve, isAbsolute, sep } from 'node:path';

// Backslash is banned on POSIX (where paths use /), but on Windows it's a path separator.
// We only run real pipelines inside Linux containers — Windows just runs unit tests.
const isWin = process.platform === 'win32';
const BANNED_CHARS = isWin ? /[;&|`$<>"'\n\r\t]/ : /[;&|`$<>"'\\\n\r\t]/;
const BANNED_FFMPEG_PROTOCOLS = /^(concat|subfile|crypto|data|http|https|ftp|tcp|udp|pipe|lavfi):/i;

export class UnsafePathError extends Error {
  constructor(reason: string) {
    super(`unsafe ffmpeg path: ${reason}`);
    this.name = 'UnsafePathError';
  }
}

export function sanitizeFfmpegPath(p: string, allowedRoot = '/tmp/clipflow'): string {
  if (!p || typeof p !== 'string') throw new UnsafePathError('empty');
  if (BANNED_CHARS.test(p)) throw new UnsafePathError('shell metacharacter');
  if (BANNED_FFMPEG_PROTOCOLS.test(p)) throw new UnsafePathError('protocol prefix not allowed');
  if (!isAbsolute(p)) throw new UnsafePathError('must be absolute');

  const normalized = resolve(p);
  const root = resolve(allowedRoot);
  if (!normalized.startsWith(root + sep) && normalized !== root) {
    throw new UnsafePathError(`path escapes allowed root ${root}`);
  }
  return normalized;
}
