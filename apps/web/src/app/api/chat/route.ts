// Thin proxy: browser → Next.js → agent-runtime.
// Keeps the frontend deployable to Vercel while all agent logic (LangGraph,
// MCP clients, long-running streams) stays on Railway. See PLAN Phase 8 ("The
// Vercel Trap") for why this matters.

export const dynamic = "force-dynamic";

const AGENT_RUNTIME_URL =
  process.env.AGENT_RUNTIME_URL ?? "http://localhost:4000";

export async function POST(req: Request) {
  const body = await req.text();

  const upstream = await fetch(`${AGENT_RUNTIME_URL}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": req.headers.get("content-type") ?? "application/json",
    },
    body,
    // Node/undici needs this flag when the fetch body is a stream. Harmless
    // for a fully-buffered string; future-proofs if we switch to req.body.
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  // Stream the upstream response back unchanged.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}
