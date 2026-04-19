import { db } from '@/db'
import { sessions } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const user = searchParams.get('user')

  if (!user) {
    return json({ error: 'user is required' }, 400)
  }

  const result = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, user), isNull(sessions.endedAt)))
    .limit(1)

  return json(result[0] ?? null)
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

  const { user, intention, plannedDurationMinutes } = body as Record<string, unknown>

  if (!user || typeof user !== 'string') {
    return json({ error: 'user is required' }, 400)
  }
  if (!intention || typeof intention !== 'string') {
    return json({ error: 'intention is required' }, 400)
  }
  if (
    plannedDurationMinutes === undefined ||
    typeof plannedDurationMinutes !== 'number' ||
    !Number.isInteger(plannedDurationMinutes) ||
    plannedDurationMinutes <= 0
  ) {
    return json({ error: 'plannedDurationMinutes must be a positive integer' }, 400)
  }

  const existing = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, user), isNull(sessions.endedAt)))
    .limit(1)

  if (existing.length > 0) {
    return json({ error: 'user already has an active session' }, 409)
  }

  const [inserted] = await db
    .insert(sessions)
    .values({
      id: randomUUID(),
      userId: user,
      intention,
      plannedDurationMinutes,
      startedAt: new Date(),
    })
    .returning()

  return json(inserted, 201)
}
