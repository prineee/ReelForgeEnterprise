// FILE: worker/src/services/cartoon/backgroundMusic.js
// Phase 2.8 — Cinematic background music for Standard + Dialogue movie modes.
// Selects a royalty-free track by genre, then builds the FFmpeg filter that
// mixes it UNDER the existing voice/dialogue at a low volume with 2s fades.
//
// Source strategy (no audio is bundled in the repo): operators drop their own
// royalty-free / CC0 tracks (e.g. Pixabay Music, Kevin MacLeod / incompetech,
// YouTube Audio Library) into worker/assets/music/<mood>.<ext>. When a track
// for the resolved mood is missing, resolveMusicTrack() returns null and the
// caller renders normally with no music. See assets/music/README.md.

'use strict'

const path   = require('path')
const fsSync = require('fs')

// Music volume relative to the (unity) dialogue/voice level. 0.12 keeps the bed
// ~10-15% of the spoken level, so dialogue always stays clearly audible.
const MUSIC_VOLUME = 0.12

// Directory holding the royalty-free mood tracks.
const MUSIC_DIR = process.env.CARTOON_MUSIC_DIR
  || path.join(__dirname, '..', '..', '..', 'assets', 'music')

// Accepted audio file extensions, in resolution priority order.
const EXTS = ['mp3', 'm4a', 'wav', 'ogg']

// The six supported musical moods (also the expected filenames sans extension).
const MOODS = ['fantasy', 'adventure', 'comedy', 'drama', 'horror', 'motivational']

// Map every app genre onto one of the six moods. Unknown genres fall back to
// 'adventure' (a safe, energetic neutral bed).
const GENRE_MOOD = {
  fantasy:   'fantasy',
  adventure: 'adventure',
  comedy:    'comedy',
  drama:     'drama',
  horror:    'horror',
  romance:   'drama',        // warm / emotional
  sci_fi:    'adventure',    // epic / driving
  thriller:  'horror',       // tension
  mystery:   'drama',        // suspense
}

/**
 * Resolve the music file for a genre.
 * @param {string} genre
 * @returns {{ path: string, mood: string } | null}  null when no track exists
 */
function resolveMusicTrack(genre) {
  const mood = GENRE_MOOD[genre] || 'adventure'

  // Try the mood filename first, then the raw genre name as a fallback so an
  // operator can drop a genre-specific track without touching this mapping.
  for (const name of [mood, genre]) {
    if (!name) continue
    for (const ext of EXTS) {
      const p = path.join(MUSIC_DIR, `${name}.${ext}`)
      if (fsSync.existsSync(p)) return { path: p, mood }
    }
  }
  return null
}

/**
 * Build the FFmpeg filter_complex that lays the music bed under the voice.
 * The music input is volume-reduced, fades in over the first 2s, fades out over
 * the last 2s, and is trimmed to the movie length; it is then summed with the
 * voice/dialogue stream WITHOUT amix's auto-normalisation so the voice stays at
 * full level.
 *
 * @param {number} musicIdx     FFmpeg input index of the (looped) music input
 * @param {string} voiceStream  Stream specifier of the voice/dialogue, e.g. '1:a' or '0:a'
 * @param {number} totalSecs    Final movie duration in seconds
 * @returns {string}
 */
function buildMixFilter(musicIdx, voiceStream, totalSecs) {
  const dur          = Math.max(Number(totalSecs) || 0, 0)
  const fadeOutStart = Math.max(dur - 2, 0).toFixed(2)
  const durStr       = dur.toFixed(2)

  return (
    `[${musicIdx}:a]volume=${MUSIC_VOLUME},` +
    `afade=t=in:st=0:d=2,` +
    `afade=t=out:st=${fadeOutStart}:d=2,` +
    `atrim=0:${durStr},asetpts=N/SR/TB[mbg];` +
    `[${voiceStream}][mbg]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]`
  )
}

module.exports = { resolveMusicTrack, buildMixFilter, MUSIC_VOLUME, MUSIC_DIR, MOODS }
