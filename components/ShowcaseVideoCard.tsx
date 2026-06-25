'use client'

import { useState, useRef } from 'react'
import { Play, Eye } from 'lucide-react'

interface ShowcaseVideo {
  id: number
  url: string
  poster: string
  label: string
  niche: string
  views: string
}

export default function ShowcaseVideoCard({ video }: { video: ShowcaseVideo }) {
  const [playing, setPlaying]   = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  function handleClick() {
    if (!videoRef.current) return
    if (playing) {
      videoRef.current.pause()
      setPlaying(false)
    } else {
      videoRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer group border border-white/10 hover:border-brand-500/50 transition-all duration-300 hover:scale-[1.02]"
      style={{ aspectRatio: '9/16' }}
      onClick={handleClick}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={video.url}
        poster={video.poster}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        muted
        playsInline
        preload="poster"
        onEnded={() => setPlaying(false)}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

      {/* Play / pause indicator */}
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
          {playing ? (
            <div className="flex gap-0.5">
              <div className="w-1 h-4 bg-white rounded-full" />
              <div className="w-1 h-4 bg-white rounded-full" />
            </div>
          ) : (
            <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
          )}
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-white text-xs font-semibold truncate">{video.label}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-brand-300 text-[10px] font-medium">{video.niche}</span>
          <div className="flex items-center gap-0.5 text-gray-400">
            <Eye className="w-2.5 h-2.5" />
            <span className="text-[10px]">{video.views}</span>
          </div>
        </div>
      </div>

      {/* RF badge */}
      <div className="absolute top-2 right-2">
        <div className="bg-brand-600/80 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
          RF
        </div>
      </div>

      {/* Hover-to-play overlay (desktop) */}
      <div
        className="absolute inset-0"
        onMouseEnter={() => {
          if (videoRef.current && !playing) {
            videoRef.current.play().catch(() => {})
            setPlaying(true)
          }
        }}
        onMouseLeave={() => {
          if (videoRef.current) {
            videoRef.current.pause()
            videoRef.current.currentTime = 0
            setPlaying(false)
          }
        }}
      />
    </div>
  )
}
