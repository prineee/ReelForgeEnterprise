'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Video, ArrowRight, Star, Check, Play, Users, Globe, Clock, Zap, Menu, X,
} from 'lucide-react'
import ShowcaseVideoCard from '@/components/ShowcaseVideoCard'
// ── Data ───────────────────────────────────────────────────────────────────────

const FEATURES = [
  { emoji: '🎬', title: 'Cinema Studio',       desc: 'Shot-by-shot AI filmmaking with camera controls, lighting, and genre direction' },
  { emoji: '📺', title: 'Series Generator',     desc: 'Multi-episode AI series with story continuity and character memory across episodes' },
  { emoji: '🎭', title: 'Character Studio',     desc: 'Build reusable characters. Same face, voice, and personality across every production' },
  { emoji: '📱', title: 'Create Reel',          desc: 'Topic to viral reel in 60 seconds. AI script, voiceover, and stock clips' },
  { emoji: '🚀', title: 'Marketing Studio',     desc: 'URL to ad video. UGC, CGI, cinematic — any format for any platform' },
  { emoji: '🎵', title: 'HeyGen Lipsync',       desc: 'Talking avatar videos with perfect lipsync. Your AI spokesperson, always available' },
]

const STATS = [
  { label: 'Creators',       value: '10,000+',  icon: Users },
  { label: 'Videos Created', value: '500,000+', icon: Video },
  { label: 'Languages',      value: '50+',       icon: Globe },
  { label: 'Uptime',         value: '99.9%',     icon: Clock },
]

const PLANS = [
  { name: 'Free',    priceINR: null,     priceUSD: null,  credits: 10,   features: ['10 Pro credits', '720p exports', 'Watermarked output', 'Community support'],          cta: 'Start Free',   href: '/register', highlight: false },
  { name: 'Starter', priceINR: '₹499',   priceUSD: '$6',  credits: 100,  features: ['100 credits', '1080p exports', 'All content tools', 'Email support'],                     cta: 'Get Starter',  href: '/register', highlight: false },
  { name: 'Pro',     priceINR: '₹1,499', priceUSD: '$18', credits: 500,  features: ['500 credits', '4K exports', 'All content tools', 'Priority support', 'Affiliate program'],cta: 'Get Pro',      href: '/register', highlight: true  },
  { name: 'Agency',  priceINR: '₹4,999', priceUSD: '$60', credits: 2000, features: ['2,000 credits', '4K exports', 'API access', 'Dedicated manager', 'Custom branding'],      cta: 'Get Agency',   href: '/register', highlight: false },
]

const TESTIMONIALS = [
  { name: 'Sarah Johnson', role: 'Fitness Creator · 420K followers', avatar: 'SJ', rating: 5, quote: 'I went from spending 3 hours on a single reel to publishing 5 a day. ReelForge literally 10×ed my output — and the thumbnails are fire.' },
  { name: 'Marcus Chen',   role: 'Finance YouTuber · 1.2M subscribers', avatar: 'MC', rating: 5, quote: 'The script tool nails the hook-problem-solution format every time. My click-through rate went up 40% in the first two weeks.' },
  { name: 'Priya Sharma',  role: 'Social Media Agency Owner', avatar: 'PS', rating: 5, quote: 'We use the Agency plan for all our clients. The credit system makes it dead simple to track costs per project. ROI is insane.' },
]

const SHOWCASE_VIDEOS = [
  { id: 1, url: 'https://videos.pexels.com/video-files/3571264/3571264-uhd_1440_2560_25fps.mp4',  poster: 'https://images.pexels.com/videos/3571264/free-video-3571264.jpg',  label: 'Fitness Reel',    niche: 'Fitness & Health', views: '2.4M' },
  { id: 2, url: 'https://videos.pexels.com/video-files/3045163/3045163-uhd_1440_2560_25fps.mp4',  poster: 'https://images.pexels.com/videos/3045163/free-video-3045163.jpg',  label: 'Lifestyle Reel',  niche: 'Lifestyle',        views: '1.8M' },
  { id: 3, url: 'https://videos.pexels.com/video-files/4065377/4065377-uhd_2160_4096_24fps.mp4',  poster: 'https://images.pexels.com/videos/4065377/free-video-4065377.jpg',  label: 'Business Reel',   niche: 'Business',         views: '3.1M' },
  { id: 4, url: 'https://videos.pexels.com/video-files/3209828/3209828-uhd_1440_2560_25fps.mp4',  poster: 'https://images.pexels.com/videos/3209828/free-video-3209828.jpg',  label: 'Motivation Reel', niche: 'Motivation',       views: '4.2M' },
  { id: 5, url: 'https://videos.pexels.com/video-files/5532771/5532771-hd_1080_1920_25fps.mp4',   poster: 'https://images.pexels.com/videos/5532771/free-video-5532771.jpg',  label: 'Tech Reel',       niche: 'Tech & AI',        views: '892K' },
  { id: 6, url: 'https://videos.pexels.com/video-files/3195394/3195394-uhd_1440_2560_25fps.mp4',  poster: 'https://images.pexels.com/videos/3195394/free-video-3195394.jpg',  label: 'Travel Reel',     niche: 'Travel',           views: '5.6M' },
]

