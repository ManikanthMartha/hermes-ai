// Thin passthrough for HIL approval decisions. Mirrors /api/chat — browser
// posts { threadId, decision }, we forward to the agent-runtime, pipe the
// resulting UIMessage stream back unchanged.

export const dynamic = "force-dynamic";

const AGENT_RUNTIME_URL =
  process.env.AGENT_RUNTIME_URL ?? "http://localhost:4000";

export async function POST(req: Request) {
  const body = await req.text();

  const upstream = await fetch(`${AGENT_RUNTIME_URL}/api/chat/resume`, {
    method: "POST",
    headers: {
      "content-type": req.headers.get("content-type") ?? "application/json",
    },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}
