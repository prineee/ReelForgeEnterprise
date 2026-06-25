'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Download,
  Plus,
  Type,
  Clock,
  AlertCircle,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

const NICHES = ['Gaming', 'Finance', 'AI', 'Motivation', 'Podcast'] as const
const STYLES = ['MrBeast', 'Clean', 'Dark', 'Minimal'] as const
const FONTS = [
  { label: 'Impact',  value: 'Impact',                       hint: 'Bold' },
  { label: 'Georgia', value: 'Georgia',                      hint: 'Elegant' },
  { label: 'Mono',    value: '"Courier New", monospace',     hint: 'Tech' },
] as const

type Niche     = (typeof NICHES)[number]
type Style     = (typeof STYLES)[number]
type FontValue = (typeof FONTS)[number]['value']

interface ThumbnailRecord {
  id: string
  prompt: string
  image_url: string | null
  style: string
  created_at: string
}

const CANVAS_W = 640
const CANVAS_H = 360

const STYLE_COLORS: Record<Style, string> = {
  MrBeast: 'bg-yellow-950 border-yellow-800 text-yellow-300',
  Clean:   'bg-blue-950 border-blue-800 text-blue-300',
  Dark:    'bg-gray-900 border-gray-700 text-gray-300',
  Minimal: 'bg-surface border-surface-border text-gray-400',
}

