import { execa } from 'execa';
import { sanitizeFfmpegPath } from './sanitize.js';

const FORCE_STYLE =
  "FontSize=22,Bold=1,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=3";

// srtPath MUST pass sanitizeFfmpegPath — it is interpolated into the filtergraph (invariant #5).
export function buildSubtitleArgs(input: string, output: string, srtPath: string): string[] {
  const safeSrt = sanitizeFfmpegPath(srtPath);
  return [
    '-y',
    '-i',
    input,
    '-vf',
    `subtitles=${safeSrt}:force_style='${FORCE_STYLE}'`,
    '-c:v',
    'libx264',
    '-c:a',
    'copy',
    output,
  ];
}

export async function burnSubtitle(input: string, output: string, srtPath: string): Promise<void> {
  await execa('ffmpeg', buildSubtitleArgs(input, output, srtPath));
}
