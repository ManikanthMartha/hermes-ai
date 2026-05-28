import type { NextFunction, Request, Response } from "express";
import { workspaceIdForUser, type WorkspaceContext } from "@hermes/shared";

const requestContexts = new WeakMap<
  Request,
  WorkspaceContext & { userEmail?: string }
>();

export function requireRuntimeAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.API_SECRET_KEY;
  if (secret) {
    const provided = req.header("x-hermes-runtime-secret");
    if (provided !== secret) {
      res.status(401).json({ error: "unauthorized runtime request" });
      return;
    }
  }

  const userId = req.header("x-hermes-user-id");
  const workspaceId = req.header("x-hermes-workspace-id");
  if (!userId || !workspaceId || workspaceId !== workspaceIdForUser(userId)) {
    res.status(401).json({ error: "missing authenticated user scope" });
    return;
  }

  requestContexts.set(req, {
    userId,
    workspaceId,
    userEmail: req.header("x-hermes-user-email") ?? undefined,
  });
  next();
}

export function requestContext(req: Request): WorkspaceContext {
  const context = requestContexts.get(req);
  if (!context) {
    throw new Error("request is missing Hermes auth context");
  }
  return {
    userId: context.userId,
    workspaceId: context.workspaceId,
  };
}
