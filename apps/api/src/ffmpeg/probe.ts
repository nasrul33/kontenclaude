import ffmpeg from 'fluent-ffmpeg';

export interface VideoMeta {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

// Runtime-only (needs ffprobe binary). No pure arg builder to unit-test here.
export function probeVideo(path: string): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, data) => {
      if (err) return reject(new Error(`ffprobe failed: ${err.message}`));
      const video = data.streams?.find(s => s.codec_type === 'video');
      const audio = data.streams?.find(s => s.codec_type === 'audio');
      const raw = video?.duration ?? data.format?.duration;
      if (!raw) return reject(new Error(`cannot determine duration for ${path}`));
      resolve({
        durationSec: parseFloat(String(raw)),
        width: video?.width ?? 0,
        height: video?.height ?? 0,
        hasAudio: Boolean(audio),
      });
    });
  });
}

export async function getDuration(path: string): Promise<number> {
  return (await probeVideo(path)).durationSec;
}
