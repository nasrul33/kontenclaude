import { Client as MinioClient } from 'minio';
import { createReadStream } from 'node:fs';
import { loadEnv } from '../lib/env.js';

let cached: MinioClient | null = null;

export function getMinio(): MinioClient {
  if (cached) return cached;
  const env = loadEnv();
  const [host, portStr] = env.MINIO_ENDPOINT.split(':');
  cached = new MinioClient({
    endPoint: host ?? 'localhost',
    port: portStr ? Number(portStr) : 9000,
    useSSL: false,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
  });
  return cached;
}

export type BucketKind = 'sources' | 'clips' | 'srt' | 'thumbnails';

export function bucketFor(kind: BucketKind): string {
  const env = loadEnv();
  switch (kind) {
    case 'sources':
      return env.MINIO_BUCKET_SOURCES;
    case 'clips':
      return env.MINIO_BUCKET_CLIPS;
    case 'srt':
      return env.MINIO_BUCKET_SRT;
    case 'thumbnails':
      return env.MINIO_BUCKET_THUMBS;
  }
}

// Key convention from CLAUDE.md §MinIO Key Convention.
export const objectKeys = {
  source: (userId: string, projectId: string, filename: string) =>
    `${userId}/${projectId}/source/${filename}`,
  clipFinal: (userId: string, projectId: string, clipId: string) =>
    `${userId}/${projectId}/clips/${clipId}/final.mp4`,
  clipSubtitled: (userId: string, projectId: string, clipId: string) =>
    `${userId}/${projectId}/clips/${clipId}/subtitled.mp4`,
  thumb: (userId: string, projectId: string, clipId: string) =>
    `${userId}/${projectId}/clips/${clipId}/thumb.jpg`,
  srt: (userId: string, projectId: string, clipId: string) =>
    `${userId}/${projectId}/srt/${clipId}.srt`,
  // Project-level whisper output (segments JSON) — re-read by segment & render workers.
  transcriptJson: (userId: string, projectId: string) =>
    `${userId}/${projectId}/transcript.json`,
};

// Create buckets if missing — safe to call repeatedly (also done by infra/init-minio.sh).
export async function ensureBuckets(): Promise<void> {
  const m = getMinio();
  for (const kind of ['sources', 'clips', 'srt', 'thumbnails'] as const) {
    const bucket = bucketFor(kind);
    const exists = await m.bucketExists(bucket).catch(() => false);
    if (!exists) await m.makeBucket(bucket);
  }
}

export async function uploadFile(
  bucket: string,
  key: string,
  localPath: string,
  contentType = 'application/octet-stream',
): Promise<string> {
  await getMinio().fPutObject(bucket, key, localPath, { 'Content-Type': contentType });
  return key;
}

export async function putStream(
  bucket: string,
  key: string,
  localPath: string,
  size: number,
  contentType = 'application/octet-stream',
): Promise<string> {
  await getMinio().putObject(bucket, key, createReadStream(localPath), size, {
    'Content-Type': contentType,
  });
  return key;
}

export async function downloadFile(bucket: string, key: string, localPath: string): Promise<void> {
  await getMinio().fGetObject(bucket, key, localPath);
}

export async function presignedGet(bucket: string, key: string, expirySec = 3600): Promise<string> {
  return getMinio().presignedGetObject(bucket, key, expirySec);
}
