import "@hermes/shared"; // loads monorepo .env
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "@hermes/shared";
import { registerLinearTools } from "./tools.js";

function buildServer(): McpServer {
  const server = new McpServer({ name: "linear", version: "0.1.0" });
  registerLinearTools(server);
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
    logger.error({ err: e }, "linear MCP request failed");
    if (!res.headersSent) res.status(500).end();
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "method not allowed in stateless mode" });
});

const port = Number(process.env.MCP_LINEAR_PORT ?? 4102);
app.listen(port, "127.0.0.1", () => {
  const configured = !!process.env.LINEAR_API_KEY;
  logger.info(
    { port, configured },
    configured
      ? "mcp-linear listening"
      : "mcp-linear listening (LINEAR_API_KEY not set — tools will error)",
  );
});
