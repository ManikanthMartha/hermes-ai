import type { Request, Response } from "express";
import { prisma, redis } from "@hermes/shared";

type ServiceStatus = "connected" | "error";
interface Health {
  status: "ok" | "degraded";
  services: { neon: ServiceStatus; upstash: ServiceStatus };
  errors?: { neon?: string; upstash?: string };
}

async function checkNeon(): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkUpstash(): Promise<{ ok: boolean; error?: string }> {
  try {
    const reply = await redis().ping();
    return { ok: reply === "PONG" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleHealth(_req: Request, res: Response) {
  const [neon, upstash] = await Promise.all([checkNeon(), checkUpstash()]);

  const body: Health = {
    status: neon.ok && upstash.ok ? "ok" : "degraded",
    services: {
      neon: neon.ok ? "connected" : "error",
      upstash: upstash.ok ? "connected" : "error",
    },
  };
  if (!neon.ok || !upstash.ok) {
    body.errors = {};
    if (!neon.ok) body.errors.neon = neon.error;
    if (!upstash.ok) body.errors.upstash = upstash.error;
  }

  res.status(body.status === "ok" ? 200 : 503).json(body);
}
