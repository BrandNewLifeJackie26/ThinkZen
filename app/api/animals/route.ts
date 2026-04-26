import { db } from '@/db'
import { animalEncounters } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { json } from '@/app/api/utils'

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const user = searchParams.get('user')

  if (!user) {
    return json({ error: 'user is required' }, 400)
  }

  const result = await db
    .select()
    .from(animalEncounters)
    .where(eq(animalEncounters.userId, user))
    .orderBy(animalEncounters.encounteredAt)

  return json(result)
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  if (typeof body !== 'object' || body === null) {
    return json({ error: 'body must be an object' }, 400)
  }

  const { userId, sessionId, animalEmoji, animalName } = body as Record<string, unknown>

  if (!userId || typeof userId !== 'string') {
    return json({ error: 'userId is required' }, 400)
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return json({ error: 'sessionId is required' }, 400)
  }
  if (!animalEmoji || typeof animalEmoji !== 'string') {
    return json({ error: 'animalEmoji is required' }, 400)
  }
  if (!animalName || typeof animalName !== 'string') {
    return json({ error: 'animalName is required' }, 400)
  }

  const [inserted] = await db
    .insert(animalEncounters)
    .values({
      id: randomUUID(),
      userId,
      sessionId,
      animalEmoji,
      animalName,
      encounteredAt: new Date(),
    })
    .returning()

  return json(inserted, 201)
}
