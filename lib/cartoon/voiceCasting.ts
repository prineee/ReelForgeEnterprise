// FILE: lib/cartoon/voiceCasting.ts
// Maps generated cartoon characters to TTS voice IDs based on gender heuristics.
// Mirrors worker/src/services/cartoon/voiceCasting.js so app-router routes can
// build voice_map without round-tripping to the worker.

import type { GeneratedCharacter } from './types'

const FEMALE_VOICES  = ['tara', 'leah', 'jess', 'mia']
const MALE_VOICES    = ['leo', 'dan']
const NARRATOR_VOICE = 'dan'

function detectGender(name: string, description = '', personality = ''): 'female' | 'male' | null {
  const txt = `${name} ${description} ${personality}`.toLowerCase()
  if (/\b(she|her|hers|woman|girl|female|queen|princess|witch|lady|mother|sister|daughter|wife)\b/.test(txt))
    return 'female'
  if (/\b(he|him|his|man|boy|male|king|prince|wizard|lord|father|brother|son|husband)\b/.test(txt))
    return 'male'
  return null
}

export function buildVoiceMap(
  characters: Pick<GeneratedCharacter, 'name' | 'role' | 'description' | 'personality'>[]
): Record<string, string> {
  const map: Record<string, string> = { Narrator: NARRATOR_VOICE }
  let fi = 0, mi = 0, ai = 0

  for (const c of characters || []) {
    if (!c.name) continue
    if (c.role === 'narrator') { map[c.name] = NARRATOR_VOICE; continue }

    const gender = detectGender(c.name, c.description, c.personality)
    if (gender === 'female') {
      map[c.name] = FEMALE_VOICES[fi % FEMALE_VOICES.length]; fi++
    } else if (gender === 'male') {
      map[c.name] = MALE_VOICES[mi % MALE_VOICES.length]; mi++
    } else {
      if (ai % 2 === 0) { map[c.name] = FEMALE_VOICES[fi % FEMALE_VOICES.length]; fi++ }
      else               { map[c.name] = MALE_VOICES[mi % MALE_VOICES.length];    mi++ }
      ai++
    }
  }

  return map
}
