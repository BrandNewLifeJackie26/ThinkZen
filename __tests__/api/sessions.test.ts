import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { sqlite } from '@/db'
import { GET, POST } from '@/app/api/sessions/route'

function makeGetRequest(params: Record<string, string | undefined>) {
  const url = new URL('http://localhost/api/sessions')
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value)
  }
  return new Request(url)
}

function makePostRequest(body: unknown) {
  return new Request('http://localhost/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

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
  sqlite.exec('DELETE FROM sessions')
})

describe('POST /sessions', () => {
  it('creates a session and returns 201', async () => {
    const res = await POST(makePostRequest({
      user: 'alice',
      intention: 'finish the report',
      plannedDurationMinutes: 25,
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.userId).toBe('alice')
    expect(body.intention).toBe('finish the report')
    expect(body.plannedDurationMinutes).toBe(25)
    expect(body.endedAt).toBeNull()
    expect(body.id).toBeTruthy()
  })

  it('returns 400 when user is missing', async () => {
    const res = await POST(makePostRequest({ intention: 'work', plannedDurationMinutes: 25 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'user is required' })
  })

  it('returns 400 when intention is missing', async () => {
    const res = await POST(makePostRequest({ user: 'alice', plannedDurationMinutes: 25 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'intention is required' })
  })

  it('returns 400 when plannedDurationMinutes is missing', async () => {
    const res = await POST(makePostRequest({ user: 'alice', intention: 'work' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'plannedDurationMinutes must be a positive integer' })
  })

  it('returns 400 when plannedDurationMinutes is not a positive integer', async () => {
    const res = await POST(makePostRequest({ user: 'alice', intention: 'work', plannedDurationMinutes: -5 }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when user already has an active session', async () => {
    await POST(makePostRequest({ user: 'alice', intention: 'first', plannedDurationMinutes: 25 }))
    const res = await POST(makePostRequest({ user: 'alice', intention: 'second', plannedDurationMinutes: 25 }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'user already has an active session' })
  })

  it('allows a second session after the first is ended', async () => {
    await POST(makePostRequest({ user: 'alice', intention: 'first', plannedDurationMinutes: 25 }))
    sqlite.exec("UPDATE sessions SET ended_at = unixepoch() WHERE user_id = 'alice'")
    const res = await POST(makePostRequest({ user: 'alice', intention: 'second', plannedDurationMinutes: 25 }))
    expect(res.status).toBe(201)
  })
})

describe('GET /sessions', () => {
  it('returns null when no active session exists', async () => {
    const res = await GET(makeGetRequest({ user: 'alice' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('returns the active session', async () => {
    await POST(makePostRequest({ user: 'alice', intention: 'deep work', plannedDurationMinutes: 50 }))
    const res = await GET(makeGetRequest({ user: 'alice' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.intention).toBe('deep work')
    expect(body.endedAt).toBeNull()
  })

  it('does not return ended sessions', async () => {
    await POST(makePostRequest({ user: 'alice', intention: 'old', plannedDurationMinutes: 25 }))
    sqlite.exec("UPDATE sessions SET ended_at = unixepoch() WHERE user_id = 'alice'")
    const res = await GET(makeGetRequest({ user: 'alice' }))
    expect(await res.json()).toBeNull()
  })

  it('returns 400 when user is missing', async () => {
    const res = await GET(makeGetRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'user is required' })
  })

  it('does not return sessions belonging to other users', async () => {
    await POST(makePostRequest({ user: 'bob', intention: 'bob work', plannedDurationMinutes: 25 }))
    const res = await GET(makeGetRequest({ user: 'alice' }))
    expect(await res.json()).toBeNull()
  })
})
