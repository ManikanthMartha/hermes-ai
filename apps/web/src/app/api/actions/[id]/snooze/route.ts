import { proxyToRuntime } from "@/lib/runtime-proxy";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function POST(req: Request, context: RouteContext) {
  const { id } = await Promise.resolve(context.params);
  return proxyToRuntime(req, `/api/actions/${encodeURIComponent(id)}/snooze`);
}

