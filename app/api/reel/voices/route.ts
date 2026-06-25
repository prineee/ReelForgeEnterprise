import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface Voice {
  voice_id:    string
  name:        string
  description: string
  gender:      string
  language:    string
  category:    string
  preview_url: string
  accent:      string
}

const ORPHEUS_VOICES: Voice[] = [
  { voice_id: 'tara', name: 'Tara', gender: 'female', accent: 'american', description: 'Warm and professional',  category: 'orpheus', language: 'en', preview_url: '' },
  { voice_id: 'leah', name: 'Leah', gender: 'female', accent: 'american', description: 'Clear and expressive',  category: 'orpheus', language: 'en', preview_url: '' },
  { voice_id: 'jess', name: 'Jess', gender: 'female', accent: 'american', description: 'Friendly and natural',  category: 'orpheus', language: 'en', preview_url: '' },
  { voice_id: 'leo',  name: 'Leo',  gender: 'male',   accent: 'american', description: 'Deep and confident',    category: 'orpheus', language: 'en', preview_url: '' },
  { voice_id: 'dan',  name: 'Dan',  gender: 'male',   accent: 'american', description: 'Casual and engaging',   category: 'orpheus', language: 'en', preview_url: '' },
  { voice_id: 'mia',  name: 'Mia',  gender: 'female', accent: 'american', description: 'Soft and soothing',     category: 'orpheus', language: 'en', preview_url: '' },
]

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.log('[voices] Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[voices] Returning', ORPHEUS_VOICES.length, 'Orpheus v1 voices')
  return NextResponse.json({ voices: ORPHEUS_VOICES })
}
