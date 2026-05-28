import { proxyToRuntime } from "@/lib/runtime-proxy";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ provider: string }> | { provider: string };
};

export async function POST(req: Request, context: RouteContext) {
  const { provider } = await Promise.resolve(context.params);
  return proxyToRuntime(
    req,
    `/api/connections/${encodeURIComponent(provider)}/connect`,
  );
}
