-- Phase 2 AI Dialogue Movie Mode: standardize movie_mode values to
-- 'standard' | 'dialogue' | 'talking_character'.

UPDATE cartoon_stories SET movie_mode = 'dialogue' WHERE movie_mode = 'ai_dialogue';

ALTER TABLE cartoon_stories
  ADD CONSTRAINT cartoon_stories_movie_mode_check
  CHECK (movie_mode IN ('standard', 'dialogue', 'talking_character'));
