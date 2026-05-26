import {
  INTEGRATION_PROVIDERS,
  isIntegrationProvider,
  logger,
  type IntegrationProvider,
} from "@hermes/shared";
import { runEnvConnectorSync } from "../connectors/env-sync.js";

export function startEnvConnectorWatcher() {
  if (process.env.CONNECTOR_WATCH_ENABLED !== "true") return;

  const providers = parseProviders(process.env.CONNECTOR_WATCH_PROVIDERS);
  const intervalMs = parseInterval(process.env.CONNECTOR_WATCH_INTERVAL_MS);
  let running = false;

  const run = async () => {
    if (running) {
      logger.warn("env connector watcher skipped overlapping run");
      return;
    }
    running = true;
    try {
      for (const provider of providers) {
        try {
          await runEnvConnectorSync(provider, { trigger: "watcher" });
        } catch (err) {
          logger.error({ err, provider }, "env connector watcher failed");
        }
      }
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void run(), intervalMs);
  timer.unref?.();
  void run();

  logger.info({ providers, intervalMs }, "env connector watcher enabled");
}

function parseProviders(raw: string | undefined): IntegrationProvider[] {
  if (!raw?.trim()) return [...INTEGRATION_PROVIDERS];

  const providers = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter(isIntegrationProvider);

  return providers.length ? providers : [...INTEGRATION_PROVIDERS];
}

function parseInterval(raw: string | undefined): number {
  const parsed = raw ? Number.parseInt(raw, 10) : 300_000;
  if (!Number.isFinite(parsed)) return 300_000;
  return Math.max(60_000, parsed);
}
