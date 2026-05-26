WITH stale_sources AS (
  SELECT id::text AS id
  FROM source_objects
  WHERE provider = 'slack'
    AND metadata->>'connectorMode' = 'env'
    AND occurred_at < now() - interval '7 days'
),
stale_actions AS (
  SELECT id
  FROM action_items
  WHERE source_ids && ARRAY(SELECT id FROM stale_sources)
)
DELETE FROM action_drafts
WHERE action_item_id IN (SELECT id FROM stale_actions);

WITH stale_sources AS (
  SELECT id::text AS id
  FROM source_objects
  WHERE provider = 'slack'
    AND metadata->>'connectorMode' = 'env'
    AND occurred_at < now() - interval '7 days'
)
DELETE FROM action_items
WHERE source_ids && ARRAY(SELECT id FROM stale_sources);

WITH stale_sources AS (
  SELECT id::text AS id
  FROM source_objects
  WHERE provider = 'slack'
    AND metadata->>'connectorMode' = 'env'
    AND occurred_at < now() - interval '7 days'
)
DELETE FROM signals
WHERE source_ids && ARRAY(SELECT id FROM stale_sources);

DELETE FROM source_objects
WHERE provider = 'slack'
  AND metadata->>'connectorMode' = 'env'
  AND occurred_at < now() - interval '7 days';
