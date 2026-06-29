import { execa } from 'execa';

export function buildThumbnailArgs(input: string, output: string, atSec: number): string[] {
  if (atSec < 0) throw new Error('thumbnail: atSec must be >= 0');
  return ['-y', '-ss', String(atSec), '-i', input, '-frames:v', '1', '-q:v', '2', output];
}

export async function extractThumbnail(input: string, output: string, atSec: number): Promise<void> {
  await execa('ffmpeg', buildThumbnailArgs(input, output, atSec));
}
