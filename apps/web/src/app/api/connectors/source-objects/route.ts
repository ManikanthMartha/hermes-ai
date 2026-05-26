import { proxyToRuntime } from "@/lib/runtime-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return proxyToRuntime(req, `/api/connectors/source-objects${url.search}`);
}
