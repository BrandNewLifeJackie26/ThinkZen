import { useCallback } from 'react'

export type SessionRecord = {
  id: string
  intention: string
  plannedDurationSeconds: number
  remainingSeconds: number | null
}

export function useStartSession(user: string) {
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

export function useEndSession(user: string) {
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

export function useFetchSessions(user: string) {
  return useCallback(
    async (): Promise<SessionRecord[]> => {
      const res = await fetch(`/api/sessions?user=${encodeURIComponent(user)}`)
      return res.json()
    },
    [user]
  )
}
