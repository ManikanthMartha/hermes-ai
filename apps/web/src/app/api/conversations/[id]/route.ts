import { proxyToRuntime } from "@/lib/runtime-proxy";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyToRuntime(req, `/api/conversations/${encodeURIComponent(id)}`);
}
