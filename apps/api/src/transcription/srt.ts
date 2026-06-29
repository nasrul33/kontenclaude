export interface TranscriptSegment {
  start: number; // seconds
  end: number; // seconds
  text: string;
}

// "HH:MM:SS,mmm" — SRT timestamp format.
export function formatSrtTimestamp(totalSec: number): string {
  if (totalSec < 0) totalSec = 0;
  const ms = Math.round((totalSec - Math.floor(totalSec)) * 1000);
  const whole = Math.floor(totalSec);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

export function segmentsToSrt(segments: TranscriptSegment[]): string {
  return (
    segments
      .map((seg, i) => {
        const idx = i + 1;
        const time = `${formatSrtTimestamp(seg.start)} --> ${formatSrtTimestamp(seg.end)}`;
        return `${idx}\n${time}\n${seg.text}\n`;
      })
      .join('\n') + (segments.length ? '\n' : '')
  );
}

// Plain transcript (no timing) — used to feed caption generation.
export function segmentsToPlainText(segments: TranscriptSegment[]): string {
  return segments
    .map(s => s.text)
    .join(' ')
    .trim();
}

// Segments overlapping [startSec, endSec], clipped to the window.
export function sliceSegments(
  segments: TranscriptSegment[],
  startSec: number,
  endSec: number,
): TranscriptSegment[] {
  return segments
    .filter(s => s.end > startSec && s.start < endSec)
    .map(s => ({
      start: Math.max(s.start, startSec),
      end: Math.min(s.end, endSec),
      text: s.text,
    }));
}

// Shift timings so the window starts at 0 (for a clip-scoped SRT).
export function rebaseSegments(
  segments: TranscriptSegment[],
  offsetSec: number,
): TranscriptSegment[] {
  return segments.map(s => ({
    start: Math.max(0, s.start - offsetSec),
    end: Math.max(0, s.end - offsetSec),
    text: s.text,
  }));
}

// Convenience: clip-scoped, zero-based SRT for subtitle burn-in.
export function clipSrt(
  segments: TranscriptSegment[],
  startSec: number,
  endSec: number,
): string {
  return segmentsToSrt(rebaseSegments(sliceSegments(segments, startSec, endSec), startSec));
}
