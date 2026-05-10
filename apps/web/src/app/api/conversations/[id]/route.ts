export const dynamic = "force-dynamic";

const AGENT_RUNTIME_URL =
  process.env.AGENT_RUNTIME_URL ?? "http://localhost:4000";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const upstream = await fetch(
    `${AGENT_RUNTIME_URL}/api/conversations/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );

  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}

