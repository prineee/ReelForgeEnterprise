'use client'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Video, LayoutDashboard, Mic, Image, BookOpen,
  Users, CreditCard, Menu, X, ChevronRight,
  Film, Tv, User, Library, BookMarked,
  Zap, Share2, Layers, Palette, Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    section: 'CREATE',
    items: [
      { label: 'Dashboard',        href: '/dashboard',         icon: LayoutDashboard },
      { label: 'Create Reel',      href: '/create-reel',       icon: Video           },
      { label: 'Movie Studio',     href: '/movie-studio',      icon: Film            },
      {
  label: 'Cartoon Studio',
  href: '/cartoon-studio',
  icon: Palette,
},
      { label: 'Series Studio',    href: '/series-studio',     icon: Tv              },
      { label: 'Characters',       href: '/characters',        icon: User            },
      { label: 'Avatar Studio',    href: '/avatar-studio',     icon: Users           },
      { label: 'Media Library',    href: '/media-library',     icon: Library         },
      { label: 'My Series',        href: '/my-series',         icon: BookMarked      },
      { label: 'Cinema Studio',    href: '/cinema-studio',     icon: Palette         },
      { label: 'Marketing Studio', href: '/marketing-studio',  icon: Globe           },
      { label: 'Canvas',           href: '/canvas',            icon: Layers          },
    ],
  },
  {
    section: 'TOOLS',
    items: [
      { label: 'Publisher', href: '/publisher', icon: Share2   },
      { label: 'Thumbnail', href: '/thumbnail', icon: Image    },
      { label: 'Captions',  href: '/captions',  icon: Mic      },
      { label: 'Script',    href: '/script',    icon: BookOpen },
    ],
  },
  {
    section: 'ACCOUNT',
    items: [
      { label: 'Projects', href: '/projects', icon: Film       },
      { label: 'Billing',  href: '/billing',  icon: CreditCard },
    ],
  },
]

const BOTTOM_NAV = [
  { href: '/dashboard',   icon: LayoutDashboard, label: 'Home'    },
  { href: '/create-reel', icon: Video,            label: 'Create'  },
  { href: '/publisher',   icon: Share2,           label: 'Publish' },
  { href: '/projects',    icon: Film,             label: 'Projects'},
  { href: '/billing',     icon: CreditCard,       label: 'Account' },
]

interface Props {
  children: React.ReactNode
  credits: number
}

export function DashboardShell({ children, credits }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  function NavLinks({ onClickItem }: { onClickItem?: () => void }) {
    return (
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_ITEMS.map(group => (
          <div key={group.section}>
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-2 mb-1">
              {group.section}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link key={item.href} href={item.href}
                    onClick={onClickItem}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                      active
                        ? 'bg-brand-600/20 text-white font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-surface-card'
                    )}>
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {active && <ChevronRight className="w-3 h-3 ml-auto shrink-0 text-brand-400" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    )
  }

  const SidebarFooter = () => {
  const supabase = createClient()

  return (
    <div className="px-4 py-3 border-t border-surface-border shrink-0 space-y-3">

      <Link
        href="/billing"
        className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
      >
        <Zap className="w-3.5 h-3.5 text-yellow-400" />
        <span>Credits</span>
        <span className="ml-auto text-white font-semibold">{credits}</span>
      </Link>

      <button
        onClick={async () => {
          const confirmed = window.confirm(
            'Are you sure you want to logout?'
          )

          if (!confirmed) return

          await supabase.auth.signOut()

          window.location.href = '/login'
        }}
        className="flex items-center gap-2 w-full text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Logout</span>
      </button>

    </div>
  )
}

  const LogoBar = ({ withClose }: { withClose?: boolean }) => (
    <div className="flex items-center gap-2.5 px-4 py-4 border-b border-surface-border shrink-0">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shrink-0">
        <Video className="w-4 h-4 text-white" />
      </div>
      <span className="font-bold text-lg text-white">ReelForge</span>
      {withClose && (
        <button onClick={() => setSidebarOpen(false)} className="ml-auto text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )

  return (
    <div className="flex h-screen bg-surface overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-56 xl:w-64 border-r border-surface-border bg-surface-card shrink-0 flex-col">
        <LogoBar />
        <NavLinks />
        <SidebarFooter />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-surface-card border-r border-surface-border flex flex-col h-full z-10">
            <LogoBar withClose />
            <NavLinks onClickItem={() => setSidebarOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-surface-border bg-surface-card shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
              <Video className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-white text-sm">ReelForge</span>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span className="text-white font-semibold">{credits}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface-card border-t border-surface-border z-40 px-2 py-1">
        <div className="flex items-center justify-around">
          {BOTTOM_NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-0',
                  active ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300'
                )}>
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-medium truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
