// Loads the monorepo-root .env regardless of which package's CWD invoked it.
// Idempotent: dotenv does not override already-set vars, so production
// environments (Railway, Vercel) that inject env vars directly are untouched.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// This file lives at packages/shared/src/load-env.ts.
// Monorepo root is three levels up: src → shared → packages → root.
const here = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(here, "../../../.env") });
