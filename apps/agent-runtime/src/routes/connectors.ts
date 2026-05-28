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
import { requestContext } from "../http/request-context.js";
import {
  ConnectionInputError,
  disconnectProvider,
  handleConnectionCallback,
  listConnections,
  parseProvider as parseConnectionProvider,
  saveManualCredential,
  startConnection,
} from "../services/connection-center.js";

export { handleConnectionCallback };

export async function handleListConnections(_req: Request, res: Response) {
  try {
    const connections = await listConnections(requestContext(_req));
    res.json({ connections });
  } catch (err) {
    logger.error({ err }, "failed to list connections");
    res.status(500).json({ error: "failed to list connections" });
  }
}

export async function handleStartConnection(req: Request, res: Response) {
  try {
    const provider = parseConnectionProvider(req.params.provider);
    const result = await startConnection(provider, requestContext(req));
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ConnectionInputError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error({ err }, "failed to start connection");
    res.status(500).json({ error: "failed to start connection" });
  }
}

export async function handleSaveManualCredential(req: Request, res: Response) {
  try {
    const provider = parseConnectionProvider(req.params.provider);
    const body = isRecord(req.body) ? req.body : {};
    const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
    const orgSlug = typeof body.orgSlug === "string" ? body.orgSlug : undefined;
    if (!accessToken.trim()) {
      res.status(400).json({ error: "accessToken is required" });
      return;
    }
    const result = await saveManualCredential({
      context: requestContext(req),
      provider,
      accessToken: accessToken.trim(),
      orgSlug,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ConnectionInputError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error({ err }, "failed to save manual credential");
    res.status(500).json({ error: "failed to save manual credential" });
  }
}

export async function handleDisconnectConnection(req: Request, res: Response) {
  try {
    const provider = parseConnectionProvider(req.params.provider);
    await disconnectProvider(provider, requestContext(req));
    res.json({ provider, status: "not_connected" });
  } catch (err) {
    if (err instanceof ConnectionInputError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    logger.error({ err }, "failed to disconnect provider");
    res.status(500).json({ error: "failed to disconnect provider" });
  }
}

export async function handleListSourceObjects(req: Request, res: Response) {
  try {
    const provider = parseOptionalProvider(req.query.provider);
    const limit = clampLimit(singleQueryValue(req.query.limit), 50);
    const sourceObjects = await listSourceObjects({
      ...requestContext(req),
      provider,
      limit,
    });
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
    const result = await runEnvConnectorSync(provider, {
      ...requestContext(req),
      trigger: "manual",
    });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
