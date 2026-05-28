ALTER TABLE memories ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE conversations ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE workspaces ALTER COLUMN owner_user_id DROP DEFAULT;
ALTER TABLE action_items ALTER COLUMN owner_user_id DROP DEFAULT;

UPDATE workspaces
SET slug = 'personal-' || substr(id::text, 1, 8),
    updated_at = now()
WHERE id::text <> '00000000-0000-4000-8000-000000000001'
  AND slug = 'personal';

DO $$
DECLARE
  first_user_id text;
BEGIN
  SELECT id INTO first_user_id
  FROM "user"
  ORDER BY "createdAt" ASC
  LIMIT 1;

  IF first_user_id IS NOT NULL THEN
    UPDATE memories
    SET user_id = first_user_id,
        updated_at = now()
    WHERE user_id = 'local-user';

    UPDATE conversations
    SET user_id = first_user_id,
        updated_at = now()
    WHERE user_id = 'local-user';

    UPDATE workspaces
    SET owner_user_id = first_user_id,
        slug = CASE
          WHEN id::text = '00000000-0000-4000-8000-000000000001'
          THEN 'personal-' || substr(id::text, 1, 8)
          ELSE slug
        END,
        updated_at = now()
    WHERE owner_user_id = 'local-user';

    UPDATE action_items
    SET owner_user_id = first_user_id,
        updated_at = now()
    WHERE owner_user_id = 'local-user';

    INSERT INTO workspace_members (
      id,
      workspace_id,
      user_id,
      role,
      status,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      workspace_id,
      first_user_id,
      role,
      status,
      now(),
      now()
    FROM workspace_members
    WHERE user_id = 'local-user'
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    DELETE FROM workspace_members
    WHERE user_id = 'local-user';
  END IF;
END $$;
