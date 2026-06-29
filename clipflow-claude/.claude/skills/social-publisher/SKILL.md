---
name: social-publisher
description: |
  Pola implementasi publisher adapter untuk semua platform media sosial ClipFlow.
  Mencakup TikTok Content API v2, Instagram Graph API, YouTube Data API v3,
  X/Twitter API v2, dan Facebook Graph API. Termasuk OAuth token management.
  Trigger keywords: TikTok, Instagram, YouTube, Twitter, Facebook, publish, OAuth,
  token, adapter, social media, upload video
---

# Social Publisher — Reference Skill

## Base Adapter Pattern

```typescript
// apps/api/src/social/base.adapter.ts
// Prisma 7: import dari generated path, BUKAN @prisma/client
import { SocialAccount } from '../../../packages/db/generated';
import { decryptToken, encryptToken } from '../crypto/token';
import { prisma } from '../../../packages/db/generated';

export abstract class BaseAdapter {
  abstract platform: string;
  
  // WAJIB dipanggil sebelum setiap publish
  protected async ensureFreshToken(account: SocialAccount): Promise<string> {
    const token = decryptToken(
      account.encryptedToken,
      account.tokenIv,
      account.tokenTag,
    );
    
    if (!account.expiresAt) return token; // tidak ada expiry
    
    const expiresInMs = account.expiresAt.getTime() - Date.now();
    if (expiresInMs > 5 * 60 * 1000) return token; // >5 menit, aman
    
    return this.refreshToken(account);
  }
  
  protected abstract refreshToken(account: SocialAccount): Promise<string>;
  
  abstract publish(
    account: SocialAccount,
    videoPath: string,
    caption: string,
    hashtags: string[],
  ): Promise<{ platformPostId: string }>;
}
```

## TikTok Adapter — Token Expiry 24 Jam

```typescript
// apps/api/src/social/tiktok.adapter.ts
export class TikTokAdapter extends BaseAdapter {
  platform = 'TIKTOK';
  
  protected async refreshToken(account: SocialAccount): Promise<string> {
    const refresh = decryptToken(account.encryptedRefresh!, account.refreshIv!, account.refreshTag!);
    
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        refresh_token: refresh,
      }),
    });
    
    if (!res.ok) throw new Error(`TikTok token refresh failed: ${res.status}`);
    
    const data = await res.json();
    const { encryptedToken, tokenIv, tokenTag } = encryptToken(data.access_token);
    const { encryptedToken: encRefresh, tokenIv: refreshIv, tokenTag: refreshTag } =
      encryptToken(data.refresh_token);
    
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        encryptedToken, tokenIv, tokenTag,
        encryptedRefresh: encRefresh, refreshIv, refreshTag,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    });
    
    return data.access_token;
  }
  
  async publish(account: SocialAccount, videoLocalPath: string, caption: string, hashtags: string[]) {
    const token = await this.ensureFreshToken(account);
    
    // TikTok: 2 step — init upload, lalu upload binary
    // Step 1: Init
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_info: {
          title: `${caption} ${hashtags.map(h => '#' + h).join(' ')}`,
          privacy_level: 'PUBLIC_TO_EVERYONE',
        },
        source_info: { source: 'FILE_UPLOAD' },
      }),
    });
    
    if (!initRes.ok) throw new Error(`TikTok init failed: ${await initRes.text()}`);
    
    const { data: { publish_id, upload_url } } = await initRes.json();
    
    // Step 2: Upload binary
    const videoBuffer = await fs.readFile(videoLocalPath);
    await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(videoBuffer.length) },
      body: videoBuffer,
    });
    
    return { platformPostId: publish_id };
  }
}
```

## YouTube Shorts — Enforce ≤ 60 Detik

```typescript
// apps/api/src/social/youtube.adapter.ts — bagian penting
async publish(account: SocialAccount, videoLocalPath: string, title: string, ...) {
  // Enforce durasi SEBELUM upload
  const probe = await ffprobe(videoLocalPath);
  const duration = parseFloat(probe.streams[0].duration);
  
  if (duration > 60) {
    throw new Error(
      `YouTube Shorts: video ${duration.toFixed(1)}s melebihi batas 60 detik. ` +
      'Trim ke ≤60 detik sebelum publish ke YouTube.'
    );
  }
  
  // ... lanjut upload ke YouTube Data API v3
}
```

## Status Mapping per Platform

| HTTP Status | Makna | Action |
|---|---|---|
| 200/201 | Sukses | Simpan platformPostId |
| 400 | Bad request | Cek format video / parameter |
| 401 | Token expired | Call ensureFreshToken() lagi |
| 403 | Permission denied | Cek scope OAuth |
| 429 | Rate limited | Retry setelah delay |
| 503 | Platform down | Retry dengan backoff |

## Scopes OAuth per Platform

```
TikTok    : video.upload, user.info.basic
Instagram : instagram_basic, instagram_content_publish, pages_read_engagement
YouTube   : https://www.googleapis.com/auth/youtube.upload, .readonly
X/Twitter : tweet.write, users.read, media.write, offline.access
Facebook  : pages_manage_posts, pages_read_engagement, publish_video
```
