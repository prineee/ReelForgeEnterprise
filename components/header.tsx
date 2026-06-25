'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, ChevronDown, LogOut, Settings, User,
  Video, Clock, CheckCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface HeaderProps {
  userEmail?: string
  userName?: string
}

interface NotificationItem {
  id: string
  title: string
  type: string
  status: string
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TYPE_DOT: Record<string, string> = {
  reel:  'bg-purple-500',
  short: 'bg-blue-500',
  story: 'bg-pink-500',
  ad:    'bg-orange-500',
}

const STORAGE_KEY = 'reelforge_notif_seen'

// ── Component ─────────────────────────────────────────────────────────────────

export function Header({ userEmail, userName }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const [menuOpen, setMenuOpen]   = useState(false)
  const [bellOpen, setBellOpen]   = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [notifLoading, setNotifLoading]   = useState(true)

  // Fetch the user's last 5 projects on mount to use as notifications
  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) { setNotifLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('projects') as any)
        .select('id, title, type, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5) as { data: NotificationItem[] | null }

      if (cancelled) return
      const items = data ?? []
      setNotifications(items)

      // Compute unread: projects created after the last time user opened the bell
      try {
        const lastSeen = localStorage.getItem(STORAGE_KEY)
        if (lastSeen) {
          const lastSeenMs = new Date(lastSeen).getTime()
          const unread = items.filter(
            (p) => new Date(p.created_at).getTime() > lastSeenMs
          ).length
          setUnreadCount(unread)
        } else {
          // First visit — all are "unread"
          setUnreadCount(items.length)
        }
      } catch {
        // localStorage unavailable (SSR, incognito block) — skip badge
      }

      setNotifLoading(false)
    }

    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleBellClick() {
    const next = !bellOpen
    setBellOpen(next)
    if (menuOpen) setMenuOpen(false)

    // Mark all as read when opening
    if (next && unreadCount > 0) {
      setUnreadCount(0)
      try {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString())
      } catch { /* ignore */ }
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : userEmail?.charAt(0).toUpperCase() ?? 'U'

  return (
    <header className="h-16 bg-surface-card border-b border-surface-border flex items-center justify-between px-6 sticky top-0 z-20">
      <div />

      <div className="flex items-center gap-3">

        {/* ── Notification bell ── */}
        <div className="relative">
          <button
            onClick={handleBellClick}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-surface-hover transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {/* Unread badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            {/* Pulse dot when 0 unread but has items */}
            {unreadCount === 0 && notifications.length > 0 && !notifLoading && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-gray-600 rounded-full" />
            )}
          </button>

          {/* ── Dropdown ── */}
          {bellOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setBellOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-surface-card border border-surface-border rounded-xl shadow-2xl z-20 overflow-hidden">
                {/* Header row */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
                  <div className="flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm font-semibold text-white">Recent Activity</span>
                  </div>
                  {notifications.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <CheckCheck className="w-3.5 h-3.5 text-brand-400" />
                      All read
                    </div>
                  )}
                </div>

                {/* Notification items */}
                {notifLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center py-10 px-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-surface border border-surface-border flex items-center justify-center mb-3">
                      <Clock className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">No activity yet</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Your created projects will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-surface-border">
                    {notifications.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setBellOpen(false)
                          router.push('/projects')
                        }}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
                      >
                        {/* Type colour dot */}
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-surface-border shrink-0 mt-0.5">
                          <Video className={`w-3.5 h-3.5 ${
                            item.type === 'reel'  ? 'text-purple-400' :
                            item.type === 'short' ? 'text-blue-400'   :
                            item.type === 'story' ? 'text-pink-400'   :
                            'text-orange-400'
                          }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white leading-snug truncate">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {/* Type dot */}
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[item.type] ?? 'bg-gray-500'}`} />
                            <span className="text-xs text-gray-500 capitalize">{item.type}</span>
                            <span className="text-gray-700">·</span>
                            <span className="text-xs text-gray-500">{timeAgo(item.created_at)}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Footer link */}
                {notifications.length > 0 && (
                  <div className="border-t border-surface-border px-4 py-2.5">
                    <button
                      onClick={() => { setBellOpen(false); router.push('/projects') }}
                      className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      View all projects →
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── User menu ── */}
        <div className="relative">
          <button
            onClick={() => { setMenuOpen(!menuOpen); if (bellOpen) setBellOpen(false) }}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-white leading-tight">
                {userName ?? 'User'}
              </p>
              <p className="text-xs text-gray-500 leading-tight truncate max-w-[140px]">
                {userEmail}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-52 bg-surface-card border border-surface-border rounded-xl shadow-xl z-20 overflow-hidden py-1">
                <div className="px-4 py-3 border-b border-surface-border">
                  <p className="text-sm font-medium text-white">{userName ?? 'User'}</p>
                  <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); router.push('/settings') }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={() => { setMenuOpen(false); router.push('/settings') }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>
                <div className="border-t border-surface-border my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
