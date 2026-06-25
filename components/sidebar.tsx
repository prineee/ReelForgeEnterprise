'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Video,
  Image,
  MessageSquare,
  FileText,
  FolderOpen,
  CreditCard,
  Users,
  Settings,
  ChevronRight,
  Zap,
  User,
  Film,
  Layers,
  Clapperboard,
  Palette,
  Tv,
  Share2,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    label: 'Create',
    items: [
      { href: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
      { href: '/create-reel',    label: 'Create Reel',    icon: Video },
      { href: '/movie-studio',   label: 'Movie Studio',   icon: Clapperboard },
      { href: '/series-studio',  label: 'Series Studio',  icon: Tv },
      { href: '/characters',     label: 'Characters',     icon: User },
      { href: '/cartoon-studio', label: 'Cartoon Studio', icon: Palette },
      { href: '/avatar-studio',  label: 'Avatar Studio',  icon: Film },
      { href: '/media-library',  label: 'Media Library',  icon: Layers },
      { href: '/my-series',      label: 'My Series',      icon: FolderOpen },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/publisher',  label: 'Publisher',  icon: Share2 },
      { href: '/thumbnail',  label: 'Thumbnail',  icon: Image },
      { href: '/captions',   label: 'Captions',   icon: MessageSquare },
      { href: '/script',     label: 'Script',     icon: FileText },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/projects',   label: 'Projects',   icon: FolderOpen },
      { href: '/billing',    label: 'Billing',    icon: CreditCard },
      { href: '/affiliate',  label: 'Affiliate',  icon: Users },
      { href: '/settings',   label: 'Settings',   icon: Settings },
    ],
  },
]

interface SidebarProps {
  credits?: number
  plan?: string
  isAdmin?: boolean
}

export function Sidebar({ credits = 0, plan = 'free', isAdmin = false }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-64 h-screen bg-surface-card border-r border-surface-border fixed top-0 left-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-surface-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
          <Video className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-lg">ReelForge</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                      active
                        ? 'bg-brand-600/15 text-brand-300 border border-brand-700/30'
                        : 'text-gray-400 hover:text-white hover:bg-surface-hover'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-brand-400' : 'text-current')} />
                    <span className="flex-1">{label}</span>
                    {active && <ChevronRight className="w-3 h-3 text-brand-500" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
        {/* Admin link — only visible to admin users */}
        {isAdmin && (
          <div>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Admin</p>
            <div className="space-y-0.5">
              {(() => {
                const active = pathname === '/admin' || pathname.startsWith('/admin/')
                return (
                  <Link href="/admin" className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    active ? 'bg-brand-600/15 text-brand-300 border border-brand-700/30' : 'text-gray-400 hover:text-white hover:bg-surface-hover'
                  )}>
                    <Shield className={cn('w-4 h-4 shrink-0', active ? 'text-brand-400' : 'text-current')} />
                    <span className="flex-1">Admin Panel</span>
                    {active && <ChevronRight className="w-3 h-3 text-brand-500" />}
                  </Link>
                )
              })()}
            </div>
          </div>
        )}
      </nav>

      {/* Credits & Plan */}
      <div className="px-3 pb-4 space-y-3 shrink-0">
        {/* Credits bar */}
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              Credits
            </div>
            <span className="text-xs font-semibold text-white">{credits}</span>
          </div>
          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${Math.min((credits / 200) * 100, 100)}%` }}
            />
          </div>
          <Link
            href="/billing"
            className="mt-2 block text-center text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium"
          >
            Upgrade plan
          </Link>
        </div>

        {/* Plan badge */}
        <div className="flex items-center gap-2 px-2">
          <span className="inline-flex items-center px-2 py-0.5 bg-brand-950 border border-brand-800 text-brand-300 text-xs rounded-md font-medium capitalize">
            {plan}
          </span>
          <span className="text-xs text-gray-500 truncate">plan</span>
        </div>
      </div>
    </aside>
  )
}
