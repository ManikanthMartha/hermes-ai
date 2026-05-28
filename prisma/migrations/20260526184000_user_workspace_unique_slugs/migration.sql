UPDATE workspaces
SET slug = 'personal-' || substr(id::text, 1, 8),
    updated_at = now()
WHERE slug = 'personal'
  AND owner_user_id <> 'local-user';
