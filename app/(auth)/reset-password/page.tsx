'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Video, Loader2, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword]       = useState('')
  const [confirm, setConfirm]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)
  const [error, setError]             = useState('')
  const [validSession, setValidSession] = useState(false)
  const [checking, setChecking]       = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // onAuthStateChange fires with PASSWORD_RECOVERY when Supabase
    // processes the token from the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setValidSession(true)
      setChecking(false)
    })

    // Also check for an existing session (user may have already exchanged the token)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setValidSession(true)
      setChecking(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }

    setLoading(true); setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setDone(true)
      setTimeout(() => router.push('/login'), 3000)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white">ReelForge</span>
          </Link>
        </div>

        <div className="card p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-950 border border-green-700 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Password updated!</h2>
              <p className="text-gray-400 text-sm">Redirecting you to login…</p>
            </div>
          ) : !validSession ? (
            <div className="text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
              <h2 className="text-xl font-bold text-white">Invalid or expired link</h2>
              <p className="text-gray-400 text-sm">
                This reset link has expired. Please request a new one.
              </p>
              <Link
                href="/forgot-password"
                className="inline-block bg-brand-600 hover:bg-brand-500 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
              >
                Request New Link
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white mb-2">Set new password</h1>
              <p className="text-gray-400 text-sm mb-6">
                Choose a strong password for your account.
              </p>

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input"
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                    : 'Update Password'
                  }
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
