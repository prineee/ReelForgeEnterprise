'use strict'

const STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','shall','should','may','might','must','can',
  'could','to','of','in','for','on','with','at','by','from','up','about','into',
  'through','and','but','or','nor','so','yet','that','this','these','those','it',
  'its','i','you','he','she','we','they','my','your','his','her','our','their',
  'what','which','who','when','where','why','how','all','each','every','more',
  'most','other','some','such','no','than','too','very','just','over','own',
  'same','then','there','also','get','got','let','like','look','make','new',
  'now','old','one','see','two','use','way','any','as','if','not','only','even',
  'come','go','know','think','take','give','tell','call','good','great','want',
  'need','time','year','people','man','woman','day','work','life','long','little',
  'world','right','place','week','case','point','hand','high','play','turn',
  'move','live','hold','lead','real','small','number','off','always','those',
])

// Camera/direction words to strip from visualNote before using as search term
const CAMERA_WORDS = [
  'close-up', 'close up', 'closeup', 'aerial', 'wide', 'medium', 'shot',
  'pan', 'zoom', 'cut', 'show', 'reveal', 'display', 'view', 'scene',
  'angle', 'perspective', 'camera', 'lens', 'focus',
]
const CAMERA_RE = new RegExp(`\\b(${CAMERA_WORDS.join('|')})\\b`, 'gi')

/**
 * Derives the best Pexels search keyword from a single scene object.
 * Priority: cleaned visualNote → scene title → first content words of voiceover.
 *
 * @param {object} scene - { number, title, voiceover, visualNote, duration }
 * @returns {string} 1–3 word search term
 */
function extractSceneKeyword(scene) {
  // visualNote describes what should appear on screen — maps directly to Pexels search
  const raw = (scene.visualNote || scene.title || scene.voiceover || '').trim()
  return raw
    .replace(/\[.*?\]/g, '')       // strip [b-roll], [close-up] etc.
    .replace(CAMERA_RE, ' ')       // strip camera direction words
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w.toLowerCase()))
    .slice(0, 4)
    .join(' ')
    || 'people'
}

/**
 * Returns top N keywords from a plain script string.
 * Used by the legacy processReel pipeline.
 */
function extractKeywords(script, count = 5) {
  const words = script
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w))

  const freq = {}
  for (const w of words) freq[w] = (freq[w] || 0) + 1

  const ranked = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)

  const keywords = ranked.slice(0, count)

  const fallbacks = ['nature', 'city', 'technology', 'business', 'people', 'travel', 'lifestyle']
  let fi = 0
  while (keywords.length < count) keywords.push(fallbacks[fi++ % fallbacks.length])

  return keywords
}

module.exports = { extractKeywords, extractSceneKeyword }
