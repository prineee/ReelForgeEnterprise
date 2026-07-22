/**
 * mockData.ts
 *
 * Placeholder demo data for the Movie Library. No endpoint exists yet that
 * lists every generated movie, so this stands in until a real list source
 * exists — every field mirrors LibraryMovie exactly, so swapping this out
 * for a real fetch later is a drop-in data-source replacement.
 */

import type { AssetKey, LibraryMetrics, LibraryMovie, MovieAsset, StageTimelineEntry } from './types'

const ASSET_LABELS: Record<AssetKey, string> = {
  story: 'Story',
  characterBible: 'Character Bible',
  referenceImages: 'Reference Images',
  sceneImages: 'Scene Images',
  videos: 'Videos',
  voice: 'Voice',
  subtitles: 'Subtitles',
  poster: 'Poster',
  thumbnail: 'Thumbnail',
}

const ASSET_ORDER: AssetKey[] = [
  'story',
  'characterBible',
  'referenceImages',
  'sceneImages',
  'videos',
  'voice',
  'subtitles',
  'poster',
  'thumbnail',
]

const STAGE_LABELS = [
  'Story Planning',
  'Character Planning',
  'Environment Planning',
  'Camera Planning',
  'Emotion Planning',
  'Scene Planning',
  'Character Images',
  'Prompt Composition',
  'Video Generation',
  'Movie Assembly',
  'Final Rendering',
]

function assets(available: Partial<Record<AssetKey, number | true>>): MovieAsset[] {
  return ASSET_ORDER.map((key) => {
    const value = available[key]
    return {
      key,
      label: ASSET_LABELS[key],
      available: value !== undefined,
      count: typeof value === 'number' ? value : undefined,
    }
  })
}

function timeline(doneCount: number): StageTimelineEntry[] {
  return STAGE_LABELS.map((label, i) => ({ label, done: i < doneCount }))
}

const now = Date.now()
const hoursAgo = (h: number) => new Date(now - h * 60 * 60_000).toISOString()

