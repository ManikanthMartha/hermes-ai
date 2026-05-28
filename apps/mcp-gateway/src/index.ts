import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerGitHubTools } from "@hermes/mcp-github/tools";
import { registerGmailTools } from "@hermes/mcp-gmail/tools";
import { registerLinearTools } from "@hermes/mcp-linear/tools";
import { registerSentryTools } from "@hermes/mcp-sentry/tools";
import { registerSlackTools } from "@hermes/mcp-slack/tools";
import {
  logger,
  requireProviderCredential,
  workspaceIdForUser,
  type IntegrationProvider,
  type StoredCredentialPayload,
} from "@hermes/shared";

type GatewayContext = {
  userId: string;
  workspaceId: string;
};

type ProviderName = Exclude<IntegrationProvider, "calendar">;

type ServerBuilder = (context: GatewayContext) => McpServer;

const app = express();
const port = Number(process.env.PORT ?? process.env.MCP_GATEWAY_PORT ?? 4110);

app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "mcp-gateway" });
});

mountProvider("slack", (context) => {
  const server = new McpServer({ name: "slack", version: "0.1.0" });
  registerSlackTools(server, {
    getCredential: () => credentialFor("slack", context),
  });
  return server;
});

mountProvider("gmail", (context) => {
  const server = new McpServer({ name: "gmail", version: "0.1.0" });
  registerGmailTools(server, {
    getCredential: () => credentialFor("gmail", context),
  });
  return server;
});

mountProvider("github", (context) => {
  const server = new McpServer({ name: "github", version: "0.1.0" });
  registerGitHubTools(server, {
    getCredential: () => credentialFor("github", context),
  });
  return server;
});

mountProvider("linear", (context) => {
  const server = new McpServer({ name: "linear", version: "0.1.0" });
  registerLinearTools(server, {
    getCredential: () => credentialFor("linear", context),
  });
  return server;
});

mountProvider("sentry", (context) => {
  const server = new McpServer({ name: "sentry", version: "0.1.0" });
  registerSentryTools(server, {
    getCredential: () => credentialFor("sentry", context),
  });
  return server;
});

function mountProvider(provider: ProviderName, buildServer: ServerBuilder) {
  const path = `/${provider}/mcp`;

  app.post(path, async (req, res) => {
    const context = authenticateGatewayRequest(req, res);
    if (!context) return;

    const server = buildServer(context);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error({ err, provider, userId: context.userId }, "MCP gateway request failed");
      if (!res.headersSent) res.status(500).json({ error: "MCP request failed" });
    }
  });

  app.get(path, (_req, res) => {
    res.status(405).json({ error: "method not allowed in stateless mode" });
  });
}

function authenticateGatewayRequest(
  req: Request,
  res: Response,
): GatewayContext | null {
  const expectedSecret = process.env.MCP_GATEWAY_SECRET ?? process.env.API_SECRET_KEY;
  if (expectedSecret) {
    const provided = req.header("x-hermes-runtime-secret");
    if (provided !== expectedSecret) {
      res.status(401).json({ error: "unauthorized MCP gateway request" });
      return null;
    }
  }

  const userId = req.header("x-hermes-user-id");
  const workspaceId = req.header("x-hermes-workspace-id");
  if (!userId || !workspaceId || workspaceId !== workspaceIdForUser(userId)) {
    res.status(401).json({ error: "missing authenticated user scope" });
    return null;
  }

  return { userId, workspaceId };
}

async function credentialFor(
  provider: ProviderName,
  context: GatewayContext,
): Promise<StoredCredentialPayload> {
  return requireProviderCredential(provider, context.workspaceId);
}

app.listen(port, "::", () => {
  logger.info({ port }, "mcp-gateway listening");
});
