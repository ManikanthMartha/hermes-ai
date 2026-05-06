import express from "express";
// @hermes/shared auto-loads the monorepo-root .env on import.
import { logger } from "@hermes/shared";
import { handleHealth } from "./routes/health.js";
import { handleChat } from "./routes/chat.js";
import { handleResume } from "./routes/resume.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json({ limit: "4mb" }));

app.get("/api/health", handleHealth);
app.post("/api/chat", handleChat);
app.post("/api/chat/resume", handleResume); //   HIL approval decisions

app.listen(port, () => {
  logger.info({ port }, "agent-runtime listening");
});
