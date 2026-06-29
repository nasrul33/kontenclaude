import { describe, expect, it, beforeAll } from 'vitest';

// 32-byte hex key for tests.
process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);

let encryptToken: typeof import('../token.js').encryptToken;
let decryptToken: typeof import('../token.js').decryptToken;

beforeAll(async () => {
  ({ encryptToken, decryptToken } = await import('../token.js'));
});

describe('AES-256-GCM token crypto', () => {
  it('round-trips a plaintext token', () => {
    const enc = encryptToken('hello-secret-token-🔐');
    const dec = decryptToken(enc.encryptedToken, enc.tokenIv, enc.tokenTag);
    expect(dec).toBe('hello-secret-token-🔐');
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encryptToken('same-input');
    const b = encryptToken('same-input');
    expect(a.tokenIv).not.toBe(b.tokenIv);
    expect(Buffer.compare(a.encryptedToken, b.encryptedToken)).not.toBe(0);
  });

  it('rejects tampered ciphertext (auth tag check)', () => {
    const enc = encryptToken('important');
    const tampered = Buffer.from(enc.encryptedToken);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(() => decryptToken(tampered, enc.tokenIv, enc.tokenTag)).toThrow();
  });
});
