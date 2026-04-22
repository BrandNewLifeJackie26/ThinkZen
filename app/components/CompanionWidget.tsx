'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionRecord = {
  id: string
  intention: string
  plannedDurationSeconds: number
  remainingSeconds: number | null
}

type PausedSnapshot = {
  sessionId: string
  intention: string
  companionTask: string
  remainingSeconds: number
}

type CompanionPhase =
  | { phase: 'inactive' }
  | { phase: 'planning'; companionTask: string }
  | { phase: 'active'; sessionId: string; intention: string; companionTask: string; remainingSeconds: number }
  | { phase: 'paused'; sessionId: string; intention: string; companionTask: string; remainingSeconds: number }
  | { phase: 'switching'; prior?: PausedSnapshot }
  | { phase: 'wrapping'; sessionId: string; intention: string; companionTask: string; remainingSeconds: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANION_TASKS = [
  'reviewing my notes',
  'organizing ideas',
  'planning my schedule',
  'clearing my backlog',
  'thinking through priorities',
] as const

const AFFIRMING_MESSAGES = [
  'Great work today!',
  'You showed up. That matters.',
  'Another session done. Well done!',
  'Keep the momentum going!',
] as const

const WRAP_UP_DELAY_MS = 1800
const DEFAULT_DURATION_MINUTES = 25

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T extends readonly string[]>(arr: T): T[number] {
  return arr[Math.floor(Math.random() * arr.length)]
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── API hooks ────────────────────────────────────────────────────────────────

function useStartSession(user: string) {
  return useCallback(
    (params: { intention: string; plannedDurationSeconds: number }) =>
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, ...params }),
      }),
    [user]
  )
}

function useEndSession(user: string) {
  return useCallback(
    (sessionId: string, remainingSeconds: number) =>
      fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, remainingSeconds }),
        keepalive: true,
      }),
    [user]
  )
}

