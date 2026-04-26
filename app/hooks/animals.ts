import { useCallback } from 'react'

export type AnimalEncounter = {
  id: string
  userId: string
  sessionId: string
  animalEmoji: string
  animalName: string
  encounteredAt: string
}

const STORAGE_KEY = 'thinkzen_animal_encounters'

function loadEncounters(): AnimalEncounter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveEncounters(encounters: AnimalEncounter[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encounters))
}

export function useRecordEncounter(userId: string) {
  return useCallback(
    (params: { sessionId: string; animalEmoji: string; animalName: string }) => {
      const encounters = loadEncounters()
      const already = encounters.some((e) => e.sessionId === params.sessionId)
      if (already) return
      encounters.unshift({
        id: crypto.randomUUID(),
        userId,
        sessionId: params.sessionId,
        animalEmoji: params.animalEmoji,
        animalName: params.animalName,
        encounteredAt: new Date().toISOString(),
      })
      saveEncounters(encounters)
    },
    [userId]
  )
}

export function useFetchAnimals(userId: string) {
  return useCallback((): AnimalEncounter[] => {
    return loadEncounters().filter((e) => e.userId === userId)
  }, [userId])
}
