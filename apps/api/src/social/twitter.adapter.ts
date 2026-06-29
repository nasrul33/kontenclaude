import { readFile } from 'node:fs/promises';
import type { SocialAccount } from '@clipflow/db';
import { BaseAdapter, withHashtags, type PublishInput, type PublishResult } from './base.adapter.js';
import { prisma } from '../lib/prisma.js';
import { encryptAccess, encryptRefresh, expiresAtFrom } from './token-policy.js';

const UPLOAD = 'https://upload.twitter.com/1.1/media/upload.json';

// X/Twitter API v2 (OAuth2 PKCE, offline.access). Chunked media upload + tweet.
export class TwitterAdapter extends BaseAdapter {
  readonly platform = 'TWITTER' as const;

  protected async refreshToken(account: SocialAccount): Promise<string> {
    const refresh = this.decryptRefresh(account);
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: process.env.TWITTER_CLIENT_ID ?? '',
      }),
    });
    if (!res.ok) throw new Error(`Twitter token refresh failed: ${res.status}`);
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
    await this.enforceConstraints(input.videoPath); // ≤140s
    const token = await this.ensureFreshToken(account);
    const auth = { Authorization: `Bearer ${token}` };
    const video = await readFile(input.videoPath);

    // INIT
    const initBody = new URLSearchParams({
      command: 'INIT',
      total_bytes: String(video.length),
      media_type: 'video/mp4',
      media_category: 'tweet_video',
    });
    const initRes = await fetch(UPLOAD, { method: 'POST', headers: auth, body: initBody });
    if (!initRes.ok) throw new Error(`Twitter media INIT failed: ${await initRes.text()}`);
    const { media_id_string: mediaId } = (await initRes.json()) as { media_id_string: string };

    // APPEND (single chunk)
    const form = new FormData();
    form.set('command', 'APPEND');
    form.set('media_id', mediaId);
    form.set('segment_index', '0');
    form.set('media', new Blob([new Uint8Array(video)], { type: 'video/mp4' }));
    const appendRes = await fetch(UPLOAD, { method: 'POST', headers: auth, body: form });
    if (!appendRes.ok) throw new Error(`Twitter media APPEND failed: ${appendRes.status}`);

    // FINALIZE
    const finRes = await fetch(UPLOAD, {
      method: 'POST',
      headers: auth,
      body: new URLSearchParams({ command: 'FINALIZE', media_id: mediaId }),
    });
    if (!finRes.ok) throw new Error(`Twitter media FINALIZE failed: ${await finRes.text()}`);

    // Tweet
    const text = withHashtags(input.caption, input.hashtags).slice(0, 280);
    const tweetRes = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, media: { media_ids: [mediaId] } }),
    });
    if (!tweetRes.ok) throw new Error(`Twitter tweet failed: ${await tweetRes.text()}`);
    const { data } = (await tweetRes.json()) as { data: { id: string } };
    return { platformPostId: data.id };
  }
}