export const MOCK_MOVIES: LibraryMovie[] = [
  {
    productionId: 'b7f0c1a2-1111-4a1b-8c2d-000000000001',
    title: 'The Last Signal',
    posterUrl: null,
    createdAt: hoursAgo(2),
    durationSeconds: 96,
    resolution: '1080x1920',
    status: 'COMPLETED',
    creditsUsed: 42,
    characterCount: 3,
    sceneCount: 12,
    generationTimeSeconds: 26 * 60,
    prompt:
      'A brilliant detective discovers that the AI governing the city has been manipulating citizens’ memories.',
    storySummary:
      'Detective Mira Chen uncovers a conspiracy at the heart of the city’s AI governance system, and must decide who to trust before her own memories are next.',
    characters: ['Mira Chen', 'Director Voss', 'ECHO (the city AI)'],
    keywords: ['thriller', 'ai', 'detective', 'memory', 'city'],
    assets: assets({
      story: true,
      characterBible: true,
      referenceImages: 3,
      sceneImages: 12,
      videos: 12,
      voice: true,
      subtitles: true,
      poster: true,
      thumbnail: true,
    }),
    timeline: timeline(11),
    storageBytes: 482 * 1024 * 1024,
    downloadUrl: 'https://res.cloudinary.com/demo/video/upload/the-last-signal-final.mp4',
  },
  {
    productionId: 'b7f0c1a2-1111-4a1b-8c2d-000000000002',
    title: 'Neon Requiem',
    posterUrl: null,
    createdAt: hoursAgo(6),
    durationSeconds: 144,
    resolution: '1080x1920',
    status: 'COMPLETED',
    creditsUsed: 88,
    characterCount: 5,
    sceneCount: 18,
    generationTimeSeconds: 35 * 60,
    prompt: 'A synthwave revenge story set in a rain-soaked megacity, told across one final night.',
    storySummary:
      'A disgraced bounty hunter has one night to clear her name before the syndicate that framed her erases every trace she existed.',
    characters: ['Kade', 'Syndicate Broker', 'Ash', 'Warden Rell', 'The Informant'],
    keywords: ['synthwave', 'revenge', 'noir', 'cyberpunk'],
    assets: assets({
      story: true,
      characterBible: true,
      referenceImages: 5,
      sceneImages: 18,
      videos: 18,
      voice: true,
      subtitles: true,
      poster: true,
      thumbnail: true,
    }),
    timeline: timeline(11),
    storageBytes: 701 * 1024 * 1024,
    downloadUrl: 'https://res.cloudinary.com/demo/video/upload/neon-requiem-final.mp4',
  },
  {
    productionId: 'b7f0c1a2-1111-4a1b-8c2d-000000000003',
    title: 'Paper Moon',
    posterUrl: null,
    createdAt: hoursAgo(30),
    durationSeconds: 112,
    resolution: '1080x1920',
    status: 'ARCHIVED',
    creditsUsed: 64,
    characterCount: 2,
    sceneCount: 14,
    generationTimeSeconds: 30 * 60,
    prompt: 'A quiet coming-of-age story about two siblings and a paper boat that won’t sink.',
    storySummary:
      'Over one summer, a brother and sister rebuild the paper boat their late father left unfinished, and learn to say goodbye.',
    characters: ['Wren', 'Sam'],
    keywords: ['family', 'coming-of-age', 'drama', 'summer'],
    assets: assets({
      story: true,
      characterBible: true,
      referenceImages: 2,
      sceneImages: 14,
      videos: 14,
      voice: true,
      subtitles: true,
      poster: true,
      thumbnail: true,
    }),
    timeline: timeline(11),
    storageBytes: 388 * 1024 * 1024,
    downloadUrl: 'https://res.cloudinary.com/demo/video/upload/paper-moon-final.mp4',
  },
  {
    productionId: 'b7f0c1a2-1111-4a1b-8c2d-000000000004',
    title: 'Glass City',
    posterUrl: null,
    createdAt: hoursAgo(0.1),
    durationSeconds: 0,
    resolution: '1080x1920',
    status: 'RENDERING',
    creditsUsed: 31,
    characterCount: 4,
    sceneCount: 12,
    generationTimeSeconds: 9 * 60,
    prompt: 'A heist thriller set inside a city made entirely of glass towers, where every wall is a witness.',
    storySummary:
      'A crew of thieves plan the one job everyone said was impossible: robbing the tower where nothing stays hidden.',
    characters: ['Lena', 'Marcus', 'The Architect', 'Detective Osei'],
    keywords: ['heist', 'thriller', 'glass', 'city'],
    assets: assets({
      story: true,
      characterBible: true,
      referenceImages: 4,
      sceneImages: 7,
    }),
    timeline: timeline(8),
    storageBytes: 96 * 1024 * 1024,
    downloadUrl: null,
  },
  {
    productionId: 'b7f0c1a2-1111-4a1b-8c2d-000000000005',
    title: 'Echoes of Tomorrow',
    posterUrl: null,
    createdAt: hoursAgo(1),
    durationSeconds: 0,
    resolution: '1080x1920',
    status: 'FAILED',
    creditsUsed: 19,
    characterCount: 3,
    sceneCount: 10,
    generationTimeSeconds: 4 * 60,
    prompt: 'A time-loop drama where a scientist relives the same rescue attempt, learning something new each time.',
    storySummary:
      'Dr. Aiko Tanaka is trapped reliving the same twelve hours, each loop bringing her closer to saving the one person she keeps losing.',
    characters: ['Dr. Aiko Tanaka', 'Ben', 'Director Kwan'],
    keywords: ['sci-fi', 'time loop', 'drama'],
    assets: assets({
      story: true,
      characterBible: true,
    }),
    timeline: timeline(6),
    storageBytes: 12 * 1024 * 1024,
    downloadUrl: null,
  },
  {
    productionId: 'b7f0c1a2-1111-4a1b-8c2d-000000000006',
    title: 'Glass City (Draft)',
    posterUrl: null,
    createdAt: hoursAgo(0.02),
    durationSeconds: 0,
    resolution: '1080x1920',
    status: 'QUEUED',
    creditsUsed: 2,
    characterCount: 0,
    sceneCount: 0,
    generationTimeSeconds: 0,
    prompt: 'A second pass at the Glass City heist, focused more on the Architect’s betrayal.',
    storySummary: 'Story planning has not produced a blueprint yet.',
    characters: [],
    keywords: ['heist', 'thriller', 'draft'],
    assets: assets({}),
    timeline: timeline(0),
    storageBytes: 0,
    downloadUrl: null,
  },
  {
    productionId: 'b7f0c1a2-1111-4a1b-8c2d-000000000007',
    title: 'Midnight Orchard',
    posterUrl: null,
    createdAt: hoursAgo(80),
    durationSeconds: 128,
    resolution: '1080x1920',
    status: 'COMPLETED',
    creditsUsed: 76,
    characterCount: 4,
    sceneCount: 16,
    generationTimeSeconds: 33 * 60,
    prompt: 'A gentle horror story about an orchard that only grows fruit for one night a year.',
    storySummary:
      'Three childhood friends return to the orchard that took one of their own twenty years ago, and it remembers them.',
    characters: ['Nora', 'Priya', 'Dez', 'The Orchard Keeper'],
    keywords: ['horror', 'folklore', 'friendship'],
    assets: assets({
      story: true,
      characterBible: true,
      referenceImages: 4,
      sceneImages: 16,
      videos: 16,
      voice: true,
      subtitles: true,
      poster: true,
      thumbnail: true,
    }),
    timeline: timeline(11),
    storageBytes: 512 * 1024 * 1024,
    downloadUrl: 'https://res.cloudinary.com/demo/video/upload/midnight-orchard-final.mp4',
  },
]

export function computeLibraryMetrics(movies: LibraryMovie[]): LibraryMetrics {
  return {
    totalMovies: movies.length,
    completed: movies.filter((m) => m.status === 'COMPLETED' || m.status === 'ARCHIVED').length,
    rendering: movies.filter((m) => m.status === 'RENDERING' || m.status === 'QUEUED').length,
    failed: movies.filter((m) => m.status === 'FAILED').length,
    creditsConsumed: movies.reduce((sum, m) => sum + m.creditsUsed, 0),
    totalDurationSeconds: movies.reduce((sum, m) => sum + m.durationSeconds, 0),
    storageUsedBytes: movies.reduce((sum, m) => sum + m.storageBytes, 0),
  }
}
