import { db } from '@/db'
import { thoughts } from '@/db/schema'
import { and, desc, eq, lt } from 'drizzle-orm'
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
  const from = searchParams.get('from')
  const limitRaw = searchParams.get('limit')
  const limit = limitRaw !== null ? Number(limitRaw) : NaN

  if (!user) {
    return json({ error: 'user is required' }, 400)
  }
  if (!limitRaw || isNaN(limit) || limit <= 0) {
    return json({ error: 'limit must be a positive integer' }, 400)
  }

  // If a cursor is provided, look up its createdAt to use as the pagination boundary
  let cursorCreatedAt: Date | null = null
  if (from) {
    const cursor = await db
      .select({ createdAt: thoughts.createdAt })
      .from(thoughts)
      .where(eq(thoughts.id, from))
      .limit(1)

    if (cursor.length === 0) {
      return json({ error: 'cursor thought not found' }, 400)
    }
    cursorCreatedAt = cursor[0].createdAt
  }

  const conditions = [eq(thoughts.userId, user)]
  if (cursorCreatedAt !== null) {
    conditions.push(lt(thoughts.createdAt, cursorCreatedAt))
  }

  const result = await db
    .select()
    .from(thoughts)
    .where(and(...conditions))
    .orderBy(desc(thoughts.createdAt))
    .limit(limit)

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

  const { user, timestamp, content, tags } = body as Record<string, unknown>

  if (!user || typeof user !== 'string') {
    return json({ error: 'user is required' }, 400)
  }
  if (!content || typeof content !== 'string') {
    return json({ error: 'content is required' }, 400)
  }
  if (timestamp === undefined || timestamp === null) {
    return json({ error: 'timestamp is required' }, 400)
  }

  const resolvedTags: string[] = Array.isArray(tags)
    ? tags.filter((t): t is string => typeof t === 'string')
    : []

  const inserted = await db
    .insert(thoughts)
    .values({
      id: randomUUID(),
      userId: user,
      content,
      createdAt: new Date(timestamp as number),
      tags: JSON.stringify(resolvedTags),
    })
    .returning()

  return json({ ...inserted[0], tags: resolvedTags }, 201)
}
