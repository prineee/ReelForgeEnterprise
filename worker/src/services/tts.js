'use strict'

const axios = require('axios')
const fs    = require('fs')
const path  = require('path')

// Voice mapping for TTS providers
const VOICE_MAP = {
  tara: { openai: 'nova',    gender: 'female' },
  leah: { openai: 'shimmer', gender: 'female' },
  jess: { openai: 'alloy',   gender: 'female' },
  leo:  { openai: 'onyx',    gender: 'male'   },
  dan:  { openai: 'fable',   gender: 'male'   },
  mia:  { openai: 'echo',    gender: 'female' },
}

// Split text into chunks at sentence boundaries
function splitText(text, maxLen) {
  if (!maxLen) maxLen = 4000
  if (!text || !text.trim()) return []
  if (text.length <= maxLen) return [text.trim()]

  var sentences = text.replace(/([.!?])\s+/g, '$1|||').split('|||')
  var chunks = []
  var current = ''

  for (var i = 0; i < sentences.length; i++) {
    var sentence = sentences[i]
    if ((current + ' ' + sentence).trim().length <= maxLen) {
      current = (current + ' ' + sentence).trim()
    } else {
      if (current) chunks.push(current.trim())
      current = sentence
    }
  }
  if (current) chunks.push(current.trim())
  return chunks.filter(Boolean)
}

// OpenAI TTS — reliable, real male/female voices, ~$0.015/1K chars
async function openaiTTS(text, voice, apiKey) {
  var response = await axios.post(
    'https://api.openai.com/v1/audio/speech',
    {
      model:           'tts-1',
      input:           text.slice(0, 4096),
      voice:           voice,
      response_format: 'mp3',
      speed:           1.0,
    },
    {
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type':  'application/json',
      },
      responseType: 'arraybuffer',
      timeout:      60000,
    }
  )
  var buf = Buffer.from(response.data)
  if (buf.length < 100) throw new Error('OpenAI TTS returned empty buffer')
  console.log('[TTS/OpenAI] Success voice=' + voice + ' bytes=' + buf.length)
  return buf
}

// Google Translate TTS — free, works from Railway, female voice only
async function googleTTSChunk(text) {
  var encoded = encodeURIComponent(text.slice(0, 200))
  var url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encoded + '&tl=en&client=tw-ob'
  var response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer':    'https://translate.google.com/',
    },
    responseType: 'arraybuffer',
    timeout:      15000,
  })
  var buf = Buffer.from(response.data)
  if (buf.length < 100) throw new Error('Google TTS empty response')
  return buf
}

// Split text into small chunks for Google TTS (200 char limit)
function splitSmall(text) {
  var sentences = text.replace(/([.!?])\s+/g, '$1\n').split('\n').map(function(s) { return s.trim() }).filter(Boolean)
  var out = []
  for (var i = 0; i < sentences.length; i++) {
    var s = sentences[i]
    for (var j = 0; j < s.length; j += 180) {
      out.push(s.slice(j, j + 180))
    }
  }
  return out.filter(Boolean)
}

/**
 * Main TTS function.
 * Priority: OpenAI (reliable) → Google TTS (free fallback)
 *
 * @param {string} text       - Full narration text
 * @param {string} voiceId    - tara/leah/jess/leo/dan/mia
 * @param {string} outputPath - File path to write audio
 * @returns {Promise<string>} outputPath
 */
