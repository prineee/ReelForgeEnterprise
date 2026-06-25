'use client'

import { useState } from 'react'
import {
  Rocket, Loader2, Download, AlertCircle, Play, RefreshCw,
  User, Megaphone, Film,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdResult {
  video_url: string
  hook?: string
  voiceover?: string
  visual_prompt?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AD_STYLES = [
  { id: 'ugc',        icon: '📱', name: 'UGC Style',            desc: 'Authentic creator-style, casual tone, social-native format' },
  { id: 'cgi',        icon: '✨', name: 'CGI Commercial',        desc: 'Premium brand commercial, polished visuals, professional' },
  { id: 'cinematic',  icon: '🎬', name: 'Cinematic Narrative',   desc: 'Story-driven emotional ad, Hollywood production quality' },
  { id: 'wild',       icon: '🎲', name: 'Wild Card',             desc: 'AI Director chooses the best approach for your product' },
] as const

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook'] as const
const DURATIONS = [15, 30, 60] as const
const UGC_TONES = ['Excited', 'Casual', 'Professional', 'Funny'] as const
const BRAND_EMOTIONS = ['Inspire', 'Trust', 'Excitement', 'Nostalgia'] as const
const STORY_DURATIONS = [30, 60, 90] as const

// ── Video Output ──────────────────────────────────────────────────────────────

function VideoOutput({ result, loading, error, onRegenerate }: {
  result: AdResult | null; loading: boolean; error: string; onRegenerate: () => void
}) {
  if (loading) return (
    <div className="min-h-[320px] flex flex-col items-center justify-center bg-surface-card border border-surface-border rounded-2xl gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-purple-900" />
        <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 animate-spin" />
        <Rocket className="absolute inset-0 m-auto w-7 h-7 text-purple-400" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-white">Generating your ad…</p>
        <p className="text-xs text-gray-500 mt-1">Writing script · Creating visuals · Uploading</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-start gap-2 bg-red-950/40 border border-red-800 rounded-xl px-4 py-3">
      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <p className="text-sm text-red-400">{String(error)}</p>
    </div>
  )

  if (!result) return (
    <div className="min-h-[320px] flex flex-col items-center justify-center bg-surface-card border border-surface-border rounded-2xl gap-3">
      <Film className="w-12 h-12 text-gray-600" />
      <p className="text-gray-500 text-sm">Your ad video will appear here</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="relative mx-auto rounded-2xl overflow-hidden border border-surface-border bg-black" style={{ maxWidth: 320, aspectRatio: '9/16' }}>
        <video src={result.video_url} controls playsInline className="w-full h-full object-cover" style={{ colorScheme: 'dark' }} />
        <div className="absolute top-2 right-2">
          <Play className="w-5 h-5 text-white/70" />
        </div>
      </div>
      {result.hook && (
        <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 space-y-2">
          {result.hook && <p className="text-xs font-semibold text-brand-400">Hook: <span className="text-white">{result.hook}</span></p>}
          {result.voiceover && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1">Voiceover Script</p>
              <p className="text-xs text-gray-300 leading-relaxed">{result.voiceover}</p>
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <a href={result.video_url} download target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
          <Download className="w-3.5 h-3.5" /> Download
        </a>
        <Button variant="secondary" size="sm" onClick={onRegenerate}>
          <RefreshCw className="w-3.5 h-3.5" /> Regenerate
        </Button>
      </div>
    </div>
  )
}

// ── Pill selector ─────────────────────────────────────────────────────────────

function Pills<T extends string | number>({ options, value, onChange }: {
  options: readonly T[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={String(o)} onClick={() => onChange(o)} className={cn(
          'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
          value === o ? 'bg-brand-600 border-brand-500 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700 hover:text-white'
        )}>{String(o)}{typeof o === 'number' ? 's' : ''}</button>
      ))}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MarketingStudioPage() {
  const [tab, setTab] = useState<'product' | 'ugc' | 'brand'>('product')

  // Product Ad state
  const [productName, setProductName]   = useState('')
  const [productDesc, setProductDesc]   = useState('')
  const [adStyle, setAdStyle]           = useState<typeof AD_STYLES[number]['id']>('ugc')
  const [platform, setPlatform]         = useState<typeof PLATFORMS[number]>('Instagram')
  const [adDuration, setAdDuration]     = useState<typeof DURATIONS[number]>(30)

  // UGC state
  const [ugcCharacter, setUgcCharacter] = useState('')
  const [ugcProduct, setUgcProduct]     = useState('')
  const [ugcPoints, setUgcPoints]       = useState(['', '', ''])
  const [ugcTone, setUgcTone]           = useState<typeof UGC_TONES[number]>('Casual')

  // Brand story state
  const [brandName, setBrandName]       = useState('')
  const [brandValues, setBrandValues]   = useState('')
  const [brandEmotion, setBrandEmotion] = useState<typeof BRAND_EMOTIONS[number]>('Inspire')
  const [storyDuration, setStoryDuration] = useState<typeof STORY_DURATIONS[number]>(30)

  // Generation state
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [result, setResult]     = useState<AdResult | null>(null)

  async function generate(payload: object) {
    setLoading(true); setError(''); setResult(null)
    try {
      const res  = await fetch('/api/marketing/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(typeof json.error === 'string' ? json.error : 'Generation failed'); return }
      setResult(json as AdResult)
    } catch { setError('Network error. Please try again.') }
    finally { setLoading(false) }
  }

  function generateProduct() {
    if (!productName.trim()) return
    generate({ product_name: productName, product_description: productDesc, ad_style: adStyle, platform, duration: adDuration, tab: 'product' })
  }

  function generateUGC() {
    if (!ugcProduct.trim()) return
    const desc = `Character: ${ugcCharacter}\nTalking points: ${ugcPoints.filter(Boolean).join(', ')}\nTone: ${ugcTone}`
    generate({ product_name: ugcProduct, product_description: desc, ad_style: 'ugc', platform: 'TikTok', duration: 30, tab: 'ugc' })
  }

  function generateBrand() {
    if (!brandName.trim()) return
    generate({ product_name: brandName, product_description: `Brand values: ${brandValues}\nTarget emotion: ${brandEmotion}`, ad_style: 'cinematic', platform, duration: storyDuration, tab: 'brand' })
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Marketing Studio</h1>
        <p className="text-gray-400 text-sm">Turn any product or brand into a professional ad video</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-card border border-surface-border rounded-xl p-1">
        {([
          { id: 'product', label: 'Product Ad',   icon: <Megaphone className="w-3.5 h-3.5" /> },
          { id: 'ugc',     label: 'UGC Video',    icon: <User className="w-3.5 h-3.5" /> },
          { id: 'brand',   label: 'Brand Story',  icon: <Film className="w-3.5 h-3.5" /> },
        ] as const).map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); setError('') }} className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all',
            tab === t.id ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
          )}>{t.icon}{t.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT: Form ── */}
        <div className="space-y-4">

          {/* Product Ad Tab */}
          {tab === 'product' && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm">Product Details</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="label">Product Name <span className="text-red-500">*</span></label>
                    <input className="input" placeholder="e.g. AquaFlow Bottle" value={productName} onChange={e => setProductName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Product Description</label>
                    <textarea className="input min-h-[72px] resize-y text-sm" placeholder="What does it do? Who is it for? Key benefits..." value={productDesc} onChange={e => setProductDesc(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Ad Style</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {AD_STYLES.map(s => (
                      <button key={s.id} onClick={() => setAdStyle(s.id)} className={cn(
                        'p-3 rounded-xl border-2 text-left transition-all',
                        adStyle === s.id ? 'border-brand-500 bg-brand-600/10' : 'border-surface-border hover:border-brand-700/50 bg-surface-card'
                      )}>
                        <span className="text-lg">{s.icon}</span>
                        <p className="text-xs font-semibold text-white mt-1">{s.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-tight">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <label className="label">Platform</label>
                    <Pills options={PLATFORMS} value={platform} onChange={setPlatform} />
                  </div>
                  <div>
                    <label className="label">Duration</label>
                    <Pills options={DURATIONS} value={adDuration} onChange={setAdDuration} />
                  </div>
                </CardContent>
              </Card>

              <Button onClick={generateProduct} disabled={loading || !productName.trim()} className="w-full" size="md">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : '🚀 Generate Ad Video'}
              </Button>
            </>
          )}

          {/* UGC Tab */}
          {tab === 'ugc' && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm">UGC Video</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="label">Product to Promote <span className="text-red-500">*</span></label>
                    <input className="input" placeholder="e.g. ProteinShake Pro" value={ugcProduct} onChange={e => setUgcProduct(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Character Description</label>
                    <input className="input text-sm" placeholder="Fitness enthusiast, 28F, energetic personality..." value={ugcCharacter} onChange={e => setUgcCharacter(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Talking Points</label>
                    {ugcPoints.map((p, i) => (
                      <input key={i} className="input text-sm mb-2" placeholder={`Point ${i + 1}…`} value={p}
                        onChange={e => { const pts = [...ugcPoints]; pts[i] = e.target.value; setUgcPoints(pts) }} />
                    ))}
                  </div>
                  <div>
                    <label className="label">Tone</label>
                    <Pills options={UGC_TONES} value={ugcTone} onChange={setUgcTone} />
                  </div>
                </CardContent>
              </Card>
              <Button onClick={generateUGC} disabled={loading || !ugcProduct.trim()} className="w-full" size="md">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : '🎤 Generate UGC Video'}
              </Button>
            </>
          )}

          {/* Brand Story Tab */}
          {tab === 'brand' && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-sm">Brand Story</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="label">Brand Name <span className="text-red-500">*</span></label>
                    <input className="input" placeholder="e.g. NovaBrew" value={brandName} onChange={e => setBrandName(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Brand Values</label>
                    <textarea className="input min-h-[80px] resize-y text-sm" placeholder="Sustainability, craftsmanship, community, innovation..." value={brandValues} onChange={e => setBrandValues(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Target Emotion</label>
                    <Pills options={BRAND_EMOTIONS} value={brandEmotion} onChange={setBrandEmotion} />
                  </div>
                  <div>
                    <label className="label">Duration</label>
                    <Pills options={STORY_DURATIONS} value={storyDuration} onChange={setStoryDuration} />
                  </div>
                </CardContent>
              </Card>
              <Button onClick={generateBrand} disabled={loading || !brandName.trim()} className="w-full" size="md">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : '🎬 Generate Brand Story'}
              </Button>
            </>
          )}
        </div>

        {/* ── RIGHT: Output ── */}
        <div>
          <VideoOutput result={result} loading={loading} error={error} onRegenerate={() => {
            if (tab === 'product') generateProduct()
            else if (tab === 'ugc') generateUGC()
            else generateBrand()
          }} />
        </div>
      </div>
    </div>
  )
}
