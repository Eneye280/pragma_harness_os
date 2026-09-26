import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

export const ENCRYPTED_PREFIX = "enc:v1:";

export function deriveKey(secret: string, salt: string): Buffer {
  return scryptSync(secret, salt, 32);
}

export function encryptString(plainText: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString("base64")}`;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

export function decryptString(payload: string, key: Buffer): string {
  if (!isEncrypted(payload)) return payload;
  const raw = Buffer.from(payload.slice(ENCRYPTED_PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export interface SecretBox {
  encrypt: (plainText: string) => string;
  decrypt: (value: string) => string;
}

export function createSecretBox(key: Buffer): SecretBox {
  return {
    encrypt: (plainText) => (plainText ? encryptString(plainText, key) : plainText),
    decrypt: (value) => {
      try {
        return decryptString(value, key);
      } catch {
        return "";
      }
    },
  };
}
