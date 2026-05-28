import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { PostgresDialect } from "kysely";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Pool } from "pg";

loadMonorepoEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.API_SECRET_KEY,
  database: new PostgresDialect({
    pool: new Pool({ connectionString: databaseUrl }),
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.APP_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : undefined,
  ].filter((value): value is string => Boolean(value)),
  plugins: [nextCookies()],
});

function loadMonorepoEnv() {
  const rootEnvPath = findEnvFile(process.cwd());
  if (!rootEnvPath) return;
  if (!existsSync(rootEnvPath)) return;

  const raw = readFileSync(rootEnvPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
}

function findEnvFile(start: string): string | null {
  let current = resolve(start);
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(current, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}
