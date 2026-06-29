import type { SocialAccount } from '@clipflow/db';
import { BaseAdapter, withHashtags, type PublishInput, type PublishResult } from './base.adapter.js';
import { prisma } from '../lib/prisma.js';
import { encryptAccess, expiresAtFrom } from './token-policy.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

// Instagram Graph API (Reels). Ingests a publicly-reachable video_url (presigned).
export class InstagramAdapter extends BaseAdapter {
  readonly platform = 'INSTAGRAM' as const;

  // Meta long-lived tokens are extended in place (no separate refresh token).
  protected async refreshToken(account: SocialAccount): Promise<string> {
    const current = this.decryptAccess(account);
    const url = new URL(`${GRAPH}/oauth/access_token`);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', process.env.META_APP_ID ?? '');
    url.searchParams.set('client_secret', process.env.META_APP_SECRET ?? '');
    url.searchParams.set('fb_exchange_token', current);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Instagram token refresh failed: ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: { ...encryptAccess(data.access_token), expiresAt: expiresAtFrom(data.expires_in) },
    });
    return data.access_token;
  }

  async publish(account: SocialAccount, input: PublishInput): Promise<PublishResult> {
    await this.enforceConstraints(input.videoPath);
    if (!input.videoUrl) throw new Error('Instagram requires a public videoUrl');
    const token = await this.ensureFreshToken(account);
    const igUserId = account.platformUserId;

    // 1) create a media container
    const createUrl = new URL(`${GRAPH}/${igUserId}/media`);
    createUrl.searchParams.set('media_type', 'REELS');
    createUrl.searchParams.set('video_url', input.videoUrl);
    createUrl.searchParams.set('caption', withHashtags(input.caption, input.hashtags));
    createUrl.searchParams.set('access_token', token);
    const createRes = await fetch(createUrl, { method: 'POST' });
    if (!createRes.ok) throw new Error(`Instagram container failed: ${await createRes.text()}`);
    const { id: creationId } = (await createRes.json()) as { id: string };

    // 2) publish the container
    const pubUrl = new URL(`${GRAPH}/${igUserId}/media_publish`);
    pubUrl.searchParams.set('creation_id', creationId);
    pubUrl.searchParams.set('access_token', token);
    const pubRes = await fetch(pubUrl, { method: 'POST' });
    if (!pubRes.ok) throw new Error(`Instagram publish failed: ${await pubRes.text()}`);
    const { id } = (await pubRes.json()) as { id: string };
    return { platformPostId: id };
  }
}
