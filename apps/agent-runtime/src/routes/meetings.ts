import type { Request, Response } from "express";
import {
  ClientInputError,
  getMeeting,
  handleGoogleCalendarWebhook,
  listMeetings,
  prepareMeeting,
  startGoogleCalendarWatch,
  syncGoogleCalendar,
} from "../services/calendar-meetings.js";
import { logger } from "@hermes/shared";
import { requestContext } from "../http/request-context.js";

export async function handleListMeetings(req: Request, res: Response) {
  try {
    const limit = clampLimit(singleQueryValue(req.query.limit), 50);
    const meetings = await listMeetings({ ...requestContext(req), limit });
    res.json({ meetings });
  } catch (err) {
    sendMeetingError(res, err, "failed to list meetings");
  }
}

export async function handleGetMeeting(req: Request, res: Response) {
  try {
    const id = requireParam(req, "id");
    const meeting = await getMeeting(id, requestContext(req));
    if (!meeting) {
      res.status(404).json({ error: "meeting not found" });
      return;
    }
    res.json({ meeting });
  } catch (err) {
    sendMeetingError(res, err, "failed to get meeting");
  }
}

export async function handlePrepareMeeting(req: Request, res: Response) {
  try {
    const id = requireParam(req, "id");
    const brief = await prepareMeeting(id, requestContext(req));
    res.status(201).json({ brief });
  } catch (err) {
    sendMeetingError(res, err, "failed to prepare meeting");
  }
}

export async function handleCalendarSyncNow(req: Request, res: Response) {
  try {
    const result = await syncGoogleCalendar({
      ...requestContext(req),
      trigger: "manual",
    });
    res.status(201).json(result);
  } catch (err) {
    sendMeetingError(res, err, "failed to sync calendar");
  }
}

export async function handleCalendarWatchStart(req: Request, res: Response) {
  try {
    const watch = await startGoogleCalendarWatch(requestContext(req));
    res.status(201).json({ watch });
  } catch (err) {
    sendMeetingError(res, err, "failed to start calendar watch");
  }
}

export async function handleCalendarWebhook(req: Request, res: Response) {
  try {
    const result = await handleGoogleCalendarWebhook({
      channelId: req.header("x-goog-channel-id") ?? undefined,
      channelToken: req.header("x-goog-channel-token") ?? undefined,
      resourceState: req.header("x-goog-resource-state") ?? undefined,
      messageNumber: req.header("x-goog-message-number") ?? undefined,
    });
    res.status(202).json(result);
  } catch (err) {
    sendMeetingError(res, err, "failed to handle calendar webhook");
  }
}

function sendMeetingError(res: Response, err: unknown, message: string) {
  if (err instanceof ClientInputError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  logger.error({ err }, message);
  res.status(500).json({ error: message });
}

function requireParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ClientInputError(400, `${key} param is required`);
  }
  const trimmed = value.trim();
  if (!isUuid(trimmed)) {
    throw new ClientInputError(400, `${key} must be a valid UUID`);
  }
  return trimmed;
}

function singleQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function clampLimit(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 100));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
