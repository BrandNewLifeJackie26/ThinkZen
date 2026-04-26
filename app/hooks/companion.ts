import { useCallback } from 'react'

export type Tone = 'focused' | 'energetic' | 'calm' | 'playful' | 'steady'

export type PlanningResult = {
  guidance: string
  suggestedDuration?: number
  shouldSplit?: boolean
}

export type SessionStartResult = {
  companionTask: string
  subtasks: string[]
  icon: string
  tone: Tone
  message: string
}

export function usePlanningMessage() {
  return useCallback(
    async (params: { intention: string; durationSeconds: number }): Promise<PlanningResult> => {
      const res = await fetch('/api/companion/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'planning', ...params }),
      })
      return res.json()
    },
    []
  )
}

export function useSessionStartMessage() {
  return useCallback(
    async (params: { intention: string; durationSeconds: number }): Promise<SessionStartResult> => {
      const res = await fetch('/api/companion/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'session_start', ...params }),
      })
      return res.json()
    },
    []
  )
}

export function useAmbientMessage() {
  return useCallback(
    (params: {
      intention: string
      durationSeconds: number
      companionContext: { companionTask: string; elapsedSeconds: number }
    }): Promise<Response> =>
      fetch('/api/companion/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'ambient', ...params }),
      }),
    []
  )
}

export function useSessionEndMessage() {
  return useCallback(
    (params: {
      intention: string
      durationSeconds: number
      companionContext: { companionTask: string; elapsedSeconds: number }
    }): Promise<Response> =>
      fetch('/api/companion/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'session_end', ...params }),
      }),
    []
  )
}
