'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    q: 'How many credits do I need to create a full reel?',
    a: 'A full AI reel costs 5 credits. Individual tools cost less: thumbnails and captions are 1 credit each, voiceovers are 2 credits.',
  },
  {
    q: 'Can I use the content commercially?',
    a: 'Yes. All content generated through AI ReelForge comes with a full commercial license. Use it for ads, social media, client work — anything.',
  },
  {
    q: 'What languages are supported for captions?',
    a: 'AI ReelForge supports over 50 languages for caption generation, including English, Spanish, French, Hindi, Arabic, Portuguese, and more.',
  },
  {
    q: 'How does the affiliate program work?',
    a: 'Share your unique referral link. When someone signs up and pays, you earn 30% commission on that payment — credited directly to your affiliate balance.',
  },
  {
    q: 'Can I cancel my plan at any time?',
    a: 'Yes. Plans are one-time credit purchases with no recurring subscriptions. Top up whenever you need more credits.',
  },
  {
    q: 'What video resolution does AI ReelForge export at?',
    a: 'Free users get 720p exports. Starter, Pro, and Agency plans include 1080p and 4K exports.',
  },
  {
    q: 'Do credits expire?',
    a: 'No. Credits never expire. Use them at your own pace — they stay in your account indefinitely.',
  },
  {
    q: 'Is there an API for developers?',
    a: 'API access is available on the Agency plan. Contact us for custom integrations and enterprise-grade usage limits.',
  },
]

export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      {FAQS.map((faq, i) => (
        <div key={i} className="card overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
          >
            <span className="font-medium text-sm pr-4">{faq.q}</span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`}
            />
          </button>
          <div className={`overflow-hidden transition-all duration-200 ${open === i ? 'max-h-40' : 'max-h-0'}`}>
            <p className="px-6 pb-4 text-sm text-gray-400 leading-relaxed">{faq.a}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
