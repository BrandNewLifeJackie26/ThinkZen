'use client'

import { useState, useEffect } from 'react'
import type { SessionRecord } from '@/app/hooks/sessions'

export function SessionSwitcher({
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
