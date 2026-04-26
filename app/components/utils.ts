export function pickRandom<T extends readonly string[]>(arr: T): T[number] {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export type AnimalGroup = {
  animalEmoji: string
  animalName: string
  count: number
  lastEncounteredAt: string
}

export function groupEncounters(
  encounters: { animalEmoji: string; animalName: string; encounteredAt: string | number | Date }[]
): AnimalGroup[] {
  const map = new Map<string, AnimalGroup>()
  for (const e of encounters) {
    const iso = new Date(e.encounteredAt).toISOString()
    const existing = map.get(e.animalEmoji)
    if (existing) {
      existing.count += 1
      if (iso > existing.lastEncounteredAt) existing.lastEncounteredAt = iso
    } else {
      map.set(e.animalEmoji, {
        animalEmoji: e.animalEmoji,
        animalName: e.animalName,
        count: 1,
        lastEncounteredAt: iso,
      })
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastEncounteredAt).getTime() - new Date(a.lastEncounteredAt).getTime()
  )
}

export function formatEncounterDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export async function readStream(
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
