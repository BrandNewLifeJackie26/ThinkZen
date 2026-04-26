import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { sqlite } from '@/db'
import { GET, POST } from '@/app/api/animals/route'

function makeGetRequest(params: Record<string, string | undefined>) {
  const url = new URL('http://localhost/api/animals')
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value)
  }
  return new Request(url)
}

function makePostRequest(body: unknown) {
  return new Request('http://localhost/api/animals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const NOW = Date.now()

beforeAll(() => {
  const migrationsDir = resolve(__dirname, '../../drizzle')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf-8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()
      if (trimmed) sqlite.exec(trimmed)
    }
  }
})

beforeEach(() => {
  sqlite.exec('DELETE FROM animal_encounters')
})

describe('POST /animals', () => {
  it('creates an encounter and returns 201', async () => {
    const res = await POST(makePostRequest({
      userId: 'alice',
      sessionId: 'session-1',
      animalEmoji: '🦊',
      encounteredAt: NOW,
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.userId).toBe('alice')
    expect(body.sessionId).toBe('session-1')
    expect(body.animalEmoji).toBe('🦊')
    expect(body.id).toBeTruthy()
    expect(body.encounteredAt).toBeTruthy()
  })

  it('returns 400 when userId is missing', async () => {
    const res = await POST(makePostRequest({ sessionId: 's1', animalEmoji: '🦊', encounteredAt: NOW }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'userId is required' })
  })

  it('returns 400 when sessionId is missing', async () => {
    const res = await POST(makePostRequest({ userId: 'alice', animalEmoji: '🦊', encounteredAt: NOW }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'sessionId is required' })
  })

  it('returns 400 when animalEmoji is missing', async () => {
    const res = await POST(makePostRequest({ userId: 'alice', sessionId: 's1', encounteredAt: NOW }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'animalEmoji is required' })
  })

  it('returns 400 when encounteredAt is missing', async () => {
    const res = await POST(makePostRequest({ userId: 'alice', sessionId: 's1', animalEmoji: '🦊' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'encounteredAt must be a valid unix timestamp' })
  })

  it('returns 400 when encounteredAt is not a number', async () => {
    const res = await POST(makePostRequest({ userId: 'alice', sessionId: 's1', animalEmoji: '🦊', encounteredAt: 'now' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'encounteredAt must be a valid unix timestamp' })
  })

  it('allows multiple encounters for the same user', async () => {
    await POST(makePostRequest({ userId: 'alice', sessionId: 's1', animalEmoji: '🦊', encounteredAt: NOW }))
    const res = await POST(makePostRequest({ userId: 'alice', sessionId: 's2', animalEmoji: '🐨', encounteredAt: NOW + 1000 }))
    expect(res.status).toBe(201)
  })
})

describe('GET /animals', () => {
  it('returns empty array when user has no encounters', async () => {
    const res = await GET(makeGetRequest({ user: 'alice' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns all encounters for a user', async () => {
    await POST(makePostRequest({ userId: 'alice', sessionId: 's1', animalEmoji: '🦊', encounteredAt: NOW }))
    await POST(makePostRequest({ userId: 'alice', sessionId: 's2', animalEmoji: '🐨', encounteredAt: NOW + 1000 }))
    const res = await GET(makeGetRequest({ user: 'alice' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
  })

  it('does not return encounters belonging to other users', async () => {
    await POST(makePostRequest({ userId: 'bob', sessionId: 's1', animalEmoji: '🦁', encounteredAt: NOW }))
    const res = await GET(makeGetRequest({ user: 'alice' }))
    expect(await res.json()).toEqual([])
  })

  it('returns 400 when user is missing', async () => {
    const res = await GET(makeGetRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'user is required' })
  })

  it('returns encounters ordered by encounteredAt ascending', async () => {
    sqlite.exec(`
      INSERT INTO animal_encounters (id, user_id, session_id, animal_emoji, encountered_at)
      VALUES ('e1', 'alice', 's1', '🦊', 1000),
             ('e2', 'alice', 's2', '🐨', 2000),
             ('e3', 'alice', 's3', '🦋', 500)
    `)
    const res = await GET(makeGetRequest({ user: 'alice' }))
    const body = await res.json()
    expect(body).toHaveLength(3)
    expect(body[0].animalEmoji).toBe('🦋')
    expect(body[1].animalEmoji).toBe('🦊')
    expect(body[2].animalEmoji).toBe('🐨')
  })
})
