WITH low_signal_actions AS (
  SELECT id
  FROM action_items
  WHERE action_type = 'slack_review'
    AND COALESCE(summary, '') !~* '(\\?|can you|could you|please|need|needs|todo|action|review|respond|reply|follow up|blocked|urgent|issue|error|fix|check|send|schedule|what should)'
)
DELETE FROM action_drafts
WHERE action_item_id IN (SELECT id FROM low_signal_actions);

DELETE FROM action_items
WHERE action_type = 'slack_review'
  AND COALESCE(summary, '') !~* '(\\?|can you|could you|please|need|needs|todo|action|review|respond|reply|follow up|blocked|urgent|issue|error|fix|check|send|schedule|what should)';

DELETE FROM signals
WHERE signal_type = 'slack_review'
  AND COALESCE(summary, '') !~* '(\\?|can you|could you|please|need|needs|todo|action|review|respond|reply|follow up|blocked|urgent|issue|error|fix|check|send|schedule|what should)';
