import { logger } from "@hermes/shared";

export function startEnvConnectorWatcher() {
  if (process.env.CONNECTOR_WATCH_ENABLED !== "true") return;

  logger.warn(
    "connector watcher is disabled in user-scoped mode; add a per-user scheduler before enabling background sync",
  );
}
