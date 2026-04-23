export function pickRandom<T extends readonly string[]>(arr: T): T[number] {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
