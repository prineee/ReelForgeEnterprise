// FILE: lib/cartoon/types.ts
// Shared TypeScript types for Cartoon Studio — used by API routes and frontend

// ── Visual Styles ─────────────────────────────────────────────────────────────
export type VisualStyle =
  | 'anime'
  | 'cartoon'
  | 'comic_book'
  | 'watercolor'
  | 'pixel_art'
  | 'clay'
  | 'cinematic'
  | 'sketch'

// ── Genre ─────────────────────────────────────────────────────────────────────
export type Genre =
  | 'adventure'
  | 'comedy'
  | 'drama'
  | 'horror'
  | 'romance'
  | 'sci_fi'
  | 'fantasy'
  | 'thriller'
  | 'mystery'

// ── Movie Mode ────────────────────────────────────────────────────────────────
export type MovieMode = 'standard' | 'dialogue' | 'talking_character'

export interface DialogueLine {
  speaker: string
  text:    string
}

// Credit multiplier applied to the base duration-tier cost in generate-story
export const MODE_MULTIPLIER: Record<MovieMode, number> = {
  standard:         1,
  dialogue:         2,
  talking_character: 1, // placeholder — no extra generation work yet
}

// ── Motion Effects ────────────────────────────────────────────────────────────
export type MotionEffect =
  | 'zoom_in'
  | 'zoom_out'
  | 'pan_left'
  | 'pan_right'
  | 'ken_burns'
  | 'static'

// ── Story Status ──────────────────────────────────────────────────────────────
export type StoryStatus =
  | 'draft'
  | 'generating_images'
  | 'images_ready'
  | 'generating_video'
  | 'completed'
  | 'failed'

// ── Character Role ────────────────────────────────────────────────────────────
export type CharacterRole = 'main' | 'supporting' | 'villain' | 'narrator'

// ── Image Status ──────────────────────────────────────────────────────────────
export type ImageStatus = 'pending' | 'generating' | 'completed' | 'failed'

// ─────────────────────────────────────────────────────────────────────────────
// DB ROW TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CartoonSeries {
  id:             string
  user_id:        string
  title:          string
  description:    string | null
  universe_prompt: string | null
  visual_style:   VisualStyle
  genre:          Genre
  episode_count:  number
  thumbnail_url:  string | null
  created_at:     string
}

export interface CartoonStory {
  id:              string
  user_id:         string
  series_id:       string | null
  episode_number:  number | null
  title:           string
  prompt:          string
  storyline:       string | null
  genre:           Genre
  visual_style:    VisualStyle
  voice_id:        string
  caption_style:   string
  status:          StoryStatus
  scene_count:     number
  video_url:       string | null
  thumbnail_url:   string | null
  duration_seconds: number
  credits_used:    number
  youtube_video_id: string | null
  published_at:    string | null
  created_at:      string
  updated_at:      string
  movie_mode:      MovieMode | null
  voice_map:       Record<string, string> | null
}

export interface CartoonCharacter {
  id:                  string
  user_id:             string
  story_id:            string | null
  series_id:           string | null
  name:                string
  role:                CharacterRole
  description:         string
  visual_prompt:       string
  personality:         string | null
  reference_image_url: string | null
  created_at:          string
}

export interface CartoonScene {
  id:                   string
  story_id:             string
  scene_number:         number
  title:                string | null
  narration:            string
  image_prompt:         string
  visual_description:   string | null
  visual_keywords:      string[]
  characters_in_scene:  string[]
  visual_style:         VisualStyle | null
  motion_effect:        MotionEffect
  duration_seconds:     number
  image_url:            string | null
  image_status:         ImageStatus
  generation_attempts:  number
  created_at:           string
  dialogue_json:        DialogueLine[] | null
}

// ─────────────────────────────────────────────────────────────────────────────
// API REQUEST / RESPONSE TYPES
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/cartoon/generate-story
export interface GenerateStoryRequest {
  prompt:           string         // "Alien Revenge"
  genre?:           Genre          // default: adventure
  visual_style?:    VisualStyle    // default: anime
  duration_minutes?: number        // 1 | 3 | 5 | 10 — default: 1
  voice_id?:        string         // default: tara
  movie_mode?:      MovieMode      // default: standard
}

// Scene as returned by Groq (before DB save)
export interface GeneratedScene {
  number:            number
  title:             string
  narration:         string         // voiceover text
  visualDescription: string         // what appears on screen
  visualKeywords:    string[]       // 3 specific search/image terms
  imagePrompt:       string         // full Flux/SD generation prompt
  charactersInScene: string[]       // character names in this scene
  motionEffect:      MotionEffect
  duration_seconds:  number         // from word count / 2.5
  dialogue:          DialogueLine[] // per-character lines for this scene
}

// Character as returned by Groq
export interface GeneratedCharacter {
  name:         string
  role:         CharacterRole
  description:  string
  visualPrompt: string         // full image prompt fragment for consistency
  personality:  string
}

// Full API response
export interface GenerateStoryResponse {
  story_id:    string
  title:       string
  storyline:   string
  genre:       Genre
  visual_style: VisualStyle
  scene_count: number
  duration_minutes: number
  movie_mode:  MovieMode
  characters:  GeneratedCharacter[]
  scenes:      GeneratedScene[]
}

// GET /api/cartoon/stories
export interface CartoonStoryListItem {
  id:           string
  title:        string
  prompt:       string
  genre:        Genre
  visual_style: VisualStyle
  status:       StoryStatus
  scene_count:  number
  video_url:    string | null
  thumbnail_url: string | null
  created_at:   string
}

// GET /api/cartoon/stories/[id]
export interface CartoonStoryDetail extends CartoonStory {
  characters: CartoonCharacter[]
  scenes:     CartoonScene[]
}

// Visual style prompt suffixes
export const STYLE_PROMPTS: Record<VisualStyle, string> = {
  anime:      'anime style, Studio Ghibli inspired, clean lines, vibrant colors, expressive characters, 9:16 vertical',
  cartoon:    'western cartoon style, bold black outlines, flat vivid colors, exaggerated expressions, 9:16 vertical',
  comic_book: 'comic book style, bold ink outlines, halftone dots, dramatic lighting, Marvel style, 9:16 vertical',
  watercolor: 'watercolor illustration, soft edges, pastel colors, artistic brush strokes, 9:16 vertical',
  pixel_art:  '16-bit pixel art style, retro game aesthetic, chunky pixels, vibrant palette, 9:16 vertical',
  clay:       'claymation style, 3D clay figures, smooth surfaces, warm lighting, stop-motion aesthetic, 9:16 vertical',
  cinematic:  'photorealistic cinematic, dramatic lighting, film grain, epic movie poster style, 9:16 vertical',
  sketch:     'pencil sketch illustration, hand-drawn, black and white with subtle shading, artistic, 9:16 vertical',
}

// Motion effect variety patterns — cycles through for visual diversity
export const MOTION_SEQUENCE: MotionEffect[] = [
  'ken_burns',
  'zoom_in',
  'pan_right',
  'zoom_out',
  'pan_left',
  'ken_burns',
  'zoom_in',
  'pan_right',
]

// Duration config
export const DURATION_CONFIG: Record<number, { scenes: number; wordsPerScene: number }> = {
  1:  { scenes: 10,  wordsPerScene: 25 },
  3:  { scenes: 30,  wordsPerScene: 30 },
  5:  { scenes: 50,  wordsPerScene: 30 },
  10: { scenes: 100, wordsPerScene: 30 },
}