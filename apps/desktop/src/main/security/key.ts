import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { dirname, join } from "path";
import { createSecretBox, deriveKey, type SecretBox } from "./crypto";

const KEY_FILENAME = ".pragma-secret";
const KEY_PURPOSE = "pragma-harness-config";

export function secretKeyPath(configPath: string): string {
  return join(dirname(configPath), KEY_FILENAME);
}

export function resolveSecretBox(configPath: string): SecretBox {
  try {
    const keyFile = secretKeyPath(configPath);
    let secret = existsSync(keyFile) ? readFileSync(keyFile, "utf8").trim() : "";
    if (!secret) {
      secret = randomBytes(32).toString("hex");
      mkdirSync(dirname(keyFile), { recursive: true });
      writeFileSync(keyFile, secret, { encoding: "utf8", mode: 0o600 });
    }
    return createSecretBox(deriveKey(secret, KEY_PURPOSE));
  } catch {
    return { encrypt: (value) => value, decrypt: (value) => value };
  }
}
