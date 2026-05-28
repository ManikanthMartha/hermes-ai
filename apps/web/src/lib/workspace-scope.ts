import { createHash } from "node:crypto";

export function workspaceIdForUser(userId: string): string {
  const hash = createHash("sha256").update(`hermes:user-workspace:${userId}`).digest();
  hash.writeUInt8((hash.readUInt8(6) & 0x0f) | 0x40, 6);
  hash.writeUInt8((hash.readUInt8(8) & 0x3f) | 0x80, 8);
  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
