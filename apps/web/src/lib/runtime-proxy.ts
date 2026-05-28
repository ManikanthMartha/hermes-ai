import { auth } from "@/lib/auth";
import { workspaceIdForUser } from "@/lib/workspace-scope";

export const AGENT_RUNTIME_URL =
  process.env.AGENT_RUNTIME_URL ?? "http://localhost:4000";

export async function proxyToRuntime(req: Request, path: string) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const method = req.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await req.text();
  const headers = new Headers({
    "content-type": req.headers.get("content-type") ?? "application/json",
  });
  headers.set("x-hermes-user-id", session.user.id);
  headers.set("x-hermes-user-email", session.user.email);
  headers.set("x-hermes-workspace-id", workspaceIdForUser(session.user.id));
  if (process.env.API_SECRET_KEY) {
    headers.set("x-hermes-runtime-secret", process.env.API_SECRET_KEY);
  }

  for (const [key, value] of req.headers.entries()) {
    if (key.toLowerCase().startsWith("x-goog-")) {
      headers.set(key, value);
    }
  }

  const upstream = await fetch(`${AGENT_RUNTIME_URL}${path}`, {
    method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
    duplex: body === undefined ? undefined : "half",
  } as RequestInit & { duplex?: "half" });

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    if (location) {
      return Response.redirect(redirectUrl(location, req.url), upstream.status);
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}

function redirectUrl(location: string, requestUrl: string): URL {
  const appOrigin =
    process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? new URL(requestUrl).origin;
  return new URL(location, appOrigin);
}
