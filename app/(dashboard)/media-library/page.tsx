'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Film, Image, Upload, Search, Check, AlertCircle, Loader2, X, Play, RefreshCw, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'reelforge_selected_background'

interface MediaItem {
  id: number | string
  url: string
  thumbnail: string
  type: 'video' | 'image'
  duration: number
  width?: number
  height?: number
  source?: 'pexels' | 'upload'
  public_id?: string
}

const TABS = ['Stock Videos', 'Stock Images', 'My Uploads'] as const
type Tab = typeof TABS[number]

const SUGGESTED = ['lifestyle', 'motivation', 'nature', 'city', 'technology', 'business', 'fitness', 'travel']

export default function MediaLibraryPage() {
  const [activeTab, setActiveTab]         = useState<Tab>('Stock Videos')
  const [query, setQuery]                 = useState('')
  const [inputValue, setInputValue]       = useState('')
  const [page, setPage]                   = useState(1)
  const [media, setMedia]                 = useState<MediaItem[]>([])
  const [uploads, setUploads]             = useState<MediaItem[]>([])
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [selectedId, setSelectedId]       = useState<number | string>('')
  const [hoveredId, setHoveredId]         = useState<number | string>('')
  const [dragOver, setDragOver]           = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [uploadError, setUploadError]     = useState('')
  const videoRefs = useRef<Record<string | number, HTMLVideoElement | null>>({})
  const dropRef   = useRef<HTMLDivElement>(null)

  // Load saved selection and uploads
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) { const m = JSON.parse(saved) as MediaItem; setSelectedId(m.id) }
      const savedUploads = localStorage.getItem('reelforge_uploads')
      if (savedUploads) setUploads(JSON.parse(savedUploads) as MediaItem[])
    } catch { /* ignore */ }
  }, [])

  // Auto-fetch on tab change
  useEffect(() => {
    if (activeTab === 'Stock Videos' || activeTab === 'Stock Images') {
      fetchMedia(query || 'lifestyle', 1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const fetchMedia = useCallback(async (q: string, p: number) => {
    setLoading(true); setError('')
    try {
      const type   = activeTab === 'Stock Videos' ? 'video' : 'image'
      const res    = await fetch(`/api/media/pexels?query=${encodeURIComponent(q)}&type=${type}&page=${p}&per_page=20`)
      const json   = await res.json() as { media?: MediaItem[]; error?: string }
      if (!res.ok) { setError(typeof json.error === 'string' ? json.error : 'Failed to load media'); return }
      const items  = (json.media ?? []).map(m => ({ ...m, source: 'pexels' as const }))
      setMedia(prev => p === 1 ? items : [...prev, ...items])
      setPage(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally { setLoading(false) }
  }, [activeTab])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault(); setQuery(inputValue); fetchMedia(inputValue, 1)
  }

  function selectItem(item: MediaItem) {
    setSelectedId(item.id)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(item)) } catch { /* ignore */ }
  }

  function clearSelection() {
    setSelectedId('')
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  async function handleUploadFile(file: File) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setUploadError('Only images and videos are supported'); return
    }
    setUploading(true); setUploadError('')
    try {
      const form = new FormData(); form.append('file', file)
      const res  = await fetch('/api/media/upload', { method: 'POST', body: form })
      const json = await res.json() as MediaItem & { error?: string }
      if (!res.ok) { setUploadError((json as { error?: string }).error ?? 'Upload failed'); return }
      const item: MediaItem = { ...json, id: Date.now(), source: 'upload' }
      const newUploads = [item, ...uploads]
      setUploads(newUploads)
      try { localStorage.setItem('reelforge_uploads', JSON.stringify(newUploads.slice(0, 50))) } catch { /* ignore */ }
      selectItem(item)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally { setUploading(false) }
  }

  function removeUpload(id: number | string) {
    const updated = uploads.filter(u => u.id !== id)
    setUploads(updated)
    if (selectedId === id) clearSelection()
    try { localStorage.setItem('reelforge_uploads', JSON.stringify(updated)) } catch { /* ignore */ }
  }

  const selectedItem = [...media, ...uploads].find(m => m.id === selectedId)

  const MediaGrid = ({ items }: { items: MediaItem[] }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {items.map(item => {
        const isSelected = selectedId === item.id
        return (
          <button
            key={item.id}
            onClick={() => selectItem(item)}
            onMouseEnter={() => { setHoveredId(item.id); videoRefs.current[item.id]?.play() }}
            onMouseLeave={() => { setHoveredId(''); videoRefs.current[item.id]?.pause() }}
            className={cn(
              'relative group rounded-xl overflow-hidden border-2 transition-all text-left',
              isSelected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-surface-border hover:border-brand-700/60'
            )}
          >
            <div className="relative aspect-[3/4] bg-surface overflow-hidden">
              {item.type === 'video' && hoveredId === item.id ? (
                <video
                  ref={el => { videoRefs.current[item.id] = el }}
                  src={item.url}
                  muted loop playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
              )}

              {isSelected && (
                <div className="absolute inset-0 bg-brand-600/20 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                </div>
              )}

              {item.type === 'video' && !isSelected && (
                <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded-md px-1.5 py-0.5">
                  <Play className="w-3 h-3 text-white" />
                  <span className="text-white text-xs">{item.duration}s</span>
                </div>
              )}

              {item.source === 'upload' && (
                <button
                  onClick={e => { e.stopPropagation(); removeUpload(item.id) }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Media Library</h1>
          <p className="text-gray-400 text-sm">Choose background videos or images for your reels</p>
        </div>
        {selectedItem && (
          <div className="flex items-center gap-3 bg-brand-950/60 border border-brand-800 rounded-xl px-4 py-2.5">
            <img src={selectedItem.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover" />
            <div className="text-sm">
              <p className="text-white font-medium capitalize">{selectedItem.type}</p>
              <p className="text-brand-400 text-xs">{selectedItem.source === 'pexels' ? 'Pexels' : 'My Upload'}</p>
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
          <button key={tab} onClick={() => { setActiveTab(tab); setMedia([]) }} className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
            activeTab === tab ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
          )}>
            {tab === 'Stock Videos' ? <Film className="w-3.5 h-3.5" /> : tab === 'Stock Images' ? <Image className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            {tab}
          </button>
        ))}
      </div>

      {/* Search bar (Pexels tabs) */}
      {(activeTab === 'Stock Videos' || activeTab === 'Stock Images') && (
        <div className="space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input className="input pl-9" placeholder={`Search ${activeTab.toLowerCase()}…`}
                value={inputValue} onChange={e => setInputValue(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </Button>
          </form>

          {/* Suggestions */}
          {!query && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED.map(s => (
                <button key={s} onClick={() => { setInputValue(s); setQuery(s); fetchMedia(s, 1) }}
                  className="px-2.5 py-1 rounded-md text-xs border border-surface-border text-gray-400 hover:border-brand-700 hover:text-white transition-colors capitalize">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {error && (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm text-red-400">{String(error)}</p>
            <Button variant="secondary" onClick={() => fetchMedia(query || 'lifestyle', 1)}>
              <RefreshCw className="w-4 h-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab !== 'My Uploads' && !error && (
        <>
          {loading && page === 1 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-surface-card border border-surface-border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {media.length > 0 && <MediaGrid items={media} />}
              {media.length === 0 && !loading && (
                <div className="py-16 text-center text-gray-500 text-sm">Search for {activeTab.toLowerCase()} above</div>
              )}
              {media.length > 0 && (
                <div className="flex justify-center pt-2">
                  <Button variant="secondary" disabled={loading} onClick={() => fetchMedia(query, page + 1)}>
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</> : <>Load More <ChevronRight className="w-4 h-4" /></>}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'My Uploads' && (
        <div className="space-y-5">
          {/* Upload drop zone */}
          <div
            ref={dropRef}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUploadFile(f) }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => document.getElementById('media-upload-input')?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
              dragOver ? 'border-brand-500 bg-brand-600/5' : 'border-surface-border hover:border-brand-700'
            )}
          >
            <input
              id="media-upload-input"
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFile(f) }}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
                <p className="text-sm text-gray-400">Uploading…</p>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Drag & drop or <span className="text-brand-400 underline">browse</span></p>
                <p className="text-xs text-gray-600 mt-1">Images (10MB) · Videos (100MB)</p>
              </>
            )}
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {uploadError}
            </div>
          )}

          {uploads.length > 0 ? (
            <MediaGrid items={uploads} />
          ) : (
            <div className="py-10 text-center text-gray-500 text-sm">No uploads yet. Drop a file above to get started.</div>
          )}
        </div>
      )}
    </div>
  )
}
