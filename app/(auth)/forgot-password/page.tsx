'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Video, Loader2, ArrowLeft, Mail, Check } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white">ReelForge</span>
          </Link>
        </div>

        <div className="card p-8">
          {!sent ? (
            <>
              <h1 className="text-2xl font-bold text-white mb-2">Forgot password?</h1>
              <p className="text-gray-400 text-sm mb-6">
                Enter your email and we&apos;ll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      className="input pl-10"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                    : 'Send Reset Link'
                  }
                </button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-950 border border-green-700 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Check your email</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                We sent a password reset link to<br />
                <span className="text-white font-medium">{email}</span>
              </p>
              <p className="text-gray-500 text-xs">
                Didn&apos;t receive it? Check your spam folder or{' '}
                <button
                  onClick={() => setSent(false)}
                  className="text-brand-400 hover:text-brand-300 underline"
                >
                  try again
                </button>
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
