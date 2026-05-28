export interface ConnectionProvider {
  provider: string;
  label: string;
  category: string;
  description: string;
  authKind: "oauth" | "oauth_or_token";
  status: string;
  scopes: string[];
  requiredScopes: string[];
  oauthReady: boolean;
  envFallbackReady: boolean;
  connectedBy: string | null;
  credential: {
    updatedAt: string;
    expiresAt: string | null;
    hasRefreshToken: boolean;
    account: Record<string, unknown>;
  } | null;
  lastSuccessfulSync: string | null;
  lastAttemptedSync: string | null;
  failureReason: string | null;
  updatedAt: string | null;
}
