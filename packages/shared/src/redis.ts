import { Redis } from "ioredis";
import { Redis as UpstashRedis } from "@upstash/redis";

// Persistent TCP connection for the agent-runtime (long-running Node process).
// Lazy-initialized so importing this module doesn't connect unless needed.
let _redis: Redis | null = null;

export function redis(): Redis {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  _redis = new Redis(url, { lazyConnect: true });
  return _redis;
}

// HTTP client for Next.js edge / serverless contexts.
// Reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from env.
export const upstashRedis = UpstashRedis.fromEnv();
