import { execa } from 'execa';
import type { AspectRatio } from '@clipflow/shared';

// Map domain AspectRatio enum → ffmpeg crop/scale filtergraph (from ffmpeg skill).
export const REFRAME_FILTERS: Record<AspectRatio, string> = {
  VERTICAL: 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920,setsar=1',
  SQUARE:
    'crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2,scale=1080:1080,setsar=1',
  HORIZONTAL:
    'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1',
};

export function buildReframeArgs(input: string, output: string, aspect: AspectRatio): string[] {
  const filter = REFRAME_FILTERS[aspect];
  if (!filter) throw new Error(`reframe: unknown aspect ${aspect}`);
  return ['-y', '-i', input, '-vf', filter, '-c:v', 'libx264', '-c:a', 'aac', output];
}

export async function reframe(input: string, output: string, aspect: AspectRatio): Promise<void> {
  await execa('ffmpeg', buildReframeArgs(input, output, aspect));
}