async function generateVoiceover(text, voiceId, outputPath) {
  var voiceConfig = VOICE_MAP[voiceId] || VOICE_MAP['tara']
  var openaiVoice = voiceConfig.openai
  var openaiKey   = process.env.OPENAI_API_KEY

  console.log('[TTS] Starting | voiceId=' + voiceId + ' openaiVoice=' + openaiVoice + ' chars=' + text.length)

  // ATTEMPT 1: OpenAI TTS — single request per 4000 chars, no rate limits
  if (openaiKey) {
    try {
      var chunks   = splitText(text, 4000)
      console.log('[TTS/OpenAI] Attempting ' + chunks.length + ' chunk(s)')
      var buffers  = []

      for (var i = 0; i < chunks.length; i++) {
        console.log('[TTS/OpenAI] Chunk ' + (i + 1) + '/' + chunks.length + ' (' + chunks[i].length + ' chars)')
        var buf = await openaiTTS(chunks[i], openaiVoice, openaiKey)
        buffers.push(buf)
        if (i < chunks.length - 1) {
          await new Promise(function(r) { setTimeout(r, 500) })
        }
      }

      var combined = Buffer.concat(buffers)
      fs.writeFileSync(outputPath, combined)
      console.log('[TTS/OpenAI] Complete: ' + outputPath + ' (' + combined.length + ' bytes)')
      return outputPath
    } catch (err) {
      console.warn('[TTS/OpenAI] Failed: ' + err.message + ' — trying Google TTS')
    }
  } else {
    console.warn('[TTS] OPENAI_API_KEY not set — skipping OpenAI')
  }

  // ATTEMPT 2: Google Translate TTS — free, chunked, Railway can reach it
  console.warn('[TTS] Using Google TTS fallback (free, female voice only)')
  var smallChunks = splitSmall(text)
  console.log('[TTS/Google] ' + smallChunks.length + ' small chunks')

  var googleBuffers = []
  var successCount  = 0

  for (var ci = 0; ci < smallChunks.length; ci++) {
    var success = false
    for (var attempt = 1; attempt <= 3; attempt++) {
      try {
        var gbuf = await googleTTSChunk(smallChunks[ci])
        googleBuffers.push(gbuf)
        successCount++
        success = true
        console.log('[TTS/Google] Chunk ' + (ci + 1) + '/' + smallChunks.length + ' OK (' + gbuf.length + ' bytes)')
        break
      } catch (e) {
        console.warn('[TTS/Google] Chunk ' + (ci + 1) + ' attempt ' + attempt + '/3 failed: ' + e.message)
        if (attempt < 3) await new Promise(function(r) { setTimeout(r, 1500 * attempt) })
      }
    }
    if (!success) {
      // Insert silence rather than dropping chunk
      googleBuffers.push(Buffer.alloc(8820, 0))
      console.warn('[TTS/Google] Chunk ' + (ci + 1) + ' failed all attempts — inserting silence')
    }
    if (ci < smallChunks.length - 1) {
      await new Promise(function(r) { setTimeout(r, 350) })
    }
  }

  console.log('[TTS/Google] ' + successCount + '/' + smallChunks.length + ' chunks succeeded')

  if (googleBuffers.length === 0) {
    throw new Error('All TTS providers failed. Set OPENAI_API_KEY in Railway variables.')
  }

  var finalBuf = Buffer.concat(googleBuffers)
  fs.writeFileSync(outputPath, finalBuf)
  console.log('[TTS/Google] Saved ' + outputPath + ' (' + finalBuf.length + ' bytes)')
  return outputPath
}

/**
 * HTTP handler for POST /api/tts/synthesize
 */
async function handleTTSSynthesize(req, res) {
  var text  = req.body && req.body.text
  var voice = req.body && req.body.voice

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text required' })
  }

  var os     = require('os')
  var uuid   = require('uuid')
  var tmpPath = path.join(os.tmpdir(), 'tts_' + uuid.v4().slice(0, 8) + '.mp3')

  try {
    await generateVoiceover(text, voice || 'tara', tmpPath)
    var audioBuffer = fs.readFileSync(tmpPath)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', audioBuffer.length)
    res.send(audioBuffer)
    console.log('[TTS/synthesize] Sent ' + audioBuffer.length + ' bytes')
  } catch (err) {
    console.error('[TTS/synthesize] Failed:', err.message)
    res.status(502).json({ error: err.message })
  } finally {
    try { fs.unlinkSync(tmpPath) } catch (e) { /* ignore */ }
  }
}

module.exports = { generateVoiceover, handleTTSSynthesize }