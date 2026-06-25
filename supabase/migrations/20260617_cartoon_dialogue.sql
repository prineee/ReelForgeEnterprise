-- Phase 1: AI Dialogue Movie Mode
ALTER TABLE cartoon_scenes
  ADD COLUMN IF NOT EXISTS dialogue_json JSONB DEFAULT NULL;

ALTER TABLE cartoon_stories
  ADD COLUMN IF NOT EXISTS voice_map  JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS movie_mode TEXT  DEFAULT 'standard';
