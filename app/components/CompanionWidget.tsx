'use client'

import { useState, useRef, useEffect } from 'react'
import { type SessionRecord, useStartSession, usePauseSession, useEndSession, useFetchSessions } from '@/app/hooks/sessions'
import {
  type Tone,
  type PlanningResult,
  usePlanningMessage,
  useSessionStartMessage,
  useAmbientMessage,
  useSessionEndMessage,
} from '@/app/hooks/companion'

// ─── Types ────────────────────────────────────────────────────────────────────

type PausedSnapshot = {
  sessionId: string
  intention: string
  companionTask: string
  subtasks: string[]
  icon: string
  tone: Tone
  currentSubtaskIdx: number
  remainingSeconds: number
  durationSeconds: number
}

type CompanionPhase =
  | { phase: 'inactive' }
  | { phase: 'planning'; companionTask: string }
  | {
      phase: 'active'
      sessionId: string
      intention: string
      companionTask: string
      subtasks: string[]
      icon: string
      tone: Tone
      currentSubtaskIdx: number
      remainingSeconds: number
      durationSeconds: number
    }
  | {
      phase: 'paused'
      sessionId: string
      intention: string
      companionTask: string
      subtasks: string[]
      icon: string
      tone: Tone
      currentSubtaskIdx: number
      remainingSeconds: number
      durationSeconds: number
    }
  | { phase: 'switching'; prior?: PausedSnapshot }
  | {
      phase: 'wrapping'
      sessionId: string
      intention: string
      companionTask: string
      subtasks: string[]
      icon: string
      tone: Tone
      remainingSeconds: number
      durationSeconds: number
    }

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANION_TASKS = [
  'reviewing my notes',
  'organizing ideas',
  'planning my schedule',
  'clearing my backlog',
  'thinking through priorities',
] as const

const DEFAULT_DURATION_MINUTES = 25
const WRAP_UP_DELAY_MS = 2000
const AMBIENT_TRIGGER_SECONDS = 1200 // 20 min

