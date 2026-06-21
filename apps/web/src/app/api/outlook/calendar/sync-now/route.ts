import { proxyToRuntime } from "@/lib/runtime-proxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return proxyToRuntime(req, "/api/outlook/calendar/sync-now");
}
