import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export interface EncryptedData {
  encryptedToken: Buffer;
  tokenIv:        string;
  tokenTag:       string;
}

export function encryptToken(plaintext: string): EncryptedData {
  const key  = getKey();
  const iv   = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return {
    encryptedToken: encrypted,
    tokenIv:        iv.toString('hex'),
    tokenTag:       cipher.getAuthTag().toString('hex'),
  };
}

export function decryptToken(encrypted: Buffer, iv: string, tag: string): string {
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return decipher.update(encrypted) + decipher.final('utf8');
}
