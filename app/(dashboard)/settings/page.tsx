'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Bell, Shield, Loader2, Check, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<'profile' | 'notifications' | 'security'>('profile')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email ?? '')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(supabase.from('users') as any).select('name').eq('id', user.id).single().then(({ data }: { data: { name: string } | null }) => {
          if (data?.name) setName(data.name)
        })
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('users') as any).update({ name }).eq('id', user.id)
    }
    setSaved(true)
    setLoading(false)
    setTimeout(() => setSaved(false), 2500)
  }

  const tabs = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'security', label: 'Security', icon: Shield },
  ] as const

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-gray-400 text-sm">Manage your account preferences.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface-card border border-surface-border rounded-xl p-1 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-brand-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-surface-hover'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <Card>
          <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-2xl font-bold text-white">
                  {name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{name || 'Your Name'}</p>
                  <p className="text-xs text-gray-500">{email}</p>
                </div>
              </div>

              <div className="border-t border-surface-border pt-4 space-y-4">
                <div>
                  <label className="label">Full Name</label>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input
                    className="input opacity-60 cursor-not-allowed"
                    value={email}
                    readOnly
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed here.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
                  {saved ? 'Saved!' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Notifications Tab */}
      {tab === 'notifications' && (
        <Card>
          <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: 'n1', label: 'Reel generation complete', desc: 'Get notified when your reel finishes rendering.' },
              { id: 'n2', label: 'Credit usage alerts', desc: 'Alert when credits drop below 10.' },
              { id: 'n3', label: 'New affiliate earnings', desc: 'Notify when a referral converts.' },
              { id: 'n4', label: 'Product updates', desc: 'New features and improvements.' },
              { id: 'n5', label: 'Marketing emails', desc: 'Tips, tutorials, and promotions.' },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3 border-b border-surface-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked={item.id !== 'n5'} />
                  <div className="w-10 h-5 bg-surface-border peer-checked:bg-brand-600 rounded-full transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
            ))}
            <Button className="mt-2">Save Preferences</Button>
          </CardContent>
        </Card>
      )}

      {/* Security Tab */}
      {tab === 'security' && (
        <div className="space-y-4">
          <Card>
  <CardHeader>
    <CardTitle>Logout</CardTitle>
  </CardHeader>

  <CardContent>
    <Button
       onClick={async () => {
        const confirmed = window.confirm(
          'Are you sure you want to logout?'
        )

        if (!confirmed) return

        await supabase.auth.signOut()
        router.push('/login')
      }}
    >
      Logout
    </Button>
  </CardContent>
</Card>
          <Card>
            <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <input type="password" className="input" placeholder="••••••••" />
              </div>
              <div>
                <label className="label">New Password</label>
                <input type="password" className="input" placeholder="Min. 8 characters" />
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input type="password" className="input" placeholder="Repeat new password" />
              </div>
              <Button>Update Password</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-red-400">Danger Zone</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-400">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <button
                disabled={deleting}
                onClick={async () => {
                  if (!window.confirm('Permanently delete your account and all data? This cannot be undone.')) return
                  setDeleting(true)
                  const res = await fetch('/api/account/delete', { method: 'DELETE' })
                  if (res.ok) {
                    await supabase.auth.signOut()
                    router.push('/')
                  } else {
                    alert('Failed to delete account. Please try again or contact support.')
                    setDeleting(false)
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-950/50 hover:bg-red-950 border border-red-800 text-red-400 hover:text-red-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</>
                  : <><Trash2 className="w-4 h-4" /> Delete Account</>}
              </button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
