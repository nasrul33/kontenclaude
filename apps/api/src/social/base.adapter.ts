// Base class for platform publisher adapters.
// CLAUDE.md invariant #7: TikTok token expiry 24h — WAJIB ensureFreshToken() sebelum publish.
// Each concrete adapter (tiktok.adapter.ts, etc.) implements publish() and the token refresh path.
import type { Platform } from '@clipflow/shared';

export interface PublishInput {
  userId: string;
  clipId: string;
  videoStorageKey: string;
  caption: string;
  hashtags: string[];
  title?: string;
}

export interface PublishResult {
  platformPostId: string;
  url?: string;
}

export abstract class BaseAdapter {
  abstract readonly platform: Platform;

  /**
   * Refresh the user's OAuth token if it expires soon.
   * Subclasses MUST call this at the top of publish().
   */
  protected abstract ensureFreshToken(userId: string): Promise<void>;

  abstract publish(input: PublishInput): Promise<PublishResult>;
}
