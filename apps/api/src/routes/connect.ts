import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { PlatformSchema, type Platform } from '@clipflow/shared';
import { prisma } from '../lib/prisma.js';
import { requireUser } from '../lib/session.js';
import { loadEnv } from '../lib/env.js';
import { OAUTH } from '../social/oauth-config.js';
import { encryptAccess, encryptRefresh, expiresAtFrom } from '../social/token-policy.js';

// OAuth2 connect scaffold. Live flows need real platform app credentials (env CHANGE_ME).
// The state token ties the callback back to the initiating user.
function redirectUri(platform: Platform): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  return `${base}/api/v1/connect/${platform}/callback`;
}

export async function connectRoutes(app: FastifyInstance) {
  // Step 1 — redirect the user to the provider's consent screen.
  app.get<{ Params: { platform: string } }>('/api/v1/connect/:platform', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const platform = PlatformSchema.parse(req.params.platform);
    const cfg = OAUTH[platform];
    const clientId = process.env[cfg.clientIdEnv] ?? '';

    // state = random nonce; persist the user binding in a short-lived Verification row.
    const state = randomUUID();
    await prisma.verification.create({
      data: {
        identifier: `oauth:${platform}:${state}`,
        value: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const url = new URL(cfg.authorizeUrl);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri(platform));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', cfg.scopes.join(' '));
    url.searchParams.set('state', state);
    return reply.redirect(url.toString());
  });

  // Step 2 — exchange the code, encrypt tokens, upsert the SocialAccount.
  app.get<{ Params: { platform: string }; Querystring: { code?: string; state?: string } }>(
    '/api/v1/connect/:platform/callback',
    async (req, reply) => {
      const platform = PlatformSchema.parse(req.params.platform);
      const cfg = OAUTH[platform];
      const { code, state } = req.query;
      if (!code || !state) return reply.code(400).send({ error: 'missing code/state' });

      const verification = await prisma.verification.findFirst({
        where: { identifier: `oauth:${platform}:${state}`, expiresAt: { gt: new Date() } },
      });
      if (!verification) return reply.code(400).send({ error: 'invalid or expired state' });
      const userId = verification.value;

      const tokenRes = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri(platform),
          client_id: process.env[cfg.clientIdEnv] ?? '',
          client_secret: process.env[cfg.clientSecretEnv] ?? '',
        }),
      });
      if (!tokenRes.ok) {
        return reply.code(502).send({ error: `token exchange failed: ${tokenRes.status}` });
      }
      const token = (await tokenRes.json()) as Record<string, unknown>;
      const accessToken = String(token.access_token ?? '');
      if (!accessToken) return reply.code(502).send({ error: 'no access_token in response' });
      const refreshToken = typeof token.refresh_token === 'string' ? token.refresh_token : null;
      const expiresIn = typeof token.expires_in === 'number' ? token.expires_in : undefined;
      const platformUserId = String(token[cfg.userIdField] ?? 'unknown');

      await prisma.socialAccount.upsert({
        where: { userId_platform: { userId, platform } },
        update: {
          platformUserId,
          ...encryptAccess(accessToken),
          ...(refreshToken ? encryptRefresh(refreshToken) : {}),
          expiresAt: expiresAtFrom(expiresIn),
          scopes: cfg.scopes,
        },
        create: {
          userId,
          platform,
          platformUserId,
          ...encryptAccess(accessToken),
          ...(refreshToken ? encryptRefresh(refreshToken) : {}),
          expiresAt: expiresAtFrom(expiresIn),
          scopes: cfg.scopes,
        },
      });

      await prisma.verification.delete({ where: { id: verification.id } });
      const appUrl = loadEnv().APP_URL;
      return reply.redirect(`${appUrl}/dashboard?connected=${platform}`);
    },
  );
}
