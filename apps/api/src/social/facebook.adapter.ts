import type { SocialAccount } from '@clipflow/db';
import { BaseAdapter, withHashtags, type PublishInput, type PublishResult } from './base.adapter.js';
import { prisma } from '../lib/prisma.js';
import { encryptAccess, expiresAtFrom } from './token-policy.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

// Facebook Reels (Pages). enforceConstraints caps at ≤90s (invariant #9).
export class FacebookAdapter extends BaseAdapter {
  readonly platform = 'FACEBOOK' as const;

  protected async refreshToken(account: SocialAccount): Promise<string> {
    const current = this.decryptAccess(account);
    const url = new URL(`${GRAPH}/oauth/access_token`);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', process.env.META_APP_ID ?? '');
    url.searchParams.set('client_secret', process.env.META_APP_SECRET ?? '');
    url.searchParams.set('fb_exchange_token', current);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Facebook token refresh failed: ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: { ...encryptAccess(data.access_token), expiresAt: expiresAtFrom(data.expires_in) },
    });
    return data.access_token;
  }

  async publish(account: SocialAccount, input: PublishInput): Promise<PublishResult> {
    await this.enforceConstraints(input.videoPath); // ≤90s
    if (!input.videoUrl) throw new Error('Facebook Reels requires a public videoUrl');
    const token = await this.ensureFreshToken(account);
    const pageId = account.platformUserId;

    // 1) start a Reel upload session
    const startRes = await fetch(`${GRAPH}/${pageId}/video_reels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_phase: 'start', access_token: token }),
    });
    if (!startRes.ok) throw new Error(`Facebook reel start failed: ${await startRes.text()}`);
    const { video_id: videoId } = (await startRes.json()) as { video_id: string };

    // 2) hand Meta the hosted file to ingest
    const upRes = await fetch(`https://rupload.facebook.com/video-upload/v21.0/${videoId}`, {
      method: 'POST',
      headers: { Authorization: `OAuth ${token}`, file_url: input.videoUrl },
    });
    if (!upRes.ok) throw new Error(`Facebook reel upload failed: ${await upRes.text()}`);

    // 3) finish + publish
    const finishUrl = new URL(`${GRAPH}/${pageId}/video_reels`);
    finishUrl.searchParams.set('access_token', token);
    finishUrl.searchParams.set('video_id', videoId);
    finishUrl.searchParams.set('upload_phase', 'finish');
    finishUrl.searchParams.set('video_state', 'PUBLISHED');
    finishUrl.searchParams.set('description', withHashtags(input.caption, input.hashtags));
    const finishRes = await fetch(finishUrl, { method: 'POST' });
    if (!finishRes.ok) throw new Error(`Facebook reel finish failed: ${await finishRes.text()}`);
    return { platformPostId: videoId };
  }
}
