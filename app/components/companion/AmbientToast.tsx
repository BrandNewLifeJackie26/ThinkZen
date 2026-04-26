'use client'

import { useState, useEffect } from 'react'

export function AmbientToast({
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
