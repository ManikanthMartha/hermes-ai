WITH prototype_sync_runs AS (
  SELECT id::text AS id
  FROM sync_runs
  WHERE sync_type = 'prototype_watch'
),
prototype_actions AS (
  SELECT id
  FROM action_items
  WHERE metadata->>'syncRunId' IN (SELECT id FROM prototype_sync_runs)
     OR metadata->>'connectorMode' = 'prototype'
     OR title ILIKE 'Prototype:%'
)
DELETE FROM action_drafts
WHERE action_item_id IN (SELECT id FROM prototype_actions);

WITH prototype_sync_runs AS (
  SELECT id::text AS id
  FROM sync_runs
  WHERE sync_type = 'prototype_watch'
)
DELETE FROM action_items
WHERE metadata->>'syncRunId' IN (SELECT id FROM prototype_sync_runs)
   OR metadata->>'connectorMode' = 'prototype'
   OR title ILIKE 'Prototype:%';

WITH prototype_sync_runs AS (
  SELECT id::text AS id
  FROM sync_runs
  WHERE sync_type = 'prototype_watch'
)
DELETE FROM signals
WHERE metadata->>'syncRunId' IN (SELECT id FROM prototype_sync_runs)
   OR metadata->>'connectorMode' = 'prototype';

DELETE FROM source_objects
WHERE metadata->>'connectorMode' = 'prototype'
   OR external_id LIKE 'prototype:%';

DELETE FROM sync_runs
WHERE sync_type = 'prototype_watch';

UPDATE integration_accounts
SET status = 'not_connected',
    scopes = '[]'::jsonb,
    config = '{}'::jsonb,
    last_successful_sync = NULL,
    last_attempted_sync = NULL,
    failure_reason = NULL,
    updated_at = now()
WHERE config->>'connectorMode' = 'prototype'
   OR config->>'simulated' = 'true';
