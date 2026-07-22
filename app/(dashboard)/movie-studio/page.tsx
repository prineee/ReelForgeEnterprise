'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED']

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductionStatusResponse {
  success: boolean
  productionId: string
  status: string
  currentStage: string | null
  progress: number
  completedStages: string[]
  remainingStages: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatStage(stage: string): string {
  return stage
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MovieStudioPage() {
  const [idea, setIdea] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [productionId, setProductionId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [completedStages, setCompletedStages] = useState<string[]>([])
  const [remainingStages, setRemainingStages] = useState<string[]>([])
  const [pollError, setPollError] = useState('')

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  async function fetchStatus(id: string) {
    try {
      const res = await fetch(`/api/movie/status/${id}`)
      const json = await res.json()

      if (!res.ok) {
        setPollError(json.error ?? 'Failed to fetch status.')
        return
      }

      const data = json as ProductionStatusResponse
      setStatus(data.status)
      setCurrentStage(data.currentStage)
      setProgress(data.progress)
      setCompletedStages(data.completedStages ?? [])
      setRemainingStages(data.remainingStages ?? [])
      setPollError('')

      if (TERMINAL_STATUSES.includes(data.status)) {
        stopPolling()
      }
    } catch {
      setPollError('Network error while checking status.')
    }
  }

  async function handleCreate() {
    if (!idea.trim()) return

    setCreating(true)
    setCreateError('')
    setProductionId(null)
    setStatus(null)
    setCurrentStage(null)
    setProgress(0)
    setCompletedStages([])
    setRemainingStages([])
    setPollError('')
    stopPolling()

    try {
      const res = await fetch('/api/movie/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea }),
      })
      const json = await res.json()

      if (!res.ok) {
        setCreateError(json.error ?? 'Failed to start production.')
        return
      }

      const newProductionId: string = json.productionId
      setProductionId(newProductionId)
      setStatus(json.status ?? 'QUEUED')
      setCurrentStage(json.currentStage ?? null)

      await fetchStatus(newProductionId)
      pollRef.current = setInterval(() => fetchStatus(newProductionId), POLL_INTERVAL_MS)
    } catch {
      setCreateError('Network error. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  const isRunning = productionId !== null && status !== null && !TERMINAL_STATUSES.includes(status)
  const isSuccess = status === 'COMPLETED'
  const isFailure = status === 'FAILED' || status === 'CANCELLED'

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">AI Movie Studio</h1>
        <p className="text-gray-400 text-sm">Describe your movie idea and the director pipeline will plan, prompt, and assemble it.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Movie Idea</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="input min-h-[120px] resize-y"
            placeholder="A brilliant detective discovers that the AI governing the city has been manipulating citizens' memories. When her own partner becomes a suspect, she must decide who to trust before the system erases her too…"
            value={idea}
            onChange={e => setIdea(e.target.value)}
            disabled={creating || isRunning}
          />

          {createError && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <XCircle className="w-4 h-4 shrink-0" /> {createError}
            </div>
          )}

          <Button onClick={handleCreate} disabled={!idea.trim() || creating || isRunning} className="w-full">
            {creating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate Movie</>
            )}
          </Button>
        </CardContent>
      </Card>

      {productionId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Production Progress</span>
              {isRunning && <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />}
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-green-400" />}
              {isFailure && <XCircle className="w-5 h-5 text-red-400" />}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="text-xs text-gray-500">
              Production ID: <span className="text-gray-300 font-mono">{productionId}</span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-surface-card border border-surface-border overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    isFailure ? 'bg-red-500' : isSuccess ? 'bg-green-500' : 'bg-brand-500'
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </div>

            {currentStage && !isSuccess && !isFailure && (
              <div className="flex items-center gap-2 text-sm text-gray-200">
                <Clock className="w-4 h-4 text-brand-400" />
                <span>Current stage: <span className="font-medium text-white">{formatStage(currentStage)}</span></span>
              </div>
            )}

            {completedStages.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1.5">Completed Stages</p>
                <div className="flex flex-wrap gap-1.5">
                  {completedStages.map(s => (
                    <Badge key={s} variant="success" className="text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {formatStage(s)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {remainingStages.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1.5">Remaining Stages</p>
                <div className="flex flex-wrap gap-1.5">
                  {remainingStages.map(s => (
                    <Badge key={s} variant="default" className="text-xs flex items-center gap-1 opacity-60">
                      <Clock className="w-3 h-3" /> {formatStage(s)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {pollError && (
              <div className="flex items-center gap-2 text-sm text-yellow-400">
                <XCircle className="w-4 h-4 shrink-0" /> {pollError}
              </div>
            )}

            {isSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-400 bg-green-950/30 border border-green-800 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Movie production completed successfully.
              </div>
            )}

            {isFailure && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-3 py-2.5">
                <XCircle className="w-4 h-4 shrink-0" />
                Movie production {status === 'CANCELLED' ? 'was cancelled' : 'failed'}.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
