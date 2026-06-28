import { createClient } from '@/lib/supabase/client'

export function generateAffiliateCode(name?: string) {
  const prefix = (name || 'RF')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 6)

  const random = Math.random().toString(36).substring(2, 7).toUpperCase()

  return `${prefix}${random}`
}