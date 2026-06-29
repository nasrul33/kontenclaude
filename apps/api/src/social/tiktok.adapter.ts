import { readFile } from 'node:fs/promises';
import type { SocialAccount } from '@clipflow/db';
import { BaseAdapter, withHashtags, type PublishInput, type PublishResult } from './base.adapter.js';
import { prisma } from '../lib/prisma.js';
import { encryptAccess, encryptRefresh, expiresAtFrom } from './token-policy.js';

// TikTok Content Posting API v2. Token expiry 24h → ensureFreshToken before publish.
export class TikTokAdapter extends BaseAdapter {
  readonly platform = 'TIKTOK' as const;

  protected async refreshToken(account: SocialAccount): Promise<string> {
    const refresh = this.decryptRefresh(account);
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_key: process.env.TIKTOK_CLIENT_KEY ?? '',
        client_secret: process.env.TIKTOK_CLIENT_SECRET ?? '',
        refresh_token: refresh,
      }),
    });
    if (!res.ok) throw new Error(`TikTok token refresh failed: ${res.status}`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        ...encryptAccess(data.access_token),
        ...encryptRefresh(data.refresh_token),
        expiresAt: expiresAtFrom(data.expires_in),
      },
    });
    return data.access_token;
  }

  async publish(account: SocialAccount, input: PublishInput): Promise<PublishResult> {
    await this.enforceConstraints(input.videoPath);
    const token = await this.ensureFreshToken(account);

    // Step 1 — init (FILE_UPLOAD).
    const video = await readFile(input.videoPath);
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_info: {
          title: withHashtags(input.caption, input.hashtags),
          privacy_level: 'PUBLIC_TO_EVERYONE',
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: video.length,
          chunk_size: video.length,
          total_chunk_count: 1,
        },
      }),
    });
    if (!initRes.ok) throw new Error(`TikTok init failed: ${await initRes.text()}`);
    const { data } = (await initRes.json()) as { data: { publish_id: string; upload_url: string } };

    // Step 2 — upload the binary.
    const put = await fetch(data.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes 0-${video.length - 1}/${video.length}`,
      },
      body: video,
    });
    if (!put.ok) throw new Error(`TikTok upload failed: ${put.status}`);

    return { platformPostId: data.publish_id };
  }
}
