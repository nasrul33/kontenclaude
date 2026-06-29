import { Client as MinioClient } from 'minio';

export const minio = new MinioClient({
  endPoint:        process.env.MINIO_ENDPOINT!.split(':')[0]!,
  port:            parseInt(process.env.MINIO_ENDPOINT!.split(':')[1] ?? '9000', 10),
  useSSL:          process.env.NODE_ENV === 'production',
  accessKey:       process.env.MINIO_ACCESS_KEY!,
  secretKey:       process.env.MINIO_SECRET_KEY!,
});

// MinIO key convention helper
export const minioKey = {
  source:   (userId: string, projectId: string, filename: string) =>
              `${userId}/${projectId}/source/${filename}`,
  clip:     (userId: string, projectId: string, clipId: string) =>
              `${userId}/${projectId}/clips/${clipId}/final.mp4`,
  subtitle: (userId: string, projectId: string, clipId: string) =>
              `${userId}/${projectId}/clips/${clipId}/subtitled.mp4`,
  thumb:    (userId: string, projectId: string, clipId: string) =>
              `${userId}/${projectId}/clips/${clipId}/thumb.jpg`,
  srt:      (userId: string, projectId: string, clipId: string) =>
              `${userId}/${projectId}/srt/${clipId}.srt`,
};

export async function uploadFile(
  bucket: string,
  key: string,
  filePath: string,
  contentType?: string,
): Promise<string> {
  await minio.fPutObject(bucket, key, filePath, {
    'Content-Type': contentType ?? 'application/octet-stream',
  });
  return key;
}

export async function getPresignedUrl(bucket: string, key: string, expirySeconds = 3600): Promise<string> {
  return minio.presignedGetObject(bucket, key, expirySeconds);
}
