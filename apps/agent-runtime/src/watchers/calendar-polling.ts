import { logger } from "@hermes/shared";

export function startCalendarPollingWatcher() {
  if (process.env.CALENDAR_POLL_ENABLED !== "true") return;

  logger.warn(
    "calendar polling watcher is disabled in user-scoped mode; use manual sync or add a per-user scheduler",
  );
}
