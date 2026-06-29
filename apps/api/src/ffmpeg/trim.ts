import { execa } from 'execa';

// -ss BEFORE -i = fast input seeking. -t = output DURATION (endSec - startSec),
// not an end timestamp (a -to after -i would refer to the output timeline). See ffmpeg skill.
export function buildTrimArgs(
  input: string,
  output: string,
  startSec: number,
  endSec: number,
): string[] {
  if (!(endSec > startSec)) throw new Error(`trim: endSec (${endSec}) must be > startSec (${startSec})`);
  if (startSec < 0) throw new Error(`trim: startSec must be >= 0`);
  return [
    '-y',
    '-ss',
    String(startSec),
    '-i',
    input,
    '-t',
    String(endSec - startSec),
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    output,
  ];
}

export async function trim(
  input: string,
  output: string,
  startSec: number,
  endSec: number,
): Promise<void> {
  await execa('ffmpeg', buildTrimArgs(input, output, startSec, endSec));
}
