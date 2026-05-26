WITH low_signal_slack_sources AS (
  SELECT id::text AS id
  FROM source_objects
  WHERE provider = 'slack'
    AND metadata->>'connectorMode' = 'env'
    AND COALESCE(normalized->>'summary', '') !~* '(\\?|can you|could you|please|need|needs|todo|action|review|respond|reply|follow up|blocked|urgent|issue|error|fix|send|schedule|what should)'
),
remove_actions AS (
  SELECT id
  FROM action_items
  WHERE metadata ? 'smoke'
     OR metadata->>'prototype' = 'true'
     OR metadata->>'createdFrom' = 'action-board'
     OR title ILIKE '%prototype%'
     OR source_ids && ARRAY(SELECT id FROM low_signal_slack_sources)
)
DELETE FROM action_drafts
WHERE action_item_id IN (SELECT id FROM remove_actions);

WITH low_signal_slack_sources AS (
  SELECT id::text AS id
  FROM source_objects
  WHERE provider = 'slack'
    AND metadata->>'connectorMode' = 'env'
    AND COALESCE(normalized->>'summary', '') !~* '(\\?|can you|could you|please|need|needs|todo|action|review|respond|reply|follow up|blocked|urgent|issue|error|fix|send|schedule|what should)'
)
DELETE FROM action_items
WHERE metadata ? 'smoke'
   OR metadata->>'prototype' = 'true'
   OR metadata->>'createdFrom' = 'action-board'
   OR title ILIKE '%prototype%'
   OR source_ids && ARRAY(SELECT id FROM low_signal_slack_sources);

WITH low_signal_slack_sources AS (
  SELECT id::text AS id
  FROM source_objects
  WHERE provider = 'slack'
    AND metadata->>'connectorMode' = 'env'
    AND COALESCE(normalized->>'summary', '') !~* '(\\?|can you|could you|please|need|needs|todo|action|review|respond|reply|follow up|blocked|urgent|issue|error|fix|send|schedule|what should)'
)
DELETE FROM signals
WHERE source_ids && ARRAY(SELECT id FROM low_signal_slack_sources)
   OR metadata->>'connectorMode' = 'prototype';

DELETE FROM source_objects
WHERE provider = 'slack'
  AND metadata->>'connectorMode' = 'env'
  AND COALESCE(normalized->>'summary', '') !~* '(\\?|can you|could you|please|need|needs|todo|action|review|respond|reply|follow up|blocked|urgent|issue|error|fix|send|schedule|what should)';
