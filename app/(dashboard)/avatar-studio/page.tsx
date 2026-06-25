'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { User, Upload, Check, AlertCircle, Loader2, RefreshCw, Search, Play, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'reelforge_selected_avatar'

interface Avatar {
  avatar_id: string
  name: string
  gender: string
  preview_image_url: string
  preview_video_url: string
  type: 'builtin' | 'talking_photo'
}

const TABS = ['Built-in Avatars', 'Upload Your Photo'] as const
type Tab = typeof TABS[number]

export default function AvatarStudioPage() {
  const [activeTab, setActiveTab]             = useState<Tab>('Built-in Avatars')
  const [avatars, setAvatars]                 = useState<Avatar[]>([])
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [search, setSearch]                   = useState('')
  const [genderFilter, setGenderFilter]       = useState<'all' | 'male' | 'female'>('all')
  const [selectedId, setSelectedId]           = useState<string>('')
  const [hoveredId, setHoveredId]             = useState<string>('')
  const [uploadFile, setUploadFile]           = useState<File | null>(null)
  const [uploadPreview, setUploadPreview]     = useState<string>('')
  const [uploading, setUploading]             = useState(false)
  const [uploadError, setUploadError]         = useState('')
  const [uploadSuccess, setUploadSuccess]     = useState<Avatar | null>(null)
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const dropRef = useRef<HTMLDivElement>(null)

  // Load persisted selection
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) { const a = JSON.parse(saved) as Avatar; setSelectedId(a.avatar_id) }
    } catch { /* ignore */ }
    fetchAvatars()
  }, [])

  const fetchAvatars = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/heygen/avatars')
      if (!res.ok) { const d = await res.json(); setError(typeof d.error === 'string' ? d.error : 'Failed to load avatars'); return }
      const { avatars: list } = await res.json() as { avatars: Avatar[] }
      setAvatars(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally { setLoading(false) }
  }, [])

  function selectAvatar(avatar: Avatar) {
    setSelectedId(avatar.avatar_id)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(avatar)) } catch { /* ignore */ }
  }

  function clearSelection() {
    setSelectedId('')
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  // File drop
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) setFilePreview(f)
  }

  function setFilePreview(f: File) {
    setUploadFile(f); setUploadError(''); setUploadSuccess(null)
    const reader = new FileReader()
    reader.onload = ev => setUploadPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  async function handleUpload() {
    if (!uploadFile) return
    setUploading(true); setUploadError('')
    try {
      const form = new FormData(); form.append('file', uploadFile)
      const res  = await fetch('/api/heygen/upload-avatar', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) { setUploadError(json.error ?? 'Upload failed'); return }

      const newAvatar: Avatar = {
        avatar_id:         json.avatar_id,
        name:              uploadFile.name.replace(/\.[^.]+$/, ''),
        gender:            'unknown',
        preview_image_url: json.preview_url,
        preview_video_url: '',
        type:              'talking_photo',
      }
      setUploadSuccess(newAvatar)
      setAvatars(prev => [newAvatar, ...prev])
      selectAvatar(newAvatar)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally { setUploading(false) }
  }

  const filtered = avatars.filter(a => {
    if (activeTab === 'Built-in Avatars' && a.type === 'talking_photo') return false
    const matchGender = genderFilter === 'all' || a.gender === genderFilter
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
    return matchGender && matchSearch
  })

  const selectedAvatar = avatars.find(a => a.avatar_id === selectedId)

  return (
    <div className="max-w-6xl space-y-6">
      {/* Coming soon banner */}
      <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-800/60 rounded-xl px-4 py-3 text-sm text-amber-300">
        <span className="text-amber-400 text-base">🔧</span>
        Avatar Studio is being upgraded. Available soon.
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Avatar Studio</h1>
          <p className="text-gray-400 text-sm">Choose a HeyGen avatar for AI lipsync video generation</p>
        </div>
        {selectedAvatar && (
          <div className="flex items-center gap-3 bg-brand-950/60 border border-brand-800 rounded-xl px-4 py-2.5">
            <img src={selectedAvatar.preview_image_url} alt={selectedAvatar.name}
              className="w-8 h-8 rounded-full object-cover" />
            <div className="text-sm">
              <p className="text-white font-medium">{selectedAvatar.name}</p>
              <p className="text-brand-400 text-xs">Selected avatar</p>
            </div>
            <button onClick={clearSelection} className="text-gray-500 hover:text-white ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-card border border-surface-border rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === tab ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
          )}>{tab}</button>
        ))}
      </div>

      {activeTab === 'Built-in Avatars' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input className="input pl-9" placeholder="Search avatars…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {(['all', 'female', 'male'] as const).map(g => (
                <button key={g} onClick={() => setGenderFilter(g)} className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize',
                  genderFilter === g ? 'bg-brand-600 border-brand-500 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700'
                )}>{g}</button>
              ))}
            </div>
            <button onClick={fetchAvatars} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
            </button>
          </div>

          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-surface-card border border-surface-border rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
                <p className="text-sm text-red-400">{String(error)}</p>
                <Button variant="secondary" onClick={fetchAvatars}><RefreshCw className="w-4 h-4" /> Retry</Button>
              </CardContent>
            </Card>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="py-16 text-center text-gray-500 text-sm">No avatars match your filters.</div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map(avatar => {
                const isSelected = selectedId === avatar.avatar_id
                return (
                  <button
                    key={avatar.avatar_id}
                    onClick={() => selectAvatar(avatar)}
                    onMouseEnter={() => { setHoveredId(avatar.avatar_id); videoRefs.current[avatar.avatar_id]?.play() }}
                    onMouseLeave={() => { setHoveredId(''); videoRefs.current[avatar.avatar_id]?.pause() }}
                    className={cn(
                      'relative group rounded-xl overflow-hidden border-2 transition-all text-left',
                      isSelected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-surface-border hover:border-brand-700/60'
                    )}
                  >
                    {/* Preview image / video */}
                    <div className="relative aspect-[3/4] bg-surface overflow-hidden">
                      {avatar.preview_video_url && hoveredId === avatar.avatar_id ? (
                        <video
                          ref={el => { videoRefs.current[avatar.avatar_id] = el }}
                          src={avatar.preview_video_url}
                          muted loop playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        avatar.preview_image_url
                          ? <img src={avatar.preview_image_url} alt={avatar.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center bg-surface-card"><User className="w-12 h-12 text-gray-600" /></div>
                      )}

                      {isSelected && (
                        <div className="absolute inset-0 bg-brand-600/20 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      )}

                      {avatar.preview_video_url && !isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                            <Play className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-2.5 bg-surface-card">
                      <p className="text-xs font-medium text-white truncate">{avatar.name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {avatar.gender && avatar.gender !== 'unknown' && (
                          <Badge variant="default" className="text-xs capitalize py-0 px-1.5">{avatar.gender}</Badge>
                        )}
                        {avatar.type === 'talking_photo' && (
                          <Badge variant="info" className="text-xs py-0 px-1.5">Custom</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Upload Your Photo' && (
        <div className="max-w-lg space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4 text-brand-400" /> Upload Your Photo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-gray-500">
                Upload a clear, front-facing photo. HeyGen will create a talking avatar that lip-syncs to your voiceover.
              </p>

              {/* Drop zone */}
              <div
                ref={dropRef}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onDragEnter={() => dropRef.current?.classList.add('border-brand-500')}
                onDragLeave={() => dropRef.current?.classList.remove('border-brand-500')}
                className="border-2 border-dashed border-surface-border rounded-xl p-8 text-center transition-colors hover:border-brand-700 cursor-pointer"
                onClick={() => document.getElementById('avatar-upload-input')?.click()}
              >
                <input
                  id="avatar-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setFilePreview(f) }}
                />
                {uploadPreview ? (
                  <img src={uploadPreview} alt="Preview" className="mx-auto max-h-48 rounded-xl object-cover" />
                ) : (
                  <>
                    <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Drag & drop a photo here or <span className="text-brand-400 underline">browse</span></p>
                    <p className="text-xs text-gray-600 mt-1">JPG, PNG, WEBP up to 10MB</p>
                  </>
                )}
              </div>

              {uploadFile && (
                <div className="flex items-center justify-between text-xs text-gray-400 bg-surface rounded-lg px-3 py-2">
                  <span className="truncate">{uploadFile.name}</span>
                  <button onClick={() => { setUploadFile(null); setUploadPreview('') }} className="text-gray-600 hover:text-white ml-2">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {uploadError && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div className="flex items-center gap-3 text-sm bg-green-950/30 border border-green-800 rounded-lg px-3 py-2">
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-green-300">Avatar created and selected!</span>
                </div>
              )}

              <Button onClick={handleUpload} disabled={true} className="w-full">
                {uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating avatar…</>
                  : <><Upload className="w-4 h-4" /> Create Avatar</>
                }
              </Button>
            </CardContent>
          </Card>

          <div className="text-xs text-gray-500 bg-surface-card border border-surface-border rounded-lg px-4 py-3 space-y-1">
            <p className="font-medium text-gray-400">Tips for best results:</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Use a clear, well-lit front-facing photo</li>
              <li>Plain or simple background works best</li>
              <li>Photo should show head and shoulders</li>
              <li>Avoid sunglasses or hats</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
