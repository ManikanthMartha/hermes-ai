import "@hermes/shared";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "@hermes/shared";
import { registerGmailTools } from "./tools.js";

function buildServer(): McpServer {
  const server = new McpServer({ name: "gmail", version: "0.1.0" });
  registerGmailTools(server, {
    getCredential: async () => {
      throw new Error("Use @hermes/mcp-gateway for user-scoped Gmail access");
    },
  });
  return server;
}

const app = express();
app.use(express.json({ limit: "4mb" }));

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
    logger.error({ err: e }, "gmail MCP request failed");
    if (!res.headersSent) res.status(500).end();
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "method not allowed in stateless mode" });
});

const port = Number(process.env.MCP_GMAIL_PORT ?? 4104);
app.listen(port, "127.0.0.1", () => {
  logger.info({ port }, "mcp-gmail legacy server listening without env tokens");
});