const COMPARISON_WITHOUT = [
  '3–4 hours per reel', 'Need video editing skills', 'Expensive equipment',
  'Writer\'s block on scripts', 'Inconsistent posting', 'Pay voiceover artists',
]
const COMPARISON_WITH = [
  'Reel ready in 2 minutes', 'Zero editing skills needed', 'Just a phone or laptop',
  'AI writes viral scripts', 'Consistent daily posting', 'AI voiceover included free',
]

const CREATOR_TYPES = [
  { emoji: '📱', label: 'Instagram Creators',  desc: 'Reels that stop the scroll'    },
  { emoji: '▶️', label: 'YouTube Creators',    desc: 'Shorts optimised for discovery' },
  { emoji: '🎵', label: 'TikTok Influencers',  desc: 'Fast-paced viral content'       },
  { emoji: '📊', label: 'Marketing Agencies',  desc: 'Scale client content 10×'       },
  { emoji: '🏪', label: 'Small Businesses',    desc: 'Affordable video marketing'     },
  { emoji: '🎓', label: 'Course Creators',     desc: 'Promote courses with AI reels'  },
]

const FAQS = [
  { q: 'What is ReelForge?',                       a: 'ReelForge is an AI-powered video creator that automatically generates scripts, voiceovers, and video reels for Instagram, TikTok, and YouTube Shorts.' },
  { q: 'How do I create an AI reel?',              a: 'Simply enter your topic, choose your niche and platform, and ReelForge AI generates a complete script, professional voiceover, and video with matching stock clips — all in under 2 minutes.' },
  { q: 'Is ReelForge free to use?',               a: 'Yes! ReelForge offers 10 free credits on signup with no credit card required. Each reel costs 5 credits. Upgrade to Pro for 500 credits per month.' },
  { q: 'What platforms does ReelForge support?',  a: 'ReelForge creates vertical 9:16 videos optimized for Instagram Reels, TikTok, and YouTube Shorts. All videos export in 1080×1920 HD resolution.' },
  { q: 'Can I add captions to my reels?',         a: 'Yes! ReelForge includes a free caption burner with 6 styles including TikTok-style, karaoke, bold white, and yellow captions.' },
  { q: 'Does ReelForge support multiple languages?', a: 'ReelForge generates scripts in English and supports voiceovers in 6 different voice styles. Multi-language support is coming soon.' },
  { q: 'What is the HeyGen avatar feature?',      a: 'The HeyGen integration lets you create talking avatar videos where an AI presenter reads your script with realistic lip-sync — perfect for faceless content creators.' },
  { q: 'How many reels can I create per month?',  a: 'It depends on your plan. Free users get 10 Pro credits. Pro users get 500 credits per month (100 reels). Agency users get 2,000 credits per month.' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ReelForge',
  applicationCategory: 'MultimediaApplication',
  description: 'AI-powered video reel creator for Instagram, TikTok and YouTube',
  offers: { '@type': 'AggregateOffer', lowPrice: '0', highPrice: '60', priceCurrency: 'USD' },
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '1247' },
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

const HOW_IT_WORKS = [
  { step: '01', title: 'Describe your idea',          desc: 'Type a topic, plot, or product. Our AI understands context and intent.' },
  { step: '02', title: 'AI generates script + visuals', desc: 'Groq writes the script, voiceover is synthesised, scenes are visualised.' },
  { step: '03', title: 'Download your video',           desc: 'Export in 1080p or 4K, publish directly or save to your project library.' },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  return (
    <div className="min-h-screen text-white" style={{ background: '#050505' }}>
      <style>{`
        @keyframes gradient-shift {
          0%   { background-position: 0% 50%   }
          50%  { background-position: 100% 50% }
          100% { background-position: 0% 50%   }
        }
        .hero-bg {
          background: linear-gradient(-45deg, #000000, #1a0533, #000000, #0d1a33);
          background-size: 400% 400%;
          animation: gradient-shift 8s ease infinite;
        }
        .glow-card:hover { box-shadow: 0 0 40px rgba(124,58,237,0.15); }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', backgroundColor: 'rgba(5,5,5,0.85)' }}
        className="sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-white">ReelForge</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <a href="#features"     className="hover:text-white transition-colors">Features</a>
            <a href="#pricing"      className="hover:text-white transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>
            <a href="#affiliate"    className="hover:text-white transition-colors">Affiliate</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"    className="hidden md:block text-sm px-4 py-2 transition-colors" style={{ color: 'rgba(255,255,255,0.5)' }}>Sign In</Link>
            <Link href="/register" className="hidden md:block text-sm text-white px-5 py-2 rounded-lg font-semibold transition-all"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              Start Free
            </Link>
            <button className="md:hidden text-gray-400 hover:text-white transition-colors p-1"
              onClick={() => setMobileMenuOpen(p => !p)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden px-6 py-4 space-y-3 border-t" style={{ background: 'rgba(5,5,5,0.97)', borderColor: 'rgba(255,255,255,0.07)' }}>
            {[['#features','Features'],['#pricing','Pricing'],['#testimonials','Reviews'],['#faq','FAQ'],['#affiliate','Affiliate']].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}
                className="block text-sm py-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {label}
              </a>
            ))}
            <div className="flex gap-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2.5 text-sm rounded-lg" style={{ color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)' }}>
                Sign In
              </Link>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                Get Started
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="hero-bg min-h-screen flex flex-col items-center justify-center px-6 py-24 text-center relative overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)' }} />

        <div className="relative max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-full mb-8"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)', color: '#c4b5fd' }}>
            🎬 AI Movie Studio — Now Live
          </div>

          <h1 className="font-extrabold tracking-tight mb-6 leading-tight" style={{ fontSize: 'clamp(2.5rem,8vw,5rem)' }}>
            Create Viral AI Reels
            <br />
            <span style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              in 60 Seconds
            </span>
          </h1>

          <p className="text-xl mb-4" style={{ color: 'rgba(255,255,255,0.55)', maxWidth: 600, margin: '0 auto 2rem' }}>
            Turn any idea into a scroll-stopping Instagram Reel, TikTok, or YouTube Short with AI.
            Script → Voiceover → Video. No editing skills needed.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-5">
            <Link href="/register"
              className="inline-flex items-center justify-center gap-2 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', boxShadow: '0 0 40px rgba(124,58,237,0.4)' }}>
              Start Creating Free <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#features"
              className="inline-flex items-center justify-center gap-2 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:opacity-80"
              style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)' }}>
              <Play className="w-5 h-5" /> Watch Demo ▶
            </a>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No credit card · 10 free credits</p>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Stats strip ── */}
      <section className="py-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {STATS.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <Icon className="w-5 h-5" style={{ color: '#7c3aed' }} />
              <span className="text-2xl font-extrabold text-white">{value}</span>
              <span className="text-xs uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Niche marquee ── */}
      <div className="py-5 overflow-hidden border-y" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)' }}>
        <div className="animate-marquee gap-3">
          {[
            '🤖 Tech & AI', '💪 Fitness', '💼 Business', '💰 Finance',
            '🔥 Motivation', '✈️ Travel', '🍕 Food', '🎮 Gaming',
            '🎭 Entertainment', '💄 Lifestyle', '📚 Education', '🎵 Music',
            '🤖 Tech & AI', '💪 Fitness', '💼 Business', '💰 Finance',
            '🔥 Motivation', '✈️ Travel', '🍕 Food', '🎮 Gaming',
          ].map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-gray-400 text-xs font-medium px-3 py-1.5 rounded-full shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── Video Showcase ── */}
      <section className="py-16 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-4"
                 style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)', color: '#c4b5fd' }}>
              <Play className="w-3 h-3 fill-purple-400" /> Made with ReelForge
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3">
              Viral Reels Created in Minutes
            </h2>
            <p className="max-w-xl mx-auto text-base" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Real videos made by creators using ReelForge. Your next viral reel is one click away.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {SHOWCASE_VIDEOS.map(v => <ShowcaseVideoCard key={v.id} video={v} />)}
          </div>
          <div className="text-center mt-10">
            <Link href="/register"
              className="inline-flex items-center gap-2 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', boxShadow: '0 0 40px rgba(124,58,237,0.35)' }}>
              Create Your First Reel Free <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-sm mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              No credit card · 10 free credits · Ready in 2 minutes
            </p>
          </div>
        </div>
      </section>

      {/* ── Comparison ── */}
      <section className="py-16 px-6" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-10">
            Stop Spending Hours on Content
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl" style={{ background: '#0f0f0f', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-red-400"
                     style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }}>✕</div>
                <h3 className="font-semibold text-red-400">Without ReelForge</h3>
              </div>
              <ul className="space-y-3">
                {COMPARISON_WITHOUT.map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    <span className="text-red-500 shrink-0 text-xs">✕</span>{item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 rounded-2xl" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)' }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                     style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.5)', color: '#c4b5fd' }}>✓</div>
                <h3 className="font-semibold" style={{ color: '#c4b5fd' }}>With ReelForge</h3>
              </div>
              <ul className="space-y-3">
                {COMPARISON_WITH.map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <span className="shrink-0 text-xs" style={{ color: '#7c3aed' }}>✓</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">Everything You Need to Go Viral</h2>
            <p className="text-lg" style={{ color: 'rgba(255,255,255,0.45)' }}>A complete AI studio for Instagram Reels, TikTok videos, and YouTube Shorts creators.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="glow-card p-6 rounded-2xl transition-all duration-300 cursor-default"
                style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-3xl mb-4">{f.emoji}</div>
                <h3 className="font-semibold text-lg text-white mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-white">AI Reel Creator — How It Works</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)' }}>Create professional video reels in 3 simple steps.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.step} className="text-center relative">
                <div className="text-6xl font-extrabold mb-4" style={{ color: 'rgba(124,58,237,0.25)' }}>{s.step}</div>
                <h3 className="font-bold text-lg text-white mb-2">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.desc}</p>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-8 right-0 translate-x-1/2 text-2xl" style={{ color: 'rgba(124,58,237,0.4)' }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-white">Loved by creators</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)' }}>Real results from real creators.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="p-6 rounded-2xl flex flex-col gap-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center gap-1">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed flex-1" style={{ color: 'rgba(255,255,255,0.65)' }}>&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who Uses ReelForge ── */}
      <section className="py-20 px-6" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3 text-white">Trusted by 10,000+ Content Creators</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)' }}>From solo creators to agencies — ReelForge powers every type of content</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {CREATOR_TYPES.map(c => (
              <div key={c.label} className="flex items-center gap-3 p-4 rounded-xl"
                   style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="text-2xl">{c.emoji}</span>
                <div>
                  <p className="font-semibold text-sm text-white">{c.label}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-white">Simple, transparent pricing</h2>
            <p className="mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>Start free. Scale as you grow.</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Indian users pay in ₹ via Razorpay · International users pay in $ via Stripe</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {PLANS.map(plan => (
              <div key={plan.name} className="p-7 rounded-2xl relative flex flex-col transition-all duration-300"
                style={{
                  background: '#0f0f0f',
                  border: plan.highlight ? '1px solid rgba(124,58,237,0.6)' : '1px solid rgba(255,255,255,0.07)',
                  boxShadow: plan.highlight ? '0 0 40px rgba(124,58,237,0.2)' : 'none',
                }}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                    Most Popular
                  </div>
                )}
                <div className="mb-5">
                  <p className="text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{plan.name}</p>
                  {plan.priceINR ? (
                    <div>
                      <span className="text-3xl font-extrabold text-white">{plan.priceINR}</span>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{plan.priceUSD} USD</p>
                    </div>
                  ) : (
                    <span className="text-3xl font-extrabold text-white">Free</span>
                  )}
                  <p className="text-xs mt-1 font-medium" style={{ color: '#a78bfa' }}>{plan.credits.toLocaleString()} credits</p>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.features.map(feat => (
                    <li key={feat} className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      <Check className="w-3.5 h-3.5 shrink-0" style={{ color: '#7c3aed' }} />{feat}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}
                  className="w-full text-center py-2.5 rounded-xl font-semibold text-sm transition-all text-white"
                  style={plan.highlight
                    ? { background: 'linear-gradient(135deg,#7c3aed,#db2777)' }
                    : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }
                  }>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold mb-4 text-white">Frequently Asked Questions</h2>
            <p style={{ color: 'rgba(255,255,255,0.45)' }}>Everything you need to know about ReelForge.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details key={i} className="group rounded-2xl overflow-hidden"
                       style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.07)' }}>
                <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer font-semibold text-white select-none"
                         style={{ listStyle: 'none' }}>
                  <h3 className="text-sm md:text-base">{faq.q}</h3>
                  <span className="text-gray-500 shrink-0 group-open:rotate-45 transition-transform duration-200 text-xl leading-none">+</span>
                </summary>
                <p className="px-6 pb-5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Affiliate CTA ── */}
      <section id="affiliate" className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-12 rounded-3xl relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(219,39,119,0.1))', border: '1px solid rgba(124,58,237,0.3)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%,rgba(124,58,237,0.08),transparent 70%)' }} />
            <div className="relative">
              <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-5"
                style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', color: '#c4b5fd' }}>
                <Star className="w-3 h-3 fill-purple-400 text-purple-400" /> Affiliate Program
              </div>
              <h2 className="text-4xl font-bold mb-4 text-white">Earn 30% commission</h2>
              <p className="text-lg mb-8 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Share your unique referral link. Earn 30% on every payment made by creators you refer — credited to your balance instantly.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/register"
                  className="inline-flex items-center justify-center gap-2 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                  Join as Affiliate <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/dashboard/affiliate"
                  className="inline-flex items-center justify-center gap-2 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  View Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-6 text-center" style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(219,39,119,0.08))' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-white">Ready to create your first AI film?</h2>
          <Link href="/register"
            className="inline-flex items-center justify-center gap-2 text-white text-lg font-semibold px-10 py-4 rounded-xl transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', boxShadow: '0 0 50px rgba(124,58,237,0.35)' }}>
            Start for Free <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No credit card · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              <Video className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-white">ReelForge</span>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>&copy; {new Date().getFullYear()} ReelForge. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-5 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
  <Link href="/terms" className="hover:text-white transition-colors">
    Terms
  </Link>

  <Link href="/privacy" className="hover:text-white transition-colors">
    Privacy
  </Link>

  <Link href="/refund" className="hover:text-white transition-colors">
    Refund
  </Link>

  <Link href="/cancellation" className="hover:text-white transition-colors">
    Cancellation
  </Link>

  <Link href="/disclaimer" className="hover:text-white transition-colors">
    Disclaimer
  </Link>

  <a
    href="mailto:support@fabricaipro.com"
    className="hover:text-white transition-colors"
  >
    Contact
  </a>
</div>
</div>
      </footer>
<section className="max-w-5xl mx-auto px-6 py-12">
  <h3 className="text-xl font-bold mb-4 text-white">
    JVZoo Required Disclaimer
  </h3>

  <p className="text-sm text-gray-300 leading-7">
    Disclaimer: Please note that this product does not provide any guarantee of income or success.
    The results achieved by the product owner or any other individuals mentioned are not indicative
    of future success or earnings. This website is not affiliated with FaceBook or any of its
    associated entities. Once you navigate away from FaceBook, the responsibility for the content
    and its usage lies solely with the user.
  </p>

  <p className="text-sm text-gray-300 leading-7 mt-4">
    We want to clarify that JVZoo serves as the retailer for the products featured on this site.
    JVZoo® is a registered trademark of BBC Systems Inc. The role of JVZoo as a retailer does not
    constitute an endorsement, approval, or review of these products or any claims, statements,
    or opinions used in their promotion.
  </p>
</section>
      {/* Floating Zap */}
      <div className="fixed bottom-6 right-6 z-40">
        <Link href="/register"
          className="flex items-center gap-2 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', boxShadow: '0 0 30px rgba(124,58,237,0.5)' }}>
          <Zap className="w-4 h-4" /> Start Free
        </Link>
      </div>
    </div>
  )
}
