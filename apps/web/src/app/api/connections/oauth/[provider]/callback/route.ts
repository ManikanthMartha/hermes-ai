import { proxyToRuntime } from "@/lib/runtime-proxy";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ provider: string }> | { provider: string };
};

export async function GET(req: Request, context: RouteContext) {
  const { provider } = await Promise.resolve(context.params);
  const url = new URL(req.url);
  return proxyToRuntime(
    req,
    `/api/connections/oauth/${encodeURIComponent(provider)}/callback${url.search}`,
  );
}
