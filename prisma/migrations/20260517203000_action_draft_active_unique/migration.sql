WITH ranked_active_drafts AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY workspace_id, action_item_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rank
  FROM action_drafts
  WHERE status = 'active'
)
UPDATE action_drafts
SET status = 'superseded',
    updated_at = now()
WHERE id IN (
  SELECT id
  FROM ranked_active_drafts
  WHERE rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "action_drafts_active_unique_idx"
ON action_drafts("workspace_id", "action_item_id")
WHERE status = 'active';
