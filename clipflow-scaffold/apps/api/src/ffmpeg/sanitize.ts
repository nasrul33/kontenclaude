/**
 * Sanitize a file path before passing to FFmpeg filter arguments.
 * Rejects any path containing characters that could be interpreted
 * as shell metacharacters or FFmpeg filter syntax.
 *
 * MUST be used for any user-supplied or external path (SRT files, etc.)
 * NEVER skip this for any path that touches FFmpeg.
 */
export function sanitizeFfmpegPath(rawPath: string): string {
  // Allow: alphanumeric, dash, underscore, dot, forward slash, leading slash for absolute paths
  if (!/^[a-zA-Z0-9_\-./]+$/.test(rawPath)) {
    throw new Error(
      `FFmpeg path contains unsafe characters and was rejected: "${rawPath.substring(0, 80)}"`,
    );
  }
  // Escape colon — special meaning in FFmpeg filter syntax
  return rawPath.replace(/:/g, '\\:');
}
