import { proxyToRuntime } from "@/lib/runtime-proxy";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyToRuntime(req, `/api/meetings/${encodeURIComponent(id)}/prepare`);
}
