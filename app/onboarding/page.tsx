'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Video, Check, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const NICHES = [
  { label: 'Tech & AI',    icon: '🤖' },
  { label: 'Fitness',      icon: '💪' },
  { label: 'Business',     icon: '💼' },
  { label: 'Finance',      icon: '💰' },
  { label: 'Motivation',   icon: '🔥' },
  { label: 'Lifestyle',    icon: '✨' },
  { label: 'Food',         icon: '🍕' },
  { label: 'Travel',       icon: '✈️' },
  { label: 'Gaming',       icon: '🎮' },
  { label: 'Entertainment',icon: '🎭' },
]

const PLATFORMS = [
  { id: 'Reels',  label: 'Instagram Reels', icon: '📱', desc: '1B+ users · 90s max'          },
  { id: 'Shorts', label: 'YouTube Shorts',  icon: '▶️', desc: 'Great for discovery'           },
  { id: 'TikTok', label: 'TikTok',          icon: '🎵', desc: 'Fastest growing platform'      },
]

const CHECKLIST = [
  'Account created',
  'Niche selected',
  'Platform chosen',
  '10 free credits added',
]

export default function OnboardingPage() {
  const [step, setStep]                   = useState(1)
  const [selectedNiche, setSelectedNiche] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [completing, setCompleting]       = useState(false)
  const router  = useRouter()
  const supabase = createClient()

  // Auth guard
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function togglePlatform(id: string) {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  async function handleFinish() {
    if (completing) return
    setCompleting(true)
    try {
      if (selectedNiche)     localStorage.setItem('reelforge_default_niche', selectedNiche)
      if (selectedPlatforms.length) localStorage.setItem('reelforge_platforms', JSON.stringify(selectedPlatforms))
      await fetch('/api/user/onboarding-complete', { method: 'POST' })
      router.push('/create-reel')
    } catch {
      router.push('/create-reel')
    }
  }

  const progress = (step / 4) * 100

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
         style={{ background: 'linear-gradient(135deg,#050505,#1a0533,#050505)' }}>

      {/* Progress bar */}
      <div className="w-full max-w-md mb-8">
        <div className="flex justify-between text-xs mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <span>Step {step} of 4</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div className="h-full rounded-full transition-all duration-500"
               style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#7c3aed,#db2777)' }} />
        </div>
        <div className="flex justify-between mt-2">
          {[1,2,3,4].map(n => (
            <div key={n} className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              n < step  ? 'bg-brand-600 text-white'                      :
              n === step? 'bg-brand-600/30 border-2 border-brand-500 text-brand-300' :
                          'bg-transparent border border-gray-700 text-gray-600'
            )}>
              {n < step ? <Check className="w-3 h-3" /> : n}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="w-full max-w-md rounded-2xl p-8 text-white"
           style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>

        {/* ── Step 1: Welcome ── */}
        {step === 1 && (
          <div className="flex flex-col items-center text-center gap-5">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', boxShadow: '0 0 40px rgba(124,58,237,0.4)' }}>
              <Video className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold mb-2">Welcome to ReelForge! 🎬</h1>
              <p style={{ color: 'rgba(255,255,255,0.55)' }}>
                You&apos;re 4 steps away from your first viral reel
              </p>
            </div>
            <div className="w-full space-y-2.5 text-left text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {['Pick your content niche', 'Choose your platform', 'Create your first reel in 60 seconds'].map(item => (
                <div key={item} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />{item}
                </div>
              ))}
            </div>
            <button onClick={() => setStep(2)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', boxShadow: '0 0 30px rgba(124,58,237,0.35)' }}>
              Let&apos;s Go <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Step 2: Pick niche ── */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold mb-1">What kind of content do you create?</h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                This helps us generate better scripts for you
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NICHES.map(n => (
                <button key={n.label} onClick={() => setSelectedNiche(n.label)}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left',
                    selectedNiche === n.label
                      ? 'border-brand-500 bg-brand-600/15 text-white'
                      : 'border-surface-border text-gray-300 hover:border-brand-700/60'
                  )}>
                  <span className="text-lg">{n.icon}</span>{n.label}
                </button>
              ))}
            </div>
            <button onClick={() => setStep(3)} disabled={!selectedNiche}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Step 3: Choose platform ── */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold mb-1">Where do you post content?</h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Select all that apply</p>
            </div>
            <div className="space-y-3">
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => togglePlatform(p.id)}
                  className={cn(
                    'w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all text-left',
                    selectedPlatforms.includes(p.id)
                      ? 'border-brand-500 bg-brand-600/15'
                      : 'border-surface-border hover:border-brand-700/60'
                  )}>
                  <span className="text-3xl">{p.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-white">{p.label}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{p.desc}</p>
                  </div>
                  {selectedPlatforms.includes(p.id) && (
                    <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button onClick={() => setStep(4)} disabled={selectedPlatforms.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Step 4: Ready! ── */}
        {step === 4 && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-950 border-2 border-green-600 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold mb-2">You&apos;re all set! 🎉</h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Your account is ready</p>
            </div>

            <div className="w-full space-y-2 text-left">
              {CHECKLIST.map((item, i) => (
                <div key={item} className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium',
                  'bg-green-950/50 border border-green-900/60 text-green-300'
                )} style={{ animationDelay: `${i * 0.1}s` }}>
                  <Check className="w-4 h-4 text-green-400 shrink-0" />{item}
                </div>
              ))}
            </div>

            <div className="w-full p-5 rounded-2xl text-center"
                 style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
              <p className="font-semibold text-white mb-1">Create your first reel now</p>
              <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>Takes ~2 minutes</p>
              <button onClick={handleFinish} disabled={completing}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', boxShadow: '0 0 25px rgba(124,58,237,0.35)' }}>
                {completing ? 'Setting up…' : <><Video className="w-4 h-4" /> Create My First Reel</>}
              </button>
            </div>

            <button onClick={() => router.push('/dashboard')}
              className="text-sm transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Or explore the dashboard first →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
