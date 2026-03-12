import crypto from 'crypto';
import { env } from './env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const raw = env.AGENT_ENCRYPTION_KEY;
  // Derive a fixed-length key via SHA-256
  return crypto.createHash('sha256').update(raw).digest().subarray(0, KEY_LENGTH);
}

export function encryptSecret(plaintext: string): { encrypted: Buffer; iv: Buffer; authTag: Buffer } {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { encrypted, iv, authTag };
}

export function decryptSecret(encrypted: Buffer, iv: Buffer, authTag: Buffer): string {
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
