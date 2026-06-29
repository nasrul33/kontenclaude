import { describe, expect, it } from 'vitest';
import { buildTrimArgs } from '../trim.js';
import { buildReframeArgs, REFRAME_FILTERS } from '../reframe.js';
import { buildSubtitleArgs } from '../subtitle.js';
import { buildThumbnailArgs } from '../thumbnail.js';
import { buildExtractAudioArgs } from '../extract-audio.js';

describe('ffmpeg arg builders', () => {
  it('trim uses -ss before -i and -t duration (not end timestamp)', () => {
    const args = buildTrimArgs('/tmp/clipflow/j/in.mp4', '/tmp/clipflow/j/out.mp4', 10, 25);
    const ssIdx = args.indexOf('-ss');
    const iIdx = args.indexOf('-i');
    expect(ssIdx).toBeLessThan(iIdx); // input seeking
    const tIdx = args.indexOf('-t');
    expect(args[tIdx + 1]).toBe('15'); // 25 - 10, a duration
  });

  it('trim rejects endSec <= startSec', () => {
    expect(() => buildTrimArgs('/a', '/b', 30, 30)).toThrow();
  });

  it('reframe maps each aspect to its filter', () => {
    const v = buildReframeArgs('/in', '/out', 'VERTICAL');
    expect(v).toContain(REFRAME_FILTERS.VERTICAL);
    expect(buildReframeArgs('/in', '/out', 'SQUARE')).toContain(REFRAME_FILTERS.SQUARE);
    expect(buildReframeArgs('/in', '/out', 'HORIZONTAL')).toContain(REFRAME_FILTERS.HORIZONTAL);
  });

  it('subtitle sanitizes srt path and embeds it in the filter', () => {
    const args = buildSubtitleArgs(
      '/tmp/clipflow/j/in.mp4',
      '/tmp/clipflow/j/out.mp4',
      '/tmp/clipflow/j/sub.srt',
    );
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toContain('subtitles=');
    expect(vf).toContain('sub.srt');
  });

  it('subtitle rejects a path with shell metacharacters', () => {
    expect(() =>
      buildSubtitleArgs('/tmp/clipflow/j/in.mp4', '/tmp/clipflow/j/out.mp4', '/tmp/clipflow/j/a;rm.srt'),
    ).toThrow();
  });

  it('thumbnail extracts a single frame at the given timestamp', () => {
    const args = buildThumbnailArgs('/in', '/out.jpg', 3.5);
    expect(args[args.indexOf('-ss') + 1]).toBe('3.5');
    expect(args).toContain('-frames:v');
    expect(args[args.indexOf('-frames:v') + 1]).toBe('1');
  });

  it('extract-audio produces 16kHz mono wav', () => {
    const args = buildExtractAudioArgs('/in.mp4', '/out.wav');
    expect(args[args.indexOf('-ar') + 1]).toBe('16000');
    expect(args[args.indexOf('-ac') + 1]).toBe('1');
  });
});