const TONE_STYLES: Record<Tone, { bg: string; text: string }> = {
  focused: { bg: 'bg-gray-100', text: 'text-gray-600' },
  energetic: { bg: 'bg-orange-100', text: 'text-orange-600' },
  calm: { bg: 'bg-blue-100', text: 'text-blue-600' },
  playful: { bg: 'bg-purple-100', text: 'text-purple-600' },
  steady: { bg: 'bg-green-100', text: 'text-green-600' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T extends readonly string[]>(arr: T): T[number] {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function readStream(
  response: Response,
  onChunk: (accumulated: string) => void,
  signal?: { cancelled: boolean },
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let accumulated = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (signal?.cancelled) { reader.cancel(); return }
    accumulated += decoder.decode(value, { stream: true })
    onChunk(accumulated)
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlanningModal({
  companionTask,
  intention,
  duration,
  startError,
  guidance,
  guidanceLoading,
  isStarting,
  onIntentionChange,
  onDurationChange,
  onSuggestedDuration,
  onStart,
  onCancel,
  onSwitchSessions,
}: {
  companionTask: string
  intention: string
  duration: number
  startError: string | null
  guidance: PlanningResult | null
  guidanceLoading: boolean
  isStarting: boolean
  onIntentionChange: (v: string) => void
  onDurationChange: (v: number) => void
  onSuggestedDuration: (min: number) => void
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
          className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-gray-400 disabled:opacity-60"
          rows={3}
          placeholder="e.g. writing chapter 3..."
          value={intention}
          onChange={(e) => onIntentionChange(e.target.value)}
          autoFocus
          disabled={isStarting}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && intention.trim() && !isStarting) onStart()
          }}
        />

        {/* AI planning guidance */}
        <div className="w-full min-h-[2.5rem]">
          {guidanceLoading && intention.trim() && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-3 h-3 rounded-full border-2 border-gray-200 border-t-gray-400 animate-spin flex-shrink-0" />
              <span>Thinking...</span>
            </div>
          )}
          {guidance && !guidanceLoading && (
            <div className="bg-indigo-50 rounded-lg px-3 py-2.5 flex flex-col gap-1.5">
              <p className="text-xs text-indigo-700">{guidance.guidance}</p>
              {guidance.shouldSplit && (
                <p className="text-xs text-amber-600">✂ Consider splitting this into smaller chunks.</p>
              )}
              {guidance.suggestedDuration && (
                <button
                  className="self-start text-xs text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2 transition-colors"
                  onClick={() => onSuggestedDuration(guidance.suggestedDuration!)}
                >
                  Set {guidance.suggestedDuration} min
                </button>
              )}
            </div>
          )}
        </div>

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
            className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
            disabled={isStarting}
          />
          <span className="text-xs text-gray-500">min</span>
        </div>
        {startError && (
          <p className="w-full text-xs text-red-500 text-center">{startError}</p>
        )}
        <button
          className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          onClick={onStart}
          disabled={!intention.trim() || isStarting}
        >
          {isStarting ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Starting...
            </>
          ) : (
            "Let's go!"
          )}
        </button>
        <div className="flex gap-4">
          <button
            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors disabled:opacity-50"
            onClick={onSwitchSessions}
            disabled={isStarting}
          >
            Resume a session
          </button>
          <button
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            onClick={onCancel}
            disabled={isStarting}
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

function AmbientToast({
  icon,
  message,
  onDismiss,
}: {
  icon: string
  message: string
  onDismiss: () => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      className={`fixed top-6 right-6 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-indigo-100 p-4 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl select-none flex-shrink-0" aria-hidden="true">{icon}</span>
        <p className="text-sm text-gray-700 flex-1 leading-relaxed">{message}</p>
        <button
          className="text-lg leading-none text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
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

  // Planning guidance
  const [planningGuidance, setPlanningGuidance] = useState<PlanningResult | null>(null)
  const [planningGuidanceLoading, setPlanningGuidanceLoading] = useState(false)

  // Session start loading (waiting for AI + DB)
  const [sessionStartLoading, setSessionStartLoading] = useState(false)

  // Opening message shown at start of active session
  const [openingMessage, setOpeningMessage] = useState<string | null>(null)

  // Ambient check-in toast
  const [ambientMessage, setAmbientMessage] = useState<string | null>(null)

  // Wrap-up message
  const [wrapUpMessage, setWrapUpMessage] = useState('')
  const [wrapUpLoading, setWrapUpLoading] = useState(false)
  const wrapUpStartedRef = useRef(false)

  const startSessionApi = useStartSession(user)
  const pauseSession = usePauseSession(user)
  const endSession = useEndSession(user)
  const fetchSessions = useFetchSessions(user)

  const getPlanningMessage = usePlanningMessage()
  const getSessionStartMessage = useSessionStartMessage()
  const getAmbientMessage = useAmbientMessage()
  const getSessionEndMessage = useSessionEndMessage()

  const phaseRef = useRef(phase)
  useEffect(() => { phaseRef.current = phase })

  // Save remaining time when the tab is closed during an active/paused session
  useEffect(() => {
    function handleUnload() {
      const p = phaseRef.current
      if (p.phase !== 'active' && p.phase !== 'paused') return
      pauseSession(p.sessionId, p.remainingSeconds)
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [pauseSession])

  // On mount, restore the most recent active session from the DB
  useEffect(() => {
    fetchSessions().then((data) => {
      if (data.length === 0) return
      setPhase((current) => {
        if (current.phase !== 'inactive') return current
        const session = data[0]
        return {
          phase: 'active',
          sessionId: session.id,
          intention: session.intention,
          companionTask: pickRandom(COMPANION_TASKS),
          subtasks: [],
          icon: '🐧',
          tone: 'steady',
          currentSubtaskIdx: 0,
          remainingSeconds: session.remainingSeconds ?? session.plannedDurationSeconds,
          durationSeconds: session.plannedDurationSeconds,
        }
      })
    }).catch(() => { /* best-effort */ })
  }, [fetchSessions])

  // Countdown tick
  useEffect(() => {
    if (phase.phase !== 'active') return
    const id = setInterval(() => {
      setPhase((prev) => {
        if (prev.phase !== 'active') return prev
        if (prev.remainingSeconds <= 1) {
          return {
            phase: 'wrapping',
            sessionId: prev.sessionId,
            intention: prev.intention,
            companionTask: prev.companionTask,
            subtasks: prev.subtasks,
            icon: prev.icon,
            tone: prev.tone,
            remainingSeconds: 0,
            durationSeconds: prev.durationSeconds,
          }
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phase.phase])

  // Planning guidance: debounced call when intention or duration changes
  useEffect(() => {
    if (phase.phase !== 'planning' || !intention.trim()) {
      setPlanningGuidance(null)
      setPlanningGuidanceLoading(false)
      return
    }

    setPlanningGuidanceLoading(true)
    setPlanningGuidance(null)
    let cancelled = false

    const id = setTimeout(() => {
      getPlanningMessage({ intention, durationSeconds: duration * 60 })
        .then((result) => {
          if (!cancelled) {
            setPlanningGuidance(result)
            setPlanningGuidanceLoading(false)
          }
        })
        .catch(() => {
          if (!cancelled) setPlanningGuidanceLoading(false)
        })
    }, 800)

    return () => {
      cancelled = true
      clearTimeout(id)
      setPlanningGuidanceLoading(false)
    }
  }, [intention, duration, phase.phase, getPlanningMessage])

  // Subtask rotation: advance current subtask index on a per-subtask interval
  useEffect(() => {
    if (phase.phase !== 'active' || phase.subtasks.length <= 1) return
    const subtaskCount = phase.subtasks.length
    const sessionDuration = phase.durationSeconds
    const interval = Math.max(Math.floor(sessionDuration / subtaskCount), 60)

    const id = setInterval(() => {
      setPhase((prev) => {
        if (prev.phase !== 'active') return prev
        return { ...prev, currentSubtaskIdx: (prev.currentSubtaskIdx + 1) % prev.subtasks.length }
      })
    }, interval * 1000)

    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.phase === 'active' && phase.subtasks.length, phase.phase === 'active' && phase.durationSeconds, phase.phase])

  // Ambient check-in: fires after 20 min of active session time
  useEffect(() => {
    if (phase.phase !== 'active') return

    let elapsed = 0
    let fired = false

    const id = setInterval(() => {
      elapsed += 1
      if (elapsed >= AMBIENT_TRIGGER_SECONDS && !fired) {
        fired = true
        const p = phaseRef.current
        if (p.phase !== 'active') return
        getAmbientMessage({
          intention: p.intention,
          durationSeconds: p.durationSeconds,
          companionContext: { companionTask: p.companionTask, elapsedSeconds: elapsed },
        })
          .then((res) => res.text())
          .then((msg) => {
            setAmbientMessage(msg)
            setTimeout(() => setAmbientMessage(null), 6000)
          })
          .catch(() => {})
      }
    }, 1000)

    return () => clearInterval(id)
  }, [phase.phase, getAmbientMessage])

  // Wrap-up: call end session API + fetch AI closing message
  useEffect(() => {
    if (phase.phase !== 'wrapping') {
      wrapUpStartedRef.current = false
      return
    }
    if (wrapUpStartedRef.current) return
    wrapUpStartedRef.current = true

    const { sessionId, remainingSeconds, intention: wrapIntention, companionTask, durationSeconds } = phase

    setWrapUpLoading(true)
    setWrapUpMessage('')
    endSession(sessionId, remainingSeconds).catch(console.error)

    const signal = { cancelled: false }
    getSessionEndMessage({
      intention: wrapIntention,
      durationSeconds,
      companionContext: { companionTask, elapsedSeconds: durationSeconds - remainingSeconds },
    })
      .then((res) => readStream(res, (text) => { if (!signal.cancelled) setWrapUpMessage(text) }, signal))
      .then(() => { if (!signal.cancelled) setWrapUpLoading(false) })
      .catch(() => {
        if (!signal.cancelled) {
          setWrapUpMessage('You showed up. That matters.')
          setWrapUpLoading(false)
        }
      })

    return () => { signal.cancelled = true }
  }, [phase, endSession, getSessionEndMessage])

  // Auto-dismiss wrap-up after message is shown
  useEffect(() => {
    if (!wrapUpMessage || wrapUpLoading) return
    const id = setTimeout(() => setPhase({ phase: 'inactive' }), WRAP_UP_DELAY_MS)
    return () => clearTimeout(id)
  }, [wrapUpMessage, wrapUpLoading])

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function openPlanning() {
    setIntention('')
    setDuration(DEFAULT_DURATION_MINUTES)
    setStartError(null)
    setPlanningGuidance(null)
    setPhase({ phase: 'planning', companionTask: pickRandom(COMPANION_TASKS) })
  }

  async function startSession() {
    if (!intention.trim() || phase.phase !== 'planning') return
    setStartError(null)
    setSessionStartLoading(true)

    try {
      const [sessionRes, aiData] = await Promise.all([
        startSessionApi({
          intention: intention.trim(),
          plannedDurationSeconds: duration * 60,
        }),
        getSessionStartMessage({ intention: intention.trim(), durationSeconds: duration * 60 }),
      ])

      if (sessionRes.status === 409) {
        openSwitcher()
        return
      }

      if (!sessionRes.ok) {
        setStartError('Failed to start session. Please try again.')
        return
      }

      const session = await sessionRes.json()
      setOpeningMessage(aiData.message)
      setPhase({
        phase: 'active',
        sessionId: session.id,
        intention: intention.trim(),
        companionTask: aiData.companionTask,
        subtasks: aiData.subtasks,
        icon: aiData.icon,
        tone: aiData.tone,
        currentSubtaskIdx: 0,
        remainingSeconds: duration * 60,
        durationSeconds: duration * 60,
      })
    } catch {
      setStartError('Failed to start session. Please try again.')
    } finally {
      setSessionStartLoading(false)
    }
  }

  function handlePause() {
    if (phase.phase !== 'active') return
    setPhase({
      phase: 'paused',
      sessionId: phase.sessionId,
      intention: phase.intention,
      companionTask: phase.companionTask,
      subtasks: phase.subtasks,
      icon: phase.icon,
      tone: phase.tone,
      currentSubtaskIdx: phase.currentSubtaskIdx,
      remainingSeconds: phase.remainingSeconds,
      durationSeconds: phase.durationSeconds,
    })
  }

  function handleResume() {
    if (phase.phase !== 'paused') return
    setPhase({
      phase: 'active',
      sessionId: phase.sessionId,
      intention: phase.intention,
      companionTask: phase.companionTask,
      subtasks: phase.subtasks,
      icon: phase.icon,
      tone: phase.tone,
      currentSubtaskIdx: phase.currentSubtaskIdx,
      remainingSeconds: phase.remainingSeconds,
      durationSeconds: phase.durationSeconds,
    })
  }

  async function openSwitcher() {
    const prior: PausedSnapshot | undefined =
      phase.phase === 'paused'
        ? {
            sessionId: phase.sessionId,
            intention: phase.intention,
            companionTask: phase.companionTask,
            subtasks: phase.subtasks,
            icon: phase.icon,
            tone: phase.tone,
            currentSubtaskIdx: phase.currentSubtaskIdx,
            remainingSeconds: phase.remainingSeconds,
            durationSeconds: phase.durationSeconds,
          }
        : undefined

    setPhase({ phase: 'switching', prior })
    setSessionsLoading(true)

    try {
      const data = await fetchSessions()
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
      subtasks: [],
      icon: '🐧',
      tone: 'steady',
      currentSubtaskIdx: 0,
      remainingSeconds: session.remainingSeconds ?? session.plannedDurationSeconds,
      durationSeconds: session.plannedDurationSeconds,
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
    setPhase({
      phase: 'wrapping',
      sessionId: phase.sessionId,
      intention: phase.intention,
      companionTask: phase.companionTask,
      subtasks: phase.subtasks,
      icon: phase.icon,
      tone: phase.tone,
      remainingSeconds: phase.remainingSeconds,
      durationSeconds: phase.durationSeconds,
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
          onClick={() => !sessionStartLoading && setPhase({ phase: 'inactive' })}
        />
        <PlanningModal
          companionTask={phase.companionTask}
          intention={intention}
          duration={duration}
          startError={startError}
          guidance={planningGuidance}
          guidanceLoading={planningGuidanceLoading}
          isStarting={sessionStartLoading}
          onIntentionChange={setIntention}
          onDurationChange={setDuration}
          onSuggestedDuration={(min) => setDuration(min)}
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
    const toneStyle = TONE_STYLES[phase.tone]
    const currentSubtask = phase.subtasks[phase.currentSubtaskIdx]

    return (
      <>
        {ambientMessage && (
          <AmbientToast
            icon={phase.icon}
            message={ambientMessage}
            onDismiss={() => setAmbientMessage(null)}
          />
        )}
        <div className="fixed bottom-6 right-6 z-30 w-64 bg-white rounded-2xl shadow-xl border border-indigo-100 p-4 flex flex-col gap-3">
          {/* Opening message */}
          {openingMessage && (
            <div className="bg-indigo-50 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <p className="text-xs text-indigo-700 flex-1 leading-relaxed">{openingMessage}</p>
              <button
                className="text-lg leading-none text-indigo-200 hover:text-indigo-400 flex-shrink-0 transition-colors"
                onClick={() => setOpeningMessage(null)}
                aria-label="Dismiss opening message"
              >
                ×
              </button>
            </div>
          )}

          {/* Companion header */}
          <div className="flex items-center gap-3">
            <span className="text-3xl select-none animate-bounce" aria-hidden="true">{phase.icon}</span>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-400">working on...</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${toneStyle.bg} ${toneStyle.text}`}>
                  {phase.tone}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700 truncate">{phase.companionTask}</span>
              {currentSubtask && (
                <span className="text-xs text-gray-400 truncate">↳ {currentSubtask}</span>
              )}
            </div>
          </div>

          {/* User intention */}
          <div className="border-t border-gray-100 pt-3 flex flex-col gap-1">
            <span className="text-xs text-gray-400">you&apos;re working on...</span>
            <p className="text-sm text-gray-800 line-clamp-2">{phase.intention}</p>
          </div>

          {/* Timer + pause */}
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
      </>
    )
  }

  // ── paused ────────────────────────────────────────────────────────────────────

  if (phase.phase === 'paused') {
    return (
      <div className="fixed bottom-6 right-6 z-30 w-64 bg-white rounded-2xl shadow-xl border border-amber-100 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl select-none" aria-hidden="true">{phase.icon}</span>
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
      <span className="text-4xl select-none" aria-hidden="true">{phase.icon}</span>
      {!wrapUpMessage && wrapUpLoading ? (
        <>
          <p className="text-sm text-gray-400 text-center">Wrapping up...</p>
          <div className="w-5 h-5 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
        </>
      ) : (
        <p className="text-sm font-medium text-center text-gray-700">{wrapUpMessage}</p>
      )}
      <button
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        onClick={handleDismiss}
      >
        Dismiss
      </button>
    </div>
  )
}
