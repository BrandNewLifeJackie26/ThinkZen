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
import { pickRandom, formatTime, readStream } from '@/app/components/utils'
import type { PausedSnapshot, CompanionPhase } from './types'
import {
  COMPANION_TASKS,
  DEFAULT_DURATION_MINUTES,
  WRAP_UP_DELAY_MS,
  AMBIENT_TRIGGER_SECONDS,
  TONE_STYLES,
} from './constants'
import { PlanningModal } from './PlanningModal'
import { SessionSwitcher } from './SessionSwitcher'
import { AmbientToast } from './AmbientToast'

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
          tone: 'steady' as Tone,
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

  // Clear guidance when the intention changes so the hint button reappears
  useEffect(() => {
    setPlanningGuidance(null)
  }, [intention])

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

  function requestGuidance() {
    if (!intention.trim()) return
    setPlanningGuidanceLoading(true)
    setPlanningGuidance(null)
    getPlanningMessage({ intention, durationSeconds: duration * 60 })
      .then((result) => {
        setPlanningGuidance(result)
        setPlanningGuidanceLoading(false)
      })
      .catch(() => setPlanningGuidanceLoading(false))
  }

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
      tone: 'steady' as Tone,
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
          onRequestGuidance={requestGuidance}
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
