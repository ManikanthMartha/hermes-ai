CREATE TABLE IF NOT EXISTS calendar_sync_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  calendar_id varchar(240) NOT NULL DEFAULT 'primary',
  sync_token text,
  watch_channel_id varchar(80),
  watch_resource_id varchar(160),
  watch_resource_uri text,
  watch_token_hash varchar(120),
  watch_expires_at timestamptz,
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS calendar_sync_states_workspace_calendar_key
  ON calendar_sync_states (workspace_id, calendar_id);

CREATE INDEX IF NOT EXISTS calendar_sync_states_watch_channel_idx
  ON calendar_sync_states (watch_channel_id);

CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  calendar_source_object_id uuid,
  provider_event_id varchar(240) NOT NULL,
  title text NOT NULL,
  description text,
  organizer_email varchar(240),
  attendee_emails text[] NOT NULL DEFAULT ARRAY[]::text[],
  location text,
  meeting_url text,
  html_link text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  status varchar(40) NOT NULL DEFAULT 'confirmed',
  prep_status varchar(40) NOT NULL DEFAULT 'not_prepared',
  last_prepared_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS meetings_workspace_provider_event_key
  ON meetings (workspace_id, provider_event_id);

CREATE INDEX IF NOT EXISTS meetings_workspace_start_at_idx
  ON meetings (workspace_id, start_at);

CREATE INDEX IF NOT EXISTS meetings_prep_status_idx
  ON meetings (prep_status);

CREATE TABLE IF NOT EXISTS meeting_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  meeting_id uuid NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'generated',
  summary text,
  agenda jsonb NOT NULL DEFAULT '[]'::jsonb,
  open_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  follow_ups jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  slack_queries jsonb NOT NULL DEFAULT '[]'::jsonb,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meeting_briefs_workspace_meeting_idx
  ON meeting_briefs (workspace_id, meeting_id);

CREATE INDEX IF NOT EXISTS meeting_briefs_status_idx
  ON meeting_briefs (status);
