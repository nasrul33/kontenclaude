// Better Auth — minimal Phase 0 wiring (email/password + dev seed).
// Social providers are placeholders in .env; we don't enable them yet.
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '../lib/prisma.js';
import { loadEnv } from '../lib/env.js';

function createAuth() {
  const env = loadEnv();
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: env.SESSION_COOKIE_SECRET,
    // baseURL = where the auth handler is mounted (this API), NOT the web app.
    baseURL: env.NEXT_PUBLIC_API_URL,
    emailAndPassword: { enabled: true },
    trustedOrigins: [env.APP_URL, env.NEXT_PUBLIC_API_URL],
  });
}

// Capture the *specialized* instance type so the singleton stays non-null & typed.
let cached: ReturnType<typeof createAuth> | null = null;

export function getAuth(): ReturnType<typeof createAuth> {
  if (!cached) cached = createAuth();
  return cached;
}