export default function ThumbnailPage() {
  const supabase = createClient()

  // ── Form state ──
  const [title, setTitle] = useState('')
  const [niche, setNiche] = useState<Niche>('Gaming')
  const [style, setStyle] = useState<Style>('MrBeast')

  // ── Generation state ──
  const [loading, setLoading]   = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [prompt, setPrompt]     = useState<string | null>(null)

  // ── Canvas editor state ──
  const [activeFont, setActiveFont] = useState<FontValue>('Impact')
  const [textColor, setTextColor]   = useState('#ffffff')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fabricRef = useRef<any>(null)
  const libRef    = useRef<any>(null)
  const capturedTitle = useRef('')

  // ── History state ──
  const [history, setHistory]               = useState<ThumbnailRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setHistoryLoading(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('thumbnails') as any)
      .select('id, prompt, image_url, style, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12) as { data: ThumbnailRecord[] | null }
    if (data) setHistory(data)
    setHistoryLoading(false)
  }, [supabase])

  useEffect(() => { loadHistory() }, [loadHistory])

  // ── Generate handler ──
  async function handleGenerate() {
    if (!title.trim()) return
    setLoading(true)
    setError(null)
    capturedTitle.current = title

    try {
      const res = await fetch('/api/generate/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, niche, style }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setImageUrl(data.imageUrl)
      setPrompt(data.prompt)
      // Refresh history after successful generation
      loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ── Initialize Fabric canvas when imageUrl changes ──
  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return

    let fc: any

    ;(async () => {
      const { fabric } = (await import('fabric')) as any
      libRef.current = fabric

      fabricRef.current?.dispose()

      fc = new fabric.Canvas(canvasRef.current, {
        width: CANVAS_W,
        height: CANVAS_H,
        selection: true,
        preserveObjectStacking: true,
      })
      fabricRef.current = fc

      const proxied = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
      fabric.Image.fromURL(proxied, (img: any) => {
        img.set({ selectable: false, evented: false })
        img.scaleToWidth(CANVAS_W)
        fc.setBackgroundImage(img, fc.renderAll.bind(fc))
      })

      const text = new fabric.IText(capturedTitle.current.toUpperCase() || 'YOUR TITLE HERE', {
        left: 40,
        top: CANVAS_H - 90,
        fontSize: 48,
        fill: '#FFFFFF',
        fontFamily: 'Impact',
        stroke: '#000000',
        strokeWidth: 1.5,
        paintFirst: 'stroke',
        shadow: 'rgba(0,0,0,0.6) 3px 3px 8px',
        lineHeight: 1.1,
      })
      fc.add(text)
      fc.setActiveObject(text)
      fc.renderAll()
    })()

    return () => {
      fc?.dispose()
      fabricRef.current = null
    }
  }, [imageUrl])

  // ── Canvas controls ──
  function applyFont(fontValue: FontValue) {
    setActiveFont(fontValue)
    const obj = fabricRef.current?.getActiveObject()
    if (obj && (obj.type === 'i-text' || obj.type === 'text')) {
      obj.set('fontFamily', fontValue)
      fabricRef.current.renderAll()
    }
  }

  function applyColor(color: string) {
    setTextColor(color)
    const obj = fabricRef.current?.getActiveObject()
    if (obj) {
      obj.set('fill', color)
      fabricRef.current.renderAll()
    }
  }

  function addTextLayer() {
    if (!fabricRef.current || !libRef.current) return
    const text = new libRef.current.IText('NEW TEXT', {
      left: 40, top: 40,
      fontSize: 36,
      fill: textColor,
      fontFamily: activeFont,
      stroke: '#000000',
      strokeWidth: 1,
      paintFirst: 'stroke',
    })
    fabricRef.current.add(text)
    fabricRef.current.setActiveObject(text)
    fabricRef.current.renderAll()
  }

  function handleDownload() {
    if (!fabricRef.current) return
    const dataUrl: string = fabricRef.current.toDataURL({ format: 'png', multiplier: 2, quality: 1 })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `thumbnail-${Date.now()}.png`
    a.click()
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Thumbnail Generator</h1>
        <p className="text-gray-400 text-sm">
          AI-generated images with a live canvas editor — drag text, resize, and export at 1280×720.
        </p>
      </div>

      {/* ── Generator ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* Left: Form */}
        <Card>
          <CardHeader><CardTitle>Configure</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {/* Title */}
            <div>
              <label className="label">Video Title</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. I Spent 100 Days Building an AI…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Niche */}
            <div>
              <label className="label">Niche</label>
              <div className="relative">
                <select
                  className="input appearance-none pr-9 cursor-pointer"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value as Niche)}
                >
                  {NICHES.map((n) => <option key={n}>{n}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Style */}
            <div>
              <label className="label">Style</label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      style === s
                        ? 'bg-brand-600 border-brand-500 text-white'
                        : 'border-surface-border text-gray-400 hover:border-brand-700 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <Button onClick={handleGenerate} disabled={loading || !title.trim()} className="w-full">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating your thumbnail…</>
                : <><Sparkles className="w-4 h-4" /> Generate Thumbnail</>}
            </Button>

            {prompt && (
              <details>
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none">
                  View AI prompt ▸
                </summary>
                <p className="mt-2 text-xs text-gray-500 leading-relaxed">{prompt}</p>
              </details>
            )}
          </CardContent>
        </Card>

        {/* Right: Canvas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>Canvas Editor</CardTitle>

              {imageUrl && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Font picker */}
                  <div className="flex gap-1">
                    {FONTS.map((f) => (
                      <button
                        key={f.value}
                        title={`${f.label} — ${f.hint}`}
                        onClick={() => applyFont(f.value as FontValue)}
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                          activeFont === f.value
                            ? 'bg-brand-600 border-brand-500 text-white'
                            : 'border-surface-border text-gray-400 hover:border-brand-700 hover:text-white'
                        }`}
                        style={{ fontFamily: f.value }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Color picker */}
                  <label
                    className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 border border-surface-border rounded px-2 py-1 hover:border-brand-700 transition-colors"
                    title="Text color"
                  >
                    <Type className="w-3.5 h-3.5" />
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => applyColor(e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                  </label>

                  {/* Add text layer */}
                  <button
                    onClick={addTextLayer}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 border border-surface-border hover:border-brand-700 hover:text-white transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Text
                  </button>

                  {/* Download */}
                  <Button size="sm" onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5" /> PNG 1280×720
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {imageUrl ? (
              <div className="relative">
                {loading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 rounded-lg gap-3">
                    <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
                    <p className="text-sm text-gray-300">Generating new image…</p>
                  </div>
                )}
                <canvas ref={canvasRef} className="rounded-lg max-w-full" style={{ display: 'block' }} />
                <p className="mt-2 text-xs text-gray-500">
                  Click text to select · Drag to reposition · Use handles to resize · Double-click to edit
                </p>
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-sm text-gray-300 font-medium">Generating your thumbnail…</p>
                  <p className="text-xs text-gray-500">OpenAI → Stability SDXL → Canvas (~30s)</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <ImageIcon className="w-12 h-12 text-gray-600" />
                <p className="text-sm text-gray-500">Configure options and generate to open the editor</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── History Grid ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-gray-400" />
          <h2 className="text-base font-semibold">Your Thumbnails</h2>
          {!historyLoading && (
            <span className="text-xs text-gray-500">({history.length} generated)</span>
          )}
        </div>

        {historyLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-video bg-surface-card border border-surface-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <ImageIcon className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-sm text-gray-400 mb-1">No thumbnails yet</p>
              <p className="text-xs text-gray-600">Generate your first thumbnail above — it will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {history.map((thumb) => (
              <ThumbnailCard key={thumb.id} thumb={thumb} styleColors={STYLE_COLORS} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ThumbnailCard({
  thumb,
  styleColors,
}: {
  thumb: ThumbnailRecord
  styleColors: Record<string, string>
}) {
  const [imgError, setImgError] = useState(false)

  function handleDownload() {
    if (!thumb.image_url) return
    const a = document.createElement('a')
    a.href = `/api/proxy-image?url=${encodeURIComponent(thumb.image_url)}`
    a.download = `thumbnail-${thumb.id}.png`
    a.click()
  }

  const styleColor = styleColors[thumb.style] ?? 'bg-surface border-surface-border text-gray-400'

  return (
    <div className="group bg-surface-card border border-surface-border rounded-xl overflow-hidden hover:border-brand-700/50 transition-colors">
      {/* Image */}
      <div className="aspect-video bg-surface relative overflow-hidden">
        {thumb.image_url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb.image_url}
            alt={thumb.prompt.slice(0, 60)}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-600" />
          </div>
        )}

        {/* Download overlay */}
        {thumb.image_url && !imgError && (
          <button
            onClick={handleDownload}
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-sm font-medium text-white"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        )}
      </div>

      {/* Meta */}
      <div className="p-3">
        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-2">{thumb.prompt}</p>
        <div className="flex items-center justify-between">
          <Badge className={`text-xs ${styleColor}`} variant="default">
            {thumb.style}
          </Badge>
          <span className="text-xs text-gray-600">{formatDate(thumb.created_at)}</span>
        </div>
      </div>
    </div>
  )
}
