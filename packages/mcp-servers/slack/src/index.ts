import "@hermes/shared"; // loads monorepo .env
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "@hermes/shared";
import { registerSlackTools } from "./tools.js";

function buildServer(): McpServer {
  const server = new McpServer({ name: "slack", version: "0.1.0" });
  registerSlackTools(server);
  return server;
}

const app = express();
app.use(express.json({ limit: "4mb" }));

// Stateless MCP: a fresh server + transport per POST. Matches the spec for
// scale-out deploys and sidesteps session management until we need it.
app.post("/mcp", async (req, res) => {
  const server = buildServer();
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
  } catch (e) {
    logger.error({ err: e }, "slack MCP request failed");
    if (!res.headersSent) res.status(500).end();
  }
});

// GET /mcp would be used for server-initiated SSE streams. We don't need
// that in stateless mode — explicitly reject.
app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "method not allowed in stateless mode" });
});

const port = Number(process.env.MCP_SLACK_PORT ?? 4100);
app.listen(port, "127.0.0.1", () => {
  const configured = !!process.env.SLACK_BOT_TOKEN;
  logger.info(
    { port, configured },
    configured
      ? "mcp-slack listening"
      : "mcp-slack listening (SLACK_BOT_TOKEN not set — tools will error)",
  );
});
