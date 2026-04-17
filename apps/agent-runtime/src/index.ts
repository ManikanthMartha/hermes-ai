import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    services: {
      neon: "not-configured",
      upstash: "not-configured",
    },
  });
});

app.listen(port, () => {
  console.log(`agent-runtime listening on http://localhost:${port}`);
});
