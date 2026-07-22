import type { ComponentType } from 'react'
import { Book, Clapperboard, FileText, Image, Music2, Sparkles, Users, Video, Voicemail } from 'lucide-react'
import type { AssetFilter, AssetType } from './types'

export const ASSET_TYPE_ORDER: AssetType[] = [
  'STORY',
  'CHARACTER',
  'REFERENCE_IMAGE',
  'SCENE_IMAGE',
  'VIDEO',
  'VOICE',
  'MUSIC',
  'SUBTITLE',
  'POSTER',
  'THUMBNAIL',
]

export const ASSET_TYPE_META: Record<AssetType, { label: string; icon: ComponentType<{ className?: string }>; color: string; bg: string }> = {
  STORY: { label: 'Story', icon: Book, color: 'text-amber-300', bg: 'bg-amber-500/15 border-amber-500/30' },
  CHARACTER: { label: 'Character', icon: Users, color: 'text-pink-300', bg: 'bg-pink-500/15 border-pink-500/30' },
  REFERENCE_IMAGE: { label: 'Reference Image', icon: Image, color: 'text-blue-300', bg: 'bg-blue-500/15 border-blue-500/30' },
  SCENE_IMAGE: { label: 'Scene Image', icon: Image, color: 'text-cyan-300', bg: 'bg-cyan-500/15 border-cyan-500/30' },
  VIDEO: { label: 'Video', icon: Video, color: 'text-purple-300', bg: 'bg-purple-500/15 border-purple-500/30' },
  VOICE: { label: 'Voice', icon: Voicemail, color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  MUSIC: { label: 'Music', icon: Music2, color: 'text-fuchsia-300', bg: 'bg-fuchsia-500/15 border-fuchsia-500/30' },
  SUBTITLE: { label: 'Subtitle', icon: FileText, color: 'text-gray-300', bg: 'bg-white/10 border-white/20' },
  POSTER: { label: 'Poster', icon: Clapperboard, color: 'text-orange-300', bg: 'bg-orange-500/15 border-orange-500/30' },
  THUMBNAIL: { label: 'Thumbnail', icon: Sparkles, color: 'text-yellow-300', bg: 'bg-yellow-500/15 border-yellow-500/30' },
}

export const ASSET_FILTERS: { value: AssetFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'story', label: 'Story' },
  { value: 'character', label: 'Character' },
  { value: 'reference_image', label: 'Reference Image' },
  { value: 'scene_image', label: 'Scene Image' },
  { value: 'video', label: 'Video' },
  { value: 'voice', label: 'Voice' },
  { value: 'music', label: 'Music' },
  { value: 'subtitle', label: 'Subtitle' },
  { value: 'poster', label: 'Poster' },
  { value: 'thumbnail', label: 'Thumbnail' },
]

export const FILTER_TO_TYPE: Record<Exclude<AssetFilter, 'all'>, AssetType> = {
  story: 'STORY',
  character: 'CHARACTER',
  reference_image: 'REFERENCE_IMAGE',
  scene_image: 'SCENE_IMAGE',
  video: 'VIDEO',
  voice: 'VOICE',
  music: 'MUSIC',
  subtitle: 'SUBTITLE',
  poster: 'POSTER',
  thumbnail: 'THUMBNAIL',
}
