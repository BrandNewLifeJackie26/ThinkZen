'use client'

import { useState, useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type CompanionPhase =
  | { phase: 'inactive' }
  | { phase: 'planning'; companionTask: string }
  | { phase: 'active'; intention: string; companionTask: string }
  | { phase: 'wrapping'; intention: string; companionTask: string }

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T extends readonly string[]>(arr: T): T[number] {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlanningModal({
  companionTask,
  intention,
  onIntentionChange,
  onStart,
  onCancel,
}: {
  companionTask: string
  intention: string
  onIntentionChange: (v: string) => void
  onStart: () => void
  onCancel: () => void
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
        <button
          className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onStart}
          disabled={!intention.trim()}
        >
          Let&apos;s go!
        </button>
        <button
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          onClick={onCancel}
        >
          Never mind
        </button>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompanionWidget() {
  const [phase, setPhase] = useState<CompanionPhase>({ phase: 'inactive' })
  const [intention, setIntention] = useState('')
  const affirmingMessageRef = useRef<string>('')

  useEffect(() => {
    if (phase.phase !== 'wrapping') return
    const id = setTimeout(() => setPhase({ phase: 'inactive' }), WRAP_UP_DELAY_MS)
    return () => clearTimeout(id)
  }, [phase.phase])

  function openPlanning() {
    setIntention('')
    setPhase({ phase: 'planning', companionTask: pickRandom(COMPANION_TASKS) })
  }

  function startSession() {
    if (!intention.trim() || phase.phase !== 'planning') return
    setPhase({ phase: 'active', intention: intention.trim(), companionTask: phase.companionTask })
  }

  function handleWrapUp() {
    if (phase.phase !== 'active') return
    affirmingMessageRef.current = pickRandom(AFFIRMING_MESSAGES)
    setPhase({ phase: 'wrapping', intention: phase.intention, companionTask: phase.companionTask })
  }

  function handleDismiss() {
    setPhase({ phase: 'inactive' })
  }

  // ── inactive ─────────────────────────────────────────────────────────────────

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

  // ── planning ─────────────────────────────────────────────────────────────────

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
          onIntentionChange={setIntention}
          onStart={startSession}
          onCancel={() => setPhase({ phase: 'inactive' })}
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
        <button
          className="w-full py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
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
