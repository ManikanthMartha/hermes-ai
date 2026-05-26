WITH noisy_sources AS (
  SELECT id::text AS id
  FROM source_objects
  WHERE provider = 'slack'
    AND object_type = 'slack_message'
    AND (
      normalized->>'summary' ILIKE '%has joined the channel%'
      OR normalized->>'summary' ILIKE '%has left the channel%'
    )
),
noisy_actions AS (
  SELECT id
  FROM action_items
  WHERE source_ids && ARRAY(SELECT id FROM noisy_sources)
)
DELETE FROM action_drafts
WHERE action_item_id IN (SELECT id FROM noisy_actions);

WITH noisy_sources AS (
  SELECT id::text AS id
  FROM source_objects
  WHERE provider = 'slack'
    AND object_type = 'slack_message'
    AND (
      normalized->>'summary' ILIKE '%has joined the channel%'
      OR normalized->>'summary' ILIKE '%has left the channel%'
    )
)
DELETE FROM action_items
WHERE source_ids && ARRAY(SELECT id FROM noisy_sources);

WITH noisy_sources AS (
  SELECT id::text AS id
  FROM source_objects
  WHERE provider = 'slack'
    AND object_type = 'slack_message'
    AND (
      normalized->>'summary' ILIKE '%has joined the channel%'
      OR normalized->>'summary' ILIKE '%has left the channel%'
    )
)
DELETE FROM signals
WHERE source_ids && ARRAY(SELECT id FROM noisy_sources);

DELETE FROM source_objects
WHERE provider = 'slack'
  AND object_type = 'slack_message'
  AND (
    normalized->>'summary' ILIKE '%has joined the channel%'
    OR normalized->>'summary' ILIKE '%has left the channel%'
  );
