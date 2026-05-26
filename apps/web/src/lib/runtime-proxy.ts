export const AGENT_RUNTIME_URL =
  process.env.AGENT_RUNTIME_URL ?? "http://localhost:4000";

export async function proxyToRuntime(req: Request, path: string) {
  const method = req.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await req.text();

  const upstream = await fetch(`${AGENT_RUNTIME_URL}${path}`, {
    method,
    headers: {
      "content-type": req.headers.get("content-type") ?? "application/json",
    },
    body,
    cache: "no-store",
    duplex: body === undefined ? undefined : "half",
  } as RequestInit & { duplex?: "half" });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}

