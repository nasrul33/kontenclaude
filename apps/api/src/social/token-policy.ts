import { encryptToken } from '../crypto/token.js';

const DEFAULT_SKEW_MS = 5 * 60 * 1000; // refresh if <5 min left

// Pure decision: should we refresh before using this token?
export function needsRefresh(
  expiresAt: Date | null,
  skewMs = DEFAULT_SKEW_MS,
  now = Date.now(),
): boolean {
  if (!expiresAt) return false; // no expiry => never auto-refresh
  return expiresAt.getTime() - now <= skewMs;
}

// Prisma 7 Bytes fields want Uint8Array<ArrayBuffer>; Buffer types as ArrayBufferLike,
// so copy into a freshly-allocated ArrayBuffer-backed array.
const toBytes = (b: Buffer): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(b.byteLength);
  out.set(b);
  return out;
};

// Map an access token to the SocialAccount.encryptedToken/tokenIv/tokenTag columns.
export function encryptAccess(access: string) {
  const e = encryptToken(access);
  return { encryptedToken: toBytes(e.encryptedToken), tokenIv: e.tokenIv, tokenTag: e.tokenTag };
}

// Map a refresh token to the SocialAccount.encryptedRefresh/refreshIv/refreshTag columns.
export function encryptRefresh(refresh: string) {
  const e = encryptToken(refresh);
  return { encryptedRefresh: toBytes(e.encryptedToken), refreshIv: e.tokenIv, refreshTag: e.tokenTag };
}

export function expiresAtFrom(expiresInSec: number | undefined, now = Date.now()): Date | null {
  return expiresInSec ? new Date(now + expiresInSec * 1000) : null;
}
