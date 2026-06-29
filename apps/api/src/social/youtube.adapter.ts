import { readFile } from 'node:fs/promises';
import type { SocialAccount } from '@clipflow/db';
import { BaseAdapter, withHashtags, type PublishInput, type PublishResult } from './base.adapter.js';
import { prisma } from '../lib/prisma.js';
import { encryptAccess, expiresAtFrom } from './token-policy.js';

// YouTube Data API v3. enforceConstraints caps Shorts at ≤60s (invariant #8).
export class YouTubeAdapter extends BaseAdapter {
  readonly platform = 'YOUTUBE' as const;

  protected async refreshToken(account: SocialAccount): Promise<string> {
    const refresh = this.decryptRefresh(account);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.YOUTUBE_CLIENT_ID ?? '',
        client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? '',
        refresh_token: refresh,
      }),
    });
    if (!res.ok) throw new Error(`YouTube token refresh failed: ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    // Google refresh responses do NOT return a new refresh_token; keep the stored one.
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: { ...encryptAccess(data.access_token), expiresAt: expiresAtFrom(data.expires_in) },
    });
    return data.access_token;
  }

  async publish(account: SocialAccount, input: PublishInput): Promise<PublishResult> {
    await this.enforceConstraints(input.videoPath); // ≤60s
    const token = await this.ensureFreshToken(account);

    const metadata = {
      snippet: {
        title: input.title ?? input.caption.slice(0, 95),
        description: withHashtags(input.caption, input.hashtags),
      },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
    };

    // Multipart upload (uploadType=multipart) — fine for short clips.
    const boundary = `clipflow-${Date.now()}`;
    const video = await readFile(input.videoPath);
    const head = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, video, tail]);

    const res = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!res.ok) throw new Error(`YouTube upload failed: ${await res.text()}`);
    const data = (await res.json()) as { id: string };
    return { platformPostId: data.id, url: `https://youtube.com/shorts/${data.id}` };
  }
}
