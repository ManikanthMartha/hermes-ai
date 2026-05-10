export const dynamic = "force-dynamic";

const AGENT_RUNTIME_URL =
  process.env.AGENT_RUNTIME_URL ?? "http://localhost:4000";

export async function GET() {
  const upstream = await fetch(`${AGENT_RUNTIME_URL}/api/conversations`, {
    cache: "no-store",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}

