import { db } from '@/db'
import { thoughts } from '@/db/schema'
import { and, desc, eq, lt } from 'drizzle-orm'

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
