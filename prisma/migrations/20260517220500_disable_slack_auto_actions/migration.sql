WITH slack_actions AS (
  SELECT id
  FROM action_items
  WHERE action_type = 'slack_review'
)
DELETE FROM action_drafts
WHERE action_item_id IN (SELECT id FROM slack_actions);

DELETE FROM action_items
WHERE action_type = 'slack_review';

DELETE FROM signals
WHERE signal_type = 'slack_review';
