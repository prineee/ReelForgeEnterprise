'use strict'

function pad(n, len) {
  return String(Math.floor(n)).padStart(len, '0')
}

function toSRTTime(seconds) {
  const h  = Math.floor(seconds / 3600)
  const m  = Math.floor((seconds % 3600) / 60)
  const s  = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${pad(h,2)}:${pad(m,2)}:${pad(s,2)},${pad(ms,3)}`
}

/**
 * Generates an SRT subtitle file.
 *
 * Accepts either:
 *  - A plain string  (legacy — splits on sentence punctuation)
 *  - A Scene[]       (new — uses each scene's voiceover text, proportional timing)
 *
 * Timing is distributed proportionally to word count across totalDurationSeconds.
 */
function generateSRT(input, totalDurationSeconds) {
  // Normalise input to a flat array of text chunks
  let chunks
  if (Array.isArray(input)) {
    // Scene array — flatten all voiceover sentences
    chunks = input.flatMap(scene =>
      (scene.voiceover || '')
        .replace(/([.!?])\s+/g, '$1\n')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
    )
  } else {
    // Plain string
    chunks = (input || '')
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
  }

  if (chunks.length === 0) return ''

  const totalWords      = chunks.reduce((sum, c) => sum + c.split(/\s+/).filter(Boolean).length, 0)
  const wordsPerSecond  = Math.max(totalWords / totalDurationSeconds, 0.5)

  const entries = []
  let cursor = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk     = chunks[i]
    const wordCount = chunk.split(/\s+/).filter(Boolean).length
    const duration  = Math.max(0.8, wordCount / wordsPerSecond)

    const start = cursor
    const end   = Math.min(cursor + duration, totalDurationSeconds - 0.05)
    if (start >= totalDurationSeconds) break

    entries.push(`${i + 1}\n${toSRTTime(start)} --> ${toSRTTime(end)}\n${chunk}`)
    cursor = end + 0.05
  }

  return entries.join('\n\n') + '\n'
}

module.exports = { generateSRT }
