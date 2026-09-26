import { describe, expect, it } from "vitest";
import { createSecretBox, decryptString, deriveKey, encryptString, isEncrypted } from "../crypto";

const key = deriveKey("test-secret", "test-salt");

describe("secret encryption at rest", () => {
  it("round-trips a secret and marks it encrypted", () => {
    const encrypted = encryptString("sk-1234567890", key);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted).not.toContain("sk-1234567890");
    expect(decryptString(encrypted, key)).toBe("sk-1234567890");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    expect(encryptString("same", key)).not.toBe(encryptString("same", key));
  });

  it("fails safely with the wrong key", () => {
    const encrypted = encryptString("secret", key);
    expect(() => decryptString(encrypted, deriveKey("other", "test-salt"))).toThrow();
    const box = createSecretBox(deriveKey("other", "test-salt"));
    expect(box.decrypt(encrypted)).toBe("");
  });

  it("secret box leaves empty values and plaintext untouched", () => {
    const box = createSecretBox(key);
    expect(box.encrypt("")).toBe("");
    expect(box.decrypt("plain")).toBe("plain");
  });
});
