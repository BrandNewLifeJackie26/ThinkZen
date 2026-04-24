'use client'

import { useState, useEffect } from 'react'
import type { PlanningResult } from '@/app/hooks/companion'

export function PlanningModal({
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
  onRequestGuidance,
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
  onRequestGuidance: () => void
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
        <div className="w-full">
          {!guidance && !guidanceLoading && intention.trim() && (
            <button
              className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
              onClick={onRequestGuidance}
              disabled={isStarting}
            >
              ✦ Help me schedule this
            </button>
          )}
          {guidanceLoading && (
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
