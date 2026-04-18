import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { sqlite } from '@/db'
import { GET } from '@/app/api/thoughts/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string | number | undefined>) {
  const url = new URL('http://localhost/api/thoughts')
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return new Request(url)
}

type ThoughtRow = {
  id: string
  user_id: string
  content: string
  created_at: number | null
}

function insertThought(thought: ThoughtRow) {
  sqlite
    .prepare(
      'INSERT INTO thoughts (id, user_id, content, created_at) VALUES (?, ?, ?, ?)'
    )
    .run(thought.id, thought.user_id, thought.content, thought.created_at)
}

// ---------------------------------------------------------------------------
// DB setup — runs once per file against the :memory: DB
// ---------------------------------------------------------------------------

beforeAll(() => {
  const migration = readFileSync(resolve(__dirname, '../../drizzle/0000_neat_kulan_gath.sql'), 'utf-8')
  for (const statement of migration.split('--> statement-breakpoint')) {
    sqlite.exec(statement.trim())
  }
})

beforeEach(() => {
  sqlite.exec('DELETE FROM thoughts')
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /thoughts', () => {
  // --- input validation ---

  it('returns 400 when user is missing', async () => {
    const res = await GET(makeRequest({ limit: 10 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when limit is missing', async () => {
    const res = await GET(makeRequest({ user: 'alice' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when limit is not a positive integer', async () => {
    const res = await GET(makeRequest({ user: 'alice', limit: 0 }))
    expect(res.status).toBe(400)
  })

  // --- happy path ---

  it('returns 200 with empty array when user has no thoughts', async () => {
    const res = await GET(makeRequest({ user: 'alice', limit: 10 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns only thoughts belonging to the requested user', async () => {
    insertThought({ id: 'a1', user_id: 'alice', content: 'alice thought', created_at: 1000 })
    insertThought({ id: 'b1', user_id: 'bob',   content: 'bob thought',   created_at: 2000 })

    const res = await GET(makeRequest({ user: 'alice', limit: 10 }))
    expect(res.status).toBe(200)

    const thoughts = await res.json()
    expect(thoughts).toHaveLength(1)
    expect(thoughts[0].id).toBe('a1')
  })

  it('respects the limit parameter', async () => {
    for (let i = 1; i <= 5; i++) {
      insertThought({ id: `n${i}`, user_id: 'alice', content: `thought ${i}`, created_at: i * 1000 })
    }

    const res = await GET(makeRequest({ user: 'alice', limit: 3 }))
    expect(res.status).toBe(200)

    const thoughts = await res.json()
    expect(thoughts).toHaveLength(3)
  })

  it('returns thoughts ordered newest first (createdAt DESC)', async () => {
    insertThought({ id: 'old', user_id: 'alice', content: 'older', created_at: 1000 })
    insertThought({ id: 'new', user_id: 'alice', content: 'newer', created_at: 2000 })

    const res = await GET(makeRequest({ user: 'alice', limit: 10 }))
    const thoughts = await res.json()

    expect(thoughts[0].id).toBe('new')
    expect(thoughts[1].id).toBe('old')
  })

  // --- cursor pagination ---

  it('starts from the beginning when from is omitted', async () => {
    insertThought({ id: 'n1', user_id: 'alice', content: 'thought 1', created_at: 1000 })
    insertThought({ id: 'n2', user_id: 'alice', content: 'thought 2', created_at: 2000 })

    const res = await GET(makeRequest({ user: 'alice', limit: 10 }))
    const thoughts = await res.json()
    expect(thoughts).toHaveLength(2)
  })

  it('uses from as an exclusive cursor to return older thoughts', async () => {
    insertThought({ id: 'n1', user_id: 'alice', content: 'oldest', created_at: 1000 })
    insertThought({ id: 'n2', user_id: 'alice', content: 'middle', created_at: 2000 })
    insertThought({ id: 'n3', user_id: 'alice', content: 'newest', created_at: 3000 })

    // n3 is the cursor — we want the page after it (n2, n1)
    const res = await GET(makeRequest({ user: 'alice', from: 'n3', limit: 10 }))
    expect(res.status).toBe(200)

    const thoughts = await res.json()
    expect(thoughts.map((n: { id: string }) => n.id)).toEqual(['n2', 'n1'])
  })

  it('returns empty array when from cursor is the oldest thought', async () => {
    insertThought({ id: 'n1', user_id: 'alice', content: 'only thought', created_at: 1000 })

    const res = await GET(makeRequest({ user: 'alice', from: 'n1', limit: 10 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})
