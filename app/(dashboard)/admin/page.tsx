'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, DollarSign, Zap, Film, Search, ChevronLeft, ChevronRight,
  X, Loader2, AlertCircle, Shield, Download, Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string
  email: string
  credits: number
  plan: string
  is_admin: boolean
  created_at: string
  total_credits_used: number | null
  last_active: string | null
}

interface AdminStats {
  totalUsers: number
  totalMovies: number
  publishJobs: number
  estimatedMRR: number
  paidUsers: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLANS = ['free', 'starter', 'pro', 'agency'] as const
const PLAN_REVENUE: Record<string, number> = { starter: 6, pro: 18, agency: 60 }
const PLAN_COLORS: Record<string, string> = {
  free:    'bg-surface border-surface-border text-gray-400',
  starter: 'bg-blue-950 border-blue-800 text-blue-300',
  pro:     'bg-purple-950 border-purple-800 text-purple-300',
  agency:  'bg-orange-950 border-orange-800 text-orange-300',
}
const PAGE_SIZE = 20

// ── Edit Credits Modal ────────────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSave }: {
  user: AdminUser
  onClose: () => void
  onSave: (id: string, credits: number, plan: string, note: string) => Promise<void>
}) {
  const [credits, setCredits] = useState(String(user.credits))
  const [plan, setPlan]       = useState(user.plan)
  const [note, setNote]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function handleSave() {
    setSaving(true); setError('')
    try {
      await onSave(user.id, Number(credits), plan, note)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-surface-card border border-surface-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h3 className="font-bold text-sm">Edit User</h3>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-3 truncate">{user.email}</p>
          </div>
          <div>
            <label className="label">Credits</label>
            <input className="input" type="number" value={credits} onChange={e => setCredits(e.target.value)} />
          </div>
          <div>
            <label className="label">Plan</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PLANS.map(p => (
                <button key={p} onClick={() => setPlan(p)} className={cn(
                  'py-1.5 rounded-md text-xs font-medium border transition-colors capitalize',
                  plan === p ? 'bg-brand-600 border-brand-500 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700 hover:text-white'
                )}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Note <span className="text-gray-600">(optional)</span></label>
            <input className="input text-sm" placeholder="Reason for change" value={note} onChange={e => setNote(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-400">{String(error)}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={onClose} className="flex-1" size="sm">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1" size="sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [stats, setStats]       = useState<AdminStats | null>(null)
  const [users, setUsers]       = useState<AdminUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [search, setSearch]     = useState('')
  const [sortBy, setSortBy]     = useState<'created_at' | 'credits' | 'plan'>('created_at')
  const [page, setPage]         = useState(0)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/stats')
      console.log('[admin page] status:', res.status)
      const json = await res.json()
      console.log('[admin page] data:', JSON.stringify(json).slice(0, 300))
      if (res.status === 403) { setForbidden(true); return }
      setStats(json.stats)
      setUsers(json.users ?? [])
    } catch (err) { console.error('[admin page] fetch error:', err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSaveUser(id: string, credits: number, plan: string, note: string) {
    const res  = await fetch(`/api/admin/users/${id}/credits`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credits, plan, note }),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, credits, plan } : u))
  }

  function exportCSV() {
    const header = 'email,plan,credits,total_credits_used,joined,last_active\n'
    const rows   = users.map(u =>
      `${u.email},${u.plan},${u.credits},${u.total_credits_used ?? 0},${u.created_at},${u.last_active ?? ''}`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'reelforge-users.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // Filter + sort
  const filtered = users
    .filter(u => !search || u.email?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'credits') return b.credits - a.credits
      if (sortBy === 'plan') return a.plan.localeCompare(b.plan)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Revenue breakdown
  const planCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.plan] = (acc[u.plan] ?? 0) + 1; return acc
  }, {})

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
    </div>
  )

  if (forbidden) return (
    <div className="max-w-md mx-auto py-20 text-center space-y-4">
      <Shield className="w-12 h-12 text-red-400 mx-auto" />
      <h1 className="text-xl font-bold">Access Denied</h1>
      <p className="text-gray-400 text-sm">You don&apos;t have admin access. Ask a super admin to grant you admin privileges.</p>
      <Button variant="secondary" onClick={() => window.history.back()}>Go Back</Button>
    </div>
  )

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-400" /> Admin Panel
          </h1>
          <p className="text-gray-400 text-sm">User management and revenue overview</p>
        </div>
        <Button variant="secondary" onClick={exportCSV} size="sm">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Users',  value: stats.totalUsers,                       icon: Users,       bg: 'bg-brand-950 border-brand-800',   color: 'text-brand-400' },
            { label: 'Paid Users',   value: stats.paidUsers,                        icon: Users,       bg: 'bg-purple-950 border-purple-800', color: 'text-purple-400' },
            { label: 'Est. MRR',     value: `$${stats.estimatedMRR}`,               icon: DollarSign,  bg: 'bg-green-950 border-green-800',   color: 'text-green-400' },
            { label: 'Movies Made',  value: stats.totalMovies,                      icon: Film,        bg: 'bg-orange-950 border-orange-800', color: 'text-orange-400' },
            { label: 'Publish Jobs', value: stats.publishJobs,                      icon: Zap,         bg: 'bg-yellow-950 border-yellow-800', color: 'text-yellow-400' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${s.bg}`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Revenue breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-400" /> Revenue Breakdown (MRR Estimate)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {PLANS.map(p => {
              const count = planCounts[p] ?? 0
              const rev   = count * (PLAN_REVENUE[p] ?? 0)
              return (
                <div key={p} className="text-center p-3 bg-surface rounded-xl border border-surface-border">
                  <span className={cn('inline-flex px-2 py-0.5 rounded-md border text-xs font-medium capitalize mb-2', PLAN_COLORS[p])}>{p}</span>
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-xs text-gray-500">{rev > 0 ? `$${rev}/mo` : 'Free'}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* User table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm">Users ({filtered.length})</CardTitle>
            <div className="flex items-center gap-2">
              {/* Sort */}
              <select className="input text-xs py-1.5 w-36" value={sortBy} onChange={e => { setSortBy(e.target.value as typeof sortBy); setPage(0) }}>
                <option value="created_at">Sort: Newest</option>
                <option value="credits">Sort: Credits</option>
                <option value="plan">Sort: Plan</option>
              </select>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  className="input pl-8 text-sm py-1.5 w-52"
                  placeholder="Search email…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0) }}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left">
                {[
                  ['Email', ''],
                  ['Plan', ''],
                  ['Credits', ''],
                  ['Cr. Used', 'hidden sm:table-cell'],
                  ['Joined', 'hidden sm:table-cell'],
                  ['Admin', 'hidden md:table-cell'],
                  ['Actions', ''],
                ].map(([h, cls]) => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-medium text-gray-500 ${cls}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {paginated.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">No users found</td></tr>
              )}
              {paginated.map(u => (
                <tr key={u.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3 text-xs max-w-[180px] truncate" title={u.email}>{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-md border text-xs font-medium capitalize', PLAN_COLORS[u.plan] ?? PLAN_COLORS.free)}>
                      {u.plan ?? 'free'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono">{u.credits}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500 hidden sm:table-cell">{u.total_credits_used ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {u.is_admin
                      ? <Badge variant="success" className="text-xs">Admin</Badge>
                      : <span className="text-xs text-gray-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="secondary" onClick={() => setEditingUser(u)} className="text-xs py-1">
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-border">
            <p className="text-xs text-gray-500">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 flex-1">
            Bulk actions (grant credits to all free users) require direct Supabase SQL.
            Use the Edit button per user for individual changes.
          </p>
          <Button variant="secondary" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4" /> Export All Users CSV
          </Button>
        </CardContent>
      </Card>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveUser}
        />
      )}
    </div>
  )
}
