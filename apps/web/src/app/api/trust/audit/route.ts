import { proxyToRuntime } from "@/lib/runtime-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  return proxyToRuntime(req, `/api/trust/audit${url.search}`);
}

export async function POST(req: Request) {
  return proxyToRuntime(req, "/api/trust/audit/test");
}

