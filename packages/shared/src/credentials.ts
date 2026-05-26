import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { loadEnv } from "./config.js";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

export function encryptCredential(payload: unknown): string {
  const key = getCredentialKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptCredential<T = unknown>(encryptedPayload: string): T {
  const [version, ivRaw, tagRaw, ciphertextRaw] = encryptedPayload.split(".");
  if (version !== VERSION || !ivRaw || !tagRaw || !ciphertextRaw) {
    throw new Error("Unsupported credential payload format");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getCredentialKey(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext) as T;
}

function getCredentialKey(): Buffer {
  const { CREDENTIAL_ENCRYPTION_KEY } = loadEnv();
  if (!CREDENTIAL_ENCRYPTION_KEY) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY is not set");
  }

  return createHash("sha256").update(CREDENTIAL_ENCRYPTION_KEY).digest();
}
