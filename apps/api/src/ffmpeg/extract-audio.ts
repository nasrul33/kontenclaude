import { execa } from 'execa';

// 16kHz mono WAV — the format faster-whisper expects.
export function buildExtractAudioArgs(input: string, output: string): string[] {
  return ['-y', '-i', input, '-vn', '-ar', '16000', '-ac', '1', '-f', 'wav', output];
}

export async function extractAudio(input: string, output: string): Promise<void> {
  await execa('ffmpeg', buildExtractAudioArgs(input, output));
}
