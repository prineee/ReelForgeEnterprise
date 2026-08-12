'use client'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Video, LayoutDashboard, Mic, Image, BookOpen,
  Users, CreditCard, ChevronRight,
  Film, Tv, User, Library, BookMarked,
  Zap, Share2, Layers, Palette, Globe,
  Settings, Boxes,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    section: 'CREATE',
    items: [
      { label: 'Dashboard',        href: '/dashboard',         icon: LayoutDashboard },
      { label: 'Create Reel',      href: '/create-reel',       icon: Video           },
      { label: 'Movie Studio',     href: '/movie-studio',      icon: Film            },
      { label: 'Movie Library',    href: '/movie-library',     icon: Library         },
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
      { label: 'Asset Manager',    href: '/asset-manager',     icon: Boxes           },
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
      { label: 'Settings', href: '/settings', icon: Settings   },
    ],
  },
]

interface Props {
  children: React.ReactNode
  /** null means the balance couldn't be confirmed (fetch error) — must render distinctly from an actual 0. */
  credits: number | null
}

export function DashboardShell({ children, credits }: Props) {
  const pathname = usePathname()

  function NavLinks() {
    return (
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_ITEMS.map(group => (
          <div key={group.section}>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1">
              {group.section}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link key={item.href} href={item.href}
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
        <span className="ml-auto text-white font-semibold">{credits === null ? '—' : credits}</span>
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

  const LogoBar = () => (
    <div className="flex items-center gap-2.5 px-4 py-4 border-b border-surface-border shrink-0">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shrink-0">
        <Video className="w-4 h-4 text-white" />
      </div>
      <span className="font-bold text-lg text-white">ReelForge</span>
    </div>
  )

  return (
    <div className="flex h-screen bg-surface overflow-hidden">

      {/* ── Sidebar (always visible) ── */}
      <aside className="flex w-56 xl:w-64 border-r border-surface-border bg-surface-card shrink-0 flex-col">
        <LogoBar />
        <NavLinks />
        <SidebarFooter />
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
