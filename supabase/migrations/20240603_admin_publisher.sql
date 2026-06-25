-- Admin role flag on users table (app uses 'users' not 'profiles')
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_credits_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;

-- Publish jobs table
CREATE TABLE IF NOT EXISTS publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id TEXT,
  movie_id UUID,
  video_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  hashtags TEXT[],
  platforms TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','processing','published','failed')),
  results JSONB DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Platform connections table
CREATE TABLE IF NOT EXISTS platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube','tiktok','instagram','facebook')),
  access_token TEXT,
  refresh_token TEXT,
  channel_name TEXT,
  channel_id TEXT,
  connected_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, platform)
);

-- Credit transactions log
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase','usage','refund','admin_grant')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE publish_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own publish_jobs" ON publish_jobs
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own platform_connections" ON platform_connections
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own credit_transactions" ON credit_transactions
  FOR ALL USING (auth.uid() = user_id);

-- To set yourself as admin, run:
-- UPDATE users SET is_admin = true WHERE email = 'your-email@gmail.com';