function useFetchSessions(user: string) {
  return useCallback(
    async (): Promise<SessionRecord[]> => {
      const res = await fetch(`/api/sessions?user=${encodeURIComponent(user)}`)
      return res.json()
    },
    [user]
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlanningModal({
  companionTask,
  intention,
  duration,
  startError,
  onIntentionChange,
  onDurationChange,
  onStart,
  onCancel,
  onSwitchSessions,
}: {
  companionTask: string
  intention: string
  duration: number
  startError: string | null
  onIntentionChange: (v: string) => void
  onDurationChange: (v: number) => void
  onStart: () => void
  onCancel: () => void
  onSwitchSessions: () => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      className={`fixed bottom-24 right-6 z-40 w-80 bg-white rounded-2xl shadow-2xl p-6 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="companion-dialog-title"
    >
      <div className="flex flex-col items-center gap-4">
        <span className="text-5xl select-none animate-bounce" aria-hidden="true">🐧</span>
        <p id="companion-dialog-title" className="text-sm text-gray-600 text-center">
          I&apos;ll be{' '}
          <span className="font-medium text-indigo-600">{companionTask}</span>
          {' '}— what are you working on?
        </p>
        <textarea
          className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-gray-400"
          rows={3}
          placeholder="e.g. writing chapter 3..."
          value={intention}
          onChange={(e) => onIntentionChange(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && intention.trim()) onStart()
          }}
        />
        <div className="w-full flex items-center gap-3">
          <label className="text-xs text-gray-500 shrink-0" htmlFor="session-duration">
            Duration
          </label>
          <input
            id="session-duration"
            type="number"
            min={1}
            max={180}
            value={duration}
            onChange={(e) => onDurationChange(Math.max(1, Math.min(180, Number(e.target.value))))}
            className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <span className="text-xs text-gray-500">min</span>
        </div>
        {startError && (
          <p className="w-full text-xs text-red-500 text-center">{startError}</p>
        )}
        <button
          className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onStart}
          disabled={!intention.trim()}
        >
          Let&apos;s go!
        </button>
        <div className="flex gap-4">
          <button
            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
            onClick={onSwitchSessions}
          >
            Resume a session
          </button>
          <button
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            onClick={onCancel}
          >
            Never mind
          </button>
        </div>
      </div>
    </div>
  )
}

function SessionSwitcher({
  sessions,
  loading,
  onSelect,
  onCancel,
}: {
  sessions: SessionRecord[]
  loading: boolean
  onSelect: (session: SessionRecord) => void
  onCancel: () => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function renderBody() {
    if (loading) {
      return (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
        </div>
      )
    }
    if (sessions.length === 0) {
      return <p className="text-sm text-gray-400 text-center py-2">No other sessions to resume.</p>
    }
    return (
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => {
          const remaining = s.remainingSeconds ?? s.plannedDurationSeconds
          const remainingMin = Math.ceil(remaining / 60)
          return (
            <li key={s.id}>
              <button
                className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                onClick={() => onSelect(s)}
              >
                <p className="text-sm font-medium text-gray-800 truncate">{s.intention}</p>
                <p className="text-xs text-indigo-500 mt-0.5">{remainingMin} min remaining</p>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div
      className={`fixed bottom-24 right-6 z-40 w-80 bg-white rounded-2xl shadow-2xl p-6 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="switcher-title"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl select-none" aria-hidden="true">🐧</span>
          <p id="switcher-title" className="text-sm font-medium text-gray-700">
            Pick a session to resume
          </p>
        </div>
        {renderBody()}
        <button
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors self-center"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompanionWidget({ user }: { user: string }) {
  const [phase, setPhase] = useState<CompanionPhase>({ phase: 'inactive' })
  const [intention, setIntention] = useState('')
  const [duration, setDuration] = useState(DEFAULT_DURATION_MINUTES)
  const [startError, setStartError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const affirmingMessageRef = useRef<string>('')
  const phaseRef = useRef(phase)

  const startSessionApi = useStartSession(user)
  const endSession = useEndSession(user)
  const fetchSessions = useFetchSessions(user)

  // Keep phaseRef in sync so the beforeunload handler always sees the latest phase
  useEffect(() => { phaseRef.current = phase })

  // Persist remaining time when the tab is closed during an active/paused session
  useEffect(() => {
    function handleUnload() {
      const p = phaseRef.current
      if (p.phase !== 'active' && p.phase !== 'paused') return
      endSession(p.sessionId, p.remainingSeconds)
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [endSession])

  // Countdown tick
  useEffect(() => {
    if (phase.phase !== 'active') return
    const id = setInterval(() => {
      setPhase((prev) => {
        if (prev.phase !== 'active') return prev
        if (prev.remainingSeconds <= 1) {
          affirmingMessageRef.current = pickRandom(AFFIRMING_MESSAGES)
          return {
            phase: 'wrapping',
            sessionId: prev.sessionId,
            intention: prev.intention,
            companionTask: prev.companionTask,
            remainingSeconds: 0,
          }
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase.phase])

  // End session in DB when wrapping, then auto-dismiss
  useEffect(() => {
    if (phase.phase !== 'wrapping') return
    const { sessionId, remainingSeconds } = phase
    endSession(sessionId, remainingSeconds).catch(console.error)
    const id = setTimeout(() => setPhase({ phase: 'inactive' }), WRAP_UP_DELAY_MS)
    return () => clearTimeout(id)
  }, [phase, endSession])

  function openPlanning() {
    setIntention('')
    setDuration(DEFAULT_DURATION_MINUTES)
    setStartError(null)
    setPhase({ phase: 'planning', companionTask: pickRandom(COMPANION_TASKS) })
  }

  async function startSession() {
    if (!intention.trim() || phase.phase !== 'planning') return
    const companionTask = phase.companionTask
    setStartError(null)

    const res = await startSessionApi({
      intention: intention.trim(),
      plannedDurationSeconds: duration * 60,
    })

    if (res.status === 409) {
      // Already have an active session — redirect to switcher
      openSwitcher()
      return
    }

    if (!res.ok) {
      setStartError('Failed to start session. Please try again.')
      return
    }

    const session = await res.json()
    setPhase({
      phase: 'active',
      sessionId: session.id,
      intention: intention.trim(),
      companionTask,
      remainingSeconds: duration * 60,
    })
  }

  function handlePause() {
    if (phase.phase !== 'active') return
    setPhase({
      phase: 'paused',
      sessionId: phase.sessionId,
      intention: phase.intention,
      companionTask: phase.companionTask,
      remainingSeconds: phase.remainingSeconds,
    })
  }

  function handleResume() {
    if (phase.phase !== 'paused') return
    setPhase({
      phase: 'active',
      sessionId: phase.sessionId,
      intention: phase.intention,
      companionTask: phase.companionTask,
      remainingSeconds: phase.remainingSeconds,
    })
  }

  async function openSwitcher() {
    const prior: PausedSnapshot | undefined =
      phase.phase === 'paused'
        ? {
            sessionId: phase.sessionId,
            intention: phase.intention,
            companionTask: phase.companionTask,
            remainingSeconds: phase.remainingSeconds,
          }
        : undefined

    setPhase({ phase: 'switching', prior })
    setSessionsLoading(true)

    try {
      const data = await fetchSessions()
      // Exclude the currently paused session from the list
      const filtered = prior ? data.filter((s) => s.id !== prior.sessionId) : data
      setSessions(filtered)
    } catch {
      setSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }

  function selectSession(session: SessionRecord) {
    setPhase({
      phase: 'active',
      sessionId: session.id,
      intention: session.intention,
      companionTask: pickRandom(COMPANION_TASKS),
      remainingSeconds: session.remainingSeconds ?? session.plannedDurationSeconds,
    })
  }

  function cancelSwitcher() {
    if (phase.phase !== 'switching') return
    if (phase.prior) {
      setPhase({ phase: 'paused', ...phase.prior })
    } else {
      setPhase({ phase: 'planning', companionTask: pickRandom(COMPANION_TASKS) })
    }
  }

  function handleWrapUp() {
    if (phase.phase !== 'active' && phase.phase !== 'paused') return
    affirmingMessageRef.current = pickRandom(AFFIRMING_MESSAGES)
    setPhase({
      phase: 'wrapping',
      sessionId: phase.sessionId,
      intention: phase.intention,
      companionTask: phase.companionTask,
      remainingSeconds: phase.remainingSeconds,
    })
  }

  function handleDismiss() {
    setPhase({ phase: 'inactive' })
  }

  // ── inactive ──────────────────────────────────────────────────────────────────

  if (phase.phase === 'inactive') {
    return (
      <button
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center hover:scale-110 transition-transform duration-200"
        onClick={openPlanning}
        aria-label="Start focus session"
      >
        <span className="text-3xl select-none">🐧</span>
      </button>
    )
  }

  // ── planning ──────────────────────────────────────────────────────────────────

  if (phase.phase === 'planning') {
    return (
      <>
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setPhase({ phase: 'inactive' })}
        />
        <PlanningModal
          companionTask={phase.companionTask}
          intention={intention}
          duration={duration}
          startError={startError}
          onIntentionChange={setIntention}
          onDurationChange={setDuration}
          onStart={startSession}
          onCancel={() => setPhase({ phase: 'inactive' })}
          onSwitchSessions={openSwitcher}
        />
      </>
    )
  }

  // ── switching ─────────────────────────────────────────────────────────────────

  if (phase.phase === 'switching') {
    return (
      <>
        <div className="fixed inset-0 z-30 bg-black/40" onClick={cancelSwitcher} />
        <SessionSwitcher
          sessions={sessions}
          loading={sessionsLoading}
          onSelect={selectSession}
          onCancel={cancelSwitcher}
        />
      </>
    )
  }

  // ── active ────────────────────────────────────────────────────────────────────

  if (phase.phase === 'active') {
    return (
      <div className="fixed bottom-6 right-6 z-30 w-64 bg-white rounded-2xl shadow-xl border border-indigo-100 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl select-none animate-bounce" aria-hidden="true">🐧</span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-gray-400">working on...</span>
            <span className="text-sm font-medium text-gray-700 truncate">{phase.companionTask}</span>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-3 flex flex-col gap-1">
          <span className="text-xs text-gray-400">you&apos;re working on...</span>
          <p className="text-sm text-gray-800 line-clamp-2">{phase.intention}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-mono font-semibold text-indigo-600 tabular-nums">
            {formatTime(phase.remainingSeconds)}
          </span>
          <button
            className="px-3 py-1 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={handlePause}
          >
            Pause
          </button>
        </div>
        <button
          className="w-full py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          onClick={handleWrapUp}
        >
          Wrap up
        </button>
      </div>
    )
  }

  // ── paused ────────────────────────────────────────────────────────────────────

  if (phase.phase === 'paused') {
    return (
      <div className="fixed bottom-6 right-6 z-30 w-64 bg-white rounded-2xl shadow-xl border border-amber-100 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl select-none" aria-hidden="true">🐧</span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-amber-500">taking a break...</span>
            <span className="text-sm font-medium text-gray-700 truncate">{phase.companionTask}</span>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-3 flex flex-col gap-1">
          <span className="text-xs text-gray-400">you were working on...</span>
          <p className="text-sm text-gray-800 line-clamp-2">{phase.intention}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-mono font-semibold text-amber-500 tabular-nums">
            {formatTime(phase.remainingSeconds)}
          </span>
          <span className="text-xs text-amber-400 font-medium">paused</span>
        </div>
        <div className="flex gap-2">
          <button
            className="flex-1 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            onClick={handleResume}
          >
            Resume
          </button>
          <button
            className="flex-1 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={openSwitcher}
          >
            Switch
          </button>
        </div>
        <button
          className="w-full py-1.5 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          onClick={handleWrapUp}
        >
          Wrap up
        </button>
      </div>
    )
  }

  // ── wrapping ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 z-30 w-64 bg-white rounded-2xl shadow-xl border border-indigo-100 p-4 flex flex-col items-center gap-3">
      <span className="text-4xl select-none" aria-hidden="true">🐧</span>
      <p className="text-sm font-medium text-center text-gray-700">{affirmingMessageRef.current}</p>
      <div className="w-5 h-5 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
      <button
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        onClick={handleDismiss}
      >
        Dismiss
      </button>
    </div>
  )
}
