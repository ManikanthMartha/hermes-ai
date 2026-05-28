import { proxyToRuntime } from "@/lib/runtime-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return proxyToRuntime(req, "/api/connections");
}
