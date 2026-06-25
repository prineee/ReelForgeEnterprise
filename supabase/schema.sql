-- ============================================================
-- AI ReelForge — Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE public.users (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name       TEXT,
  email      TEXT UNIQUE NOT NULL,
  plan       TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  credits    INTEGER DEFAULT 10 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE public.projects (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title      TEXT NOT NULL,
  type       TEXT DEFAULT 'reel' CHECK (type IN ('reel', 'short', 'story', 'ad')),
  status     TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- VIDEOS
-- ============================================================
CREATE TABLE public.videos (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id    UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  script        TEXT,
  voice_url     TEXT,
  video_url     TEXT,
  thumbnail_url TEXT,
  duration      INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- THUMBNAILS
-- ============================================================
CREATE TABLE public.thumbnails (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  prompt     TEXT NOT NULL,
  image_url  TEXT,
  style      TEXT DEFAULT 'realistic' CHECK (style IN ('realistic', 'cartoon', 'minimalist', 'cinematic', 'anime')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE public.payments (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  gateway         TEXT DEFAULT 'stripe' CHECK (gateway IN ('stripe', 'paypal', 'razorpay')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  subscription_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- AFFILIATES
-- ============================================================
CREATE TABLE public.affiliates (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  commission    DECIMAL(5,2) DEFAULT 20.00 NOT NULL,
  earnings      DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thumbnails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Projects
CREATE POLICY "projects_all_own" ON public.projects FOR ALL USING (auth.uid() = user_id);

-- Videos (via project ownership)
CREATE POLICY "videos_all_own" ON public.videos FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()
  ));

-- Thumbnails
CREATE POLICY "thumbnails_all_own" ON public.thumbnails FOR ALL USING (auth.uid() = user_id);

-- Payments (read-only for users)
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- Affiliates
CREATE POLICY "affiliates_all_own" ON public.affiliates FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: auto-create user profile on sign-up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_projects_user_id   ON public.projects(user_id);
CREATE INDEX idx_videos_project_id  ON public.videos(project_id);
CREATE INDEX idx_thumbnails_user_id ON public.thumbnails(user_id);
CREATE INDEX idx_payments_user_id   ON public.payments(user_id);
CREATE INDEX idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX idx_affiliates_code    ON public.affiliates(referral_code);
