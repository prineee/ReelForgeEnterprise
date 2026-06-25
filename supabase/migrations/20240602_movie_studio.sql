-- Characters table (memory system)
CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age TEXT,
  gender TEXT,
  appearance TEXT,
  personality TEXT,
  voice_id TEXT,
  style TEXT DEFAULT 'realistic',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Movies table
CREATE TABLE IF NOT EXISTS movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  genre TEXT,
  style TEXT DEFAULT 'cinematic',
  duration_minutes INTEGER DEFAULT 3,
  plot TEXT,
  screenplay JSONB,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','generating','ready','failed')),
  video_url TEXT,
  poster_url TEXT,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Movie scenes table
CREATE TABLE IF NOT EXISTS movie_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  title TEXT,
  voiceover TEXT,
  visual_prompt TEXT,
  camera_angle TEXT,
  characters TEXT[],
  location TEXT,
  duration_seconds INTEGER DEFAULT 10,
  video_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TV Series table
CREATE TABLE IF NOT EXISTS tv_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  genre TEXT,
  style TEXT DEFAULT 'cinematic',
  concept TEXT,
  episode_count INTEGER DEFAULT 3,
  character_ids UUID[],
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TV Episodes table
CREATE TABLE IF NOT EXISTS tv_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES tv_series(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title TEXT,
  plot TEXT,
  screenplay JSONB,
  video_url TEXT,
  status TEXT DEFAULT 'draft',
  duration_minutes INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own characters" ON characters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own movies" ON movies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own movie_scenes" ON movie_scenes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own tv_series" ON tv_series FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own tv_episodes" ON tv_episodes FOR ALL USING (auth.uid() = user_id);
