-- Series table
CREATE TABLE IF NOT EXISTS series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  niche TEXT,
  cover_url TEXT,
  episode_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Episodes table (links a project/reel to a series)
CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'published')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own series" ON series
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own episodes" ON episodes
  FOR ALL USING (auth.uid() = user_id);

-- Auto-update episode_count on series
CREATE OR REPLACE FUNCTION update_series_episode_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE series SET episode_count = (
    SELECT COUNT(*) FROM episodes WHERE series_id = NEW.series_id
  ), updated_at = now()
  WHERE id = NEW.series_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_episode_count
AFTER INSERT OR DELETE ON episodes
FOR EACH ROW EXECUTE FUNCTION update_series_episode_count();
