import type { Request, Response } from "express";
import {
  isIntegrationProvider,
  logger,
  type IntegrationProvider,
} from "@hermes/shared";
import {
  ConnectorConfigurationError,
  listSourceObjects,
  runEnvConnectorSync,
} from "../connectors/env-sync.js";

export async function handleListSourceObjects(req: Request, res: Response) {
  try {
    const provider = parseOptionalProvider(req.query.provider);
    const limit = clampLimit(singleQueryValue(req.query.limit), 50);
    const sourceObjects = await listSourceObjects({ provider, limit });
    res.json({ sourceObjects });
  } catch (err) {
    if (err instanceof ConnectorInputError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }

    logger.error({ err }, "failed to list source objects");
    res.status(500).json({ error: "failed to list source objects" });
  }
}

export async function handleSyncConnector(req: Request, res: Response) {
  try {
    const provider = parseProvider(req.params.provider);
    const result = await runEnvConnectorSync(provider, { trigger: "manual" });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ConnectorInputError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    if (err instanceof ConnectorConfigurationError) {
      res.status(400).json({ error: err.message });
      return;
    }

    logger.error({ err }, "failed to sync connector");
    res.status(500).json({ error: "failed to sync connector" });
  }
}

function parseProvider(value: unknown): IntegrationProvider {
  if (typeof value !== "string" || !value.trim()) {
    throw new ConnectorInputError(400, "provider param is required");
  }
  const provider = value.trim();
  if (!isIntegrationProvider(provider)) {
    throw new ConnectorInputError(400, "unsupported provider");
  }
  return provider;
}

function parseOptionalProvider(value: unknown): IntegrationProvider | undefined {
  const raw = singleQueryValue(value);
  if (!raw) return undefined;
  return parseProvider(raw);
}

function singleQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function clampLimit(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 200));
}

class ConnectorInputError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
