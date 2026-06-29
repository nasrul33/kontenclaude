import type { SocialAccount } from '@clipflow/db';
import type { Platform } from '@clipflow/shared';
import { decryptToken } from '../crypto/token.js';
import { getDuration } from '../ffmpeg/index.js';
import { needsRefresh } from './token-policy.js';
import { assertDurationWithinLimit } from './constraints.js';

export interface PublishInput {
  videoPath: string; // local path to the rendered clip (binary-upload platforms)
  videoUrl?: string; // presigned URL (URL-ingest platforms: Instagram, Facebook)
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

  protected decryptAccess(account: SocialAccount): string {
    return decryptToken(Buffer.from(account.encryptedToken), account.tokenIv, account.tokenTag);
  }

  protected decryptRefresh(account: SocialAccount): string {
    if (!account.encryptedRefresh || !account.refreshIv || !account.refreshTag) {
      throw new Error(`${this.platform}: no refresh token stored`);
    }
    return decryptToken(
      Buffer.from(account.encryptedRefresh),
      account.refreshIv,
      account.refreshTag,
    );
  }

  // CLAUDE.md invariant #7 — refresh BEFORE publish when near expiry (TikTok 24h).
  protected async ensureFreshToken(account: SocialAccount): Promise<string> {
    if (!needsRefresh(account.expiresAt)) return this.decryptAccess(account);
    return this.refreshToken(account);
  }

  // Enforce platform duration cap BEFORE upload (invariants #8/#9).
  protected async enforceConstraints(videoPath: string): Promise<void> {
    assertDurationWithinLimit(this.platform, await getDuration(videoPath));
  }

  /** Refresh the OAuth token, persist new values, return the fresh access token. */
  protected abstract refreshToken(account: SocialAccount): Promise<string>;

  /** Publish a clip. Implementations MUST call enforceConstraints + ensureFreshToken first. */
  abstract publish(account: SocialAccount, input: PublishInput): Promise<PublishResult>;
}

// Format a caption body + hashtags into a single platform string.
export function withHashtags(caption: string, hashtags: string[]): string {
  if (!hashtags.length) return caption;
  const tags = hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  return `${caption}\n\n${tags}`;
}
