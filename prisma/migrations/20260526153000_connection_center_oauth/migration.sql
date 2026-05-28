CREATE TABLE IF NOT EXISTS integration_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  provider varchar(40) NOT NULL,
  state_hash varchar(120) NOT NULL UNIQUE,
  redirect_uri text NOT NULL,
  return_to text,
  code_verifier text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_oauth_states_workspace_provider_idx
  ON integration_oauth_states (workspace_id, provider);

CREATE INDEX IF NOT EXISTS integration_oauth_states_expires_at_idx
  ON integration_oauth_states (expires_at);
