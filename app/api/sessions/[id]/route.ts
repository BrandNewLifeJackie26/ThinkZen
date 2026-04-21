import { db } from '@/db'
import { sessions } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { json } from '@/app/api/utils'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  if (typeof body !== 'object' || body === null) {
    return json({ error: 'body must be an object' }, 400)
  }

  const { user, remainingSeconds } = body as Record<string, unknown>

  if (!user || typeof user !== 'string') {
    return json({ error: 'user is required' }, 400)
  }

  if (
    remainingSeconds !== undefined &&
    (typeof remainingSeconds !== 'number' || !Number.isInteger(remainingSeconds) || remainingSeconds < 0)
  ) {
    return json({ error: 'remainingSeconds must be a non-negative integer' }, 400)
  }

  const results = await db.select().from(sessions).where(eq(sessions.id, id))

  if (results.length > 1) {
    return json({ error: 'internal error: duplicate session id' }, 500)
  }

  const session = results[0]

  if (!session) {
    return json({ error: 'session not found' }, 404)
  }

  if (session.userId !== user) {
    return json({ error: 'forbidden' }, 403)
  }

  if (session.endedAt !== null) {
    return json({ error: 'session already ended' }, 409)
  }

  const resolvedRemainingSeconds =
    remainingSeconds !== undefined
      ? (remainingSeconds as number)
      : session.plannedDurationSeconds

  const [updated] = await db
    .update(sessions)
    .set({ endedAt: new Date(), remainingSeconds: resolvedRemainingSeconds })
    .where(and(eq(sessions.id, id), isNull(sessions.endedAt)))
    .returning()

  return json(updated)
}
