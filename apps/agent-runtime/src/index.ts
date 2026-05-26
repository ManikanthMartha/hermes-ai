import express from "express";
// @hermes/shared auto-loads the monorepo-root .env on import.
import { logger } from "@hermes/shared";
import { handleHealth } from "./routes/health.js";
import { handleChat } from "./routes/chat.js";
import { handleResume } from "./routes/resume.js";
import {
  handleGetConversation,
  handleListConversations,
} from "./routes/conversations.js";
import {
  handleApproveAction,
  handleCreateAction,
  handleDelegateAction,
  handleGetAction,
  handleGetActionAudit,
  handleListActions,
  handleRejectAction,
  handleSnoozeAction,
  handleUpdateAction,
} from "./routes/actions.js";
import {
  handleCreateAuditTest,
  handleListAudit,
  handleListFailures,
  handleListIntegrations,
} from "./routes/trust.js";
import {
  handleListSourceObjects,
  handleSyncConnector,
} from "./routes/connectors.js";
import { startEnvConnectorWatcher } from "./watchers/env-connectors.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json({ limit: "4mb" }));

app.get("/api/health", handleHealth);
app.post("/api/chat", handleChat);
app.post("/api/chat/resume", handleResume); //   HIL approval decisions
app.get("/api/conversations", handleListConversations);
app.get("/api/conversations/:id", handleGetConversation);
app.get("/api/actions", handleListActions);
app.post("/api/actions", handleCreateAction);
app.get("/api/actions/:id", handleGetAction);
app.patch("/api/actions/:id", handleUpdateAction);
app.get("/api/actions/:id/audit", handleGetActionAudit);
app.post("/api/actions/:id/approve", handleApproveAction);
app.post("/api/actions/:id/reject", handleRejectAction);
app.post("/api/actions/:id/snooze", handleSnoozeAction);
app.post("/api/actions/:id/delegate", handleDelegateAction);
app.get("/api/trust/integrations", handleListIntegrations);
app.get("/api/trust/audit", handleListAudit);
app.post("/api/trust/audit", handleCreateAuditTest);
app.post("/api/trust/audit/test", handleCreateAuditTest);
app.get("/api/trust/failures", handleListFailures);
app.get("/api/connectors/source-objects", handleListSourceObjects);
app.post("/api/connectors/:provider/sync-now", handleSyncConnector);

app.listen(port, () => {
  logger.info({ port }, "agent-runtime listening");
});

startEnvConnectorWatcher();
