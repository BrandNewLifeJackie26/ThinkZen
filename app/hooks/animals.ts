import { useCallback } from 'react'

export type AnimalEncounter = {
  id: string
  userId: string
  sessionId: string
  animalEmoji: string
  encounteredAt: string
}

export function useRecordEncounter(userId: string) {
  return useCallback(
    (params: { sessionId: string; animalEmoji: string }) =>
      fetch('/api/animals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId: params.sessionId,
          animalEmoji: params.animalEmoji,
          encounteredAt: Date.now(),
        }),
      }),
    [userId]
  )
}

export function useFetchAnimals(userId: string) {
  return useCallback(
    async (): Promise<AnimalEncounter[]> => {
      const res = await fetch(`/api/animals?user=${encodeURIComponent(userId)}`)
      return res.json()
    },
    [userId]
  )
}
