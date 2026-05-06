#!/usr/bin/env tsx
/**
 * One-time Gmail OAuth helper.
 *
 *   pnpm gmail:auth
 *
 * Prereqs:
 *   1. Create a Google Cloud project + enable the Gmail API.
 *   2. Configure the OAuth consent screen. User Type can be either:
 *      - Internal (requires Workspace; refresh tokens don't expire; sign in
 *        with a Workspace account during consent, not personal gmail.com)
 *      - External + Testing (personal Gmail ok; refresh tokens expire every
 *        7 days with restricted scopes — rerun this script when that happens)
 *   3. Create an OAuth Client ID of type "Desktop app". Desktop clients
 *      accept loopback (127.0.0.1) redirects on any port without needing
 *      each port pre-registered — which is why we can use :3333 here.
 *   4. Put GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET into the monorepo .env.
 *
 * This script prints the consent URL, catches the callback on :3333,
 * exchanges the code for a refresh token, and prints it. Copy the refresh
 * token into GOOGLE_REFRESH_TOKEN in .env.
 */

import "@hermes/shared"; // loads .env
import http from "node:http";
import { URL } from "node:url";
import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://127.0.0.1:3333/callback";
const PORT = 3333;
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "[gmail:auth] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env first.",
  );
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  // Explicit params — we pass these all explicitly so the URL is self-
  // describing and we never depend on SDK defaults OR on the OAuth2Client
  // instance's internal state.
  response_type: "code",
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  access_type: "offline", //  refresh_token only appears on first consent w/ offline
  prompt: "consent", //       force re-consent so we actually get a new refresh_token
  scope: SCOPES,
});

console.log(
  "\n─────────────────────────────────────────────────────────────",
);
console.log(" [gmail:auth] Paste this URL into your browser:");
console.log("─────────────────────────────────────────────────────────────\n");
console.log(authUrl);
console.log(
  "\n─────────────────────────────────────────────────────────────",
);
console.log(
  ` [gmail:auth] url length: ${authUrl.length} chars · waiting on ${REDIRECT_URI}`,
);
console.log("─────────────────────────────────────────────────────────────\n");

// Auto-open only on macOS/Linux — safe there because `open` / `xdg-open`
// take the URL as a single exec arg with no shell reparse. On Windows,
// every path (start, cmd /c, PowerShell Start-Process with URL) re-parses
// `&` as a command separator, truncating the URL so Google returns
// "required parameter is missing". Not worth the risk — user can Ctrl-click
// the printed URL in Windows Terminal / VS Code, which handles `&` fine.
if (process.platform !== "win32") {
  try {
    const { spawn } = await import("node:child_process");
    const opener = process.platform === "darwin" ? "open" : "xdg-open";
    spawn(opener, [authUrl], { stdio: "ignore", detached: true }).unref();
  } catch {
    // ignore — user copies the URL from stdout
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/callback")) {
    res.writeHead(404).end();
    return;
  }
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "content-type": "text/plain" }).end(`OAuth error: ${error}`);
    console.error("[gmail:auth] consent denied or errored:", error);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { "content-type": "text/plain" }).end("missing ?code");
    return;
  }

  try {
    const { tokens } = await oauth2.getToken(code);
    const refreshToken = tokens.refresh_token;

    res
      .writeHead(200, { "content-type": "text/html; charset=utf-8" })
      .end(
        `<!doctype html><meta charset="utf-8"><title>hermes gmail auth</title>
<body style="font-family:ui-monospace,Menlo,monospace;background:#0d0d0f;color:#ddd;padding:3rem">
<h1 style="color:#d97757">hermes · gmail auth</h1>
<p>Done — you can close this tab and return to the terminal.</p>
</body>`,
      );

    if (!refreshToken) {
      console.error(
        "\n[gmail:auth] Google didn't return a refresh_token. This usually means you've already granted access before.",
      );
      console.error(
        "[gmail:auth] Revoke access at https://myaccount.google.com/permissions and run this script again.",
      );
    } else {
      console.log("\n[gmail:auth] success. Add this to your monorepo .env:\n");
      console.log(`GOOGLE_REFRESH_TOKEN=${refreshToken}\n`);
      console.log("[gmail:auth] scopes granted:", tokens.scope);
    }
  } catch (e) {
    console.error("[gmail:auth] token exchange failed:", e);
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 500);
  }
});

server.listen(PORT, "127.0.0.1");
