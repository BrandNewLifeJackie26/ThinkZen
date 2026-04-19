import { db } from '@/db'
import { thoughts } from '@/db/schema'
import { and, desc, eq, lt } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { json } from '@/app/api/utils'

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

type ThoughtInput = {
  user: string
  timestamp: number
  content: string
  tags?: string[]
}

function validateThought(item: unknown, index: number): { error: string } | ThoughtInput {
  if (typeof item !== 'object' || item === null) {
    return { error: `item at index ${index} must be an object` }
  }
  const { user, timestamp, content, tags } = item as Record<string, unknown>
  if (!user || typeof user !== 'string') {
    return { error: `item at index ${index}: user is required` }
  }
  if (!content || typeof content !== 'string') {
    return { error: `item at index ${index}: content is required` }
  }
  if (timestamp === undefined || timestamp === null) {
    return { error: `item at index ${index}: timestamp is required` }
  }
  return {
    user,
    timestamp: timestamp as number,
    content,
    tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [],
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  if (!Array.isArray(body)) {
    return json({ error: 'body must be an array of thoughts' }, 400)
  }

  const inputs: ThoughtInput[] = []
  for (let i = 0; i < body.length; i++) {
    const result = validateThought(body[i], i)
    if ('error' in result) return json(result, 400)
    inputs.push(result)
  }

  const inserted = await db
    .insert(thoughts)
    .values(inputs.map(({ user, timestamp, content, tags }) => ({
      id: randomUUID(),
      userId: user,
      content,
      createdAt: new Date(timestamp),
      tags: JSON.stringify(tags ?? []),
    })))
    .returning()

  const result = inserted.map((row, i) => ({ ...row, tags: inputs[i].tags ?? [] }))
  return json(result, 201)
}
