import type { Platform } from '@clipflow/shared';
import type { BaseAdapter } from './base.adapter.js';
import { TikTokAdapter } from './tiktok.adapter.js';
import { YouTubeAdapter } from './youtube.adapter.js';
import { InstagramAdapter } from './instagram.adapter.js';
import { TwitterAdapter } from './twitter.adapter.js';
import { FacebookAdapter } from './facebook.adapter.js';

const ADAPTERS: Record<Platform, BaseAdapter> = {
  TIKTOK: new TikTokAdapter(),
  YOUTUBE: new YouTubeAdapter(),
  INSTAGRAM: new InstagramAdapter(),
  TWITTER: new TwitterAdapter(),
  FACEBOOK: new FacebookAdapter(),
};

export function getAdapter(platform: Platform): BaseAdapter {
  const adapter = ADAPTERS[platform];
  if (!adapter) throw new Error(`no adapter for platform ${platform}`);
  return adapter;
}

// URL-ingest platforms need a presigned video URL instead of a local binary.
export function needsVideoUrl(platform: Platform): boolean {
  return platform === 'INSTAGRAM' || platform === 'FACEBOOK';
}
