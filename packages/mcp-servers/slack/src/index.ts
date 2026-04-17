// slack MCP server — tools implemented in Phase 1/3.
// Transport: Streamable HTTP (configured when wiring up to the agent runtime).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const server = new McpServer({
  name: "slack",
  version: "0.1.0",
});

// TODO: register tools via server.registerTool(...)
