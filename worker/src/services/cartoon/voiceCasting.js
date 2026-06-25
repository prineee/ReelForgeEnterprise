// FILE: worker/src/services/cartoon/voiceCasting.js
// Maps cartoon characters to TTS voice IDs based on gender / role heuristics.
// Available voices mirror tts.js VOICE_MAP: tara leah jess mia (F), leo dan (M).

'use strict'

const FEMALE_VOICES  = ['tara', 'leah', 'jess', 'mia']
const MALE_VOICES    = ['leo', 'dan']
const NARRATOR_VOICE = 'dan'   // fable — cinematic, authoritative

function detectGender(character) {
  const txt = [character.name, character.description, character.personality]
    .filter(Boolean).join(' ').toLowerCase()

  if (/\b(she|her|hers|woman|girl|female|queen|princess|witch|lady|mother|sister|daughter|wife)\b/.test(txt))
    return 'female'
  if (/\b(he|him|his|man|boy|male|king|prince|wizard|lord|father|brother|son|husband)\b/.test(txt))
    return 'male'
  if (character.role === 'villain') return 'male'
  return null
}

/**
 * Assigns a TTS voice ID to every character + Narrator.
 *
 * @param {Array<{name: string, role: string, description?: string, personality?: string}>} characters
 * @returns {Record<string, string>}  { "CharacterName": "voiceId", "Narrator": "dan" }
 */
function castVoices(characters) {
  const voiceMap = { Narrator: NARRATOR_VOICE }

  let fi = 0
  let mi = 0
  let ai = 0   // alternating index for ambiguous gender

  for (const char of (characters || [])) {
    if (!char.name) continue
    if (char.role === 'narrator') { voiceMap[char.name] = NARRATOR_VOICE; continue }

    const gender = detectGender(char)
    if (gender === 'female') {
      voiceMap[char.name] = FEMALE_VOICES[fi % FEMALE_VOICES.length]; fi++
    } else if (gender === 'male') {
      voiceMap[char.name] = MALE_VOICES[mi % MALE_VOICES.length]; mi++
    } else {
      // Alternate F/M for unknown gender
      if (ai % 2 === 0) { voiceMap[char.name] = FEMALE_VOICES[fi % FEMALE_VOICES.length]; fi++ }
      else               { voiceMap[char.name] = MALE_VOICES[mi % MALE_VOICES.length];    mi++ }
      ai++
    }
  }

  return voiceMap
}

module.exports = { castVoices }
