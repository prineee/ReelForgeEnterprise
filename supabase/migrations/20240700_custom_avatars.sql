CREATE TABLE IF NOT EXISTS custom_avatars (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL DEFAULT 'Custom Avatar',
  preview_url TEXT       NOT NULL,
  engine     TEXT        NOT NULL DEFAULT 'wav2lip' CHECK (engine IN ('wav2lip', 'sadtalker', 'custom')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS custom_avatars_user_id_idx ON custom_avatars(user_id);

ALTER TABLE custom_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own avatars"
  ON custom_avatars FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
