// Load the monorepo-root .env first — MUST be the first import so that
// every downstream module (db, redis, config) sees populated env vars.
import "./load-env.js";

export * from "./config.js";
export * from "./logger.js";
export * from "./types.js";
export { prisma } from "./db.js";
export { redis, upstashRedis } from "./redis.js";
