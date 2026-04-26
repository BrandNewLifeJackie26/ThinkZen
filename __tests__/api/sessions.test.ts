import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { sqlite } from '@/db'
import { GET, POST } from '@/app/api/sessions/route'
import { PATCH } from '@/app/api/sessions/[id]/route'

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

function makePatchRequest(id: string, body: unknown) {
  return {
    req: new Request(`http://localhost/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx: { params: Promise.resolve({ id }) },
  }
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
      plannedDurationSeconds: 1500,
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.userId).toBe('alice')
    expect(body.intention).toBe('finish the report')
    expect(body.plannedDurationSeconds).toBe(1500)
    expect(body.endedAt).toBeNull()
    expect(body.id).toBeTruthy()
  })

  it('returns 400 when user is missing', async () => {
    const res = await POST(makePostRequest({ intention: 'work', plannedDurationSeconds: 1500 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'user is required' })
  })

  it('returns 400 when intention is missing', async () => {
    const res = await POST(makePostRequest({ user: 'alice', plannedDurationSeconds: 1500 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'intention is required' })
  })

  it('returns 400 when plannedDurationSeconds is missing', async () => {
    const res = await POST(makePostRequest({ user: 'alice', intention: 'work' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'plannedDurationSeconds must be a positive integer' })
  })

  it('returns 400 when plannedDurationSeconds is not a positive integer', async () => {
    const res = await POST(makePostRequest({ user: 'alice', intention: 'work', plannedDurationSeconds: -5 }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when user already has an active session', async () => {
    await POST(makePostRequest({ user: 'alice', intention: 'first', plannedDurationSeconds: 1500 }))
    const res = await POST(makePostRequest({ user: 'alice', intention: 'second', plannedDurationSeconds: 1500 }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'user already has an active session' })
  })

  it('allows a second session after the first is ended', async () => {
    await POST(makePostRequest({ user: 'alice', intention: 'first', plannedDurationSeconds: 1500 }))
    sqlite.exec("UPDATE sessions SET ended_at = unixepoch() WHERE user_id = 'alice'")
    const res = await POST(makePostRequest({ user: 'alice', intention: 'second', plannedDurationSeconds: 1500 }))
    expect(res.status).toBe(201)
  })
})

describe('GET /sessions', () => {
  it('returns empty array when no active session exists', async () => {
    const res = await GET(makeGetRequest({ user: 'alice' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns the active session', async () => {
    await POST(makePostRequest({ user: 'alice', intention: 'deep work', plannedDurationSeconds: 3000 }))
    const res = await GET(makeGetRequest({ user: 'alice' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].intention).toBe('deep work')
    expect(body[0].endedAt).toBeNull()
  })

  it('returns all unfinished sessions', async () => {
    sqlite.exec(`
      INSERT INTO sessions (id, user_id, intention, planned_duration_seconds, started_at)
      VALUES ('s1', 'alice', 'task one', 1500, unixepoch()),
             ('s2', 'alice', 'task two', 3000, unixepoch())
    `)
    const res = await GET(makeGetRequest({ user: 'alice' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
  })

  it('does not return ended sessions', async () => {
    await POST(makePostRequest({ user: 'alice', intention: 'old', plannedDurationSeconds: 1500 }))
    sqlite.exec("UPDATE sessions SET ended_at = unixepoch() WHERE user_id = 'alice'")
    const res = await GET(makeGetRequest({ user: 'alice' }))
    expect(await res.json()).toEqual([])
  })

  it('returns 400 when user is missing', async () => {
    const res = await GET(makeGetRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'user is required' })
  })

  it('does not return sessions belonging to other users', async () => {
    await POST(makePostRequest({ user: 'bob', intention: 'bob work', plannedDurationSeconds: 1500 }))
    const res = await GET(makeGetRequest({ user: 'alice' }))
    expect(await res.json()).toEqual([])
  })
})

describe('PATCH /sessions/:id', () => {
  it('stops an active session', async () => {
    const postRes = await POST(makePostRequest({ user: 'alice', intention: 'deep work', plannedDurationSeconds: 2700 }))
    const session = await postRes.json()

    const { req, ctx } = makePatchRequest(session.id, { user: 'alice', remainingSeconds: 1000, end: true })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.endedAt).not.toBeNull()
    expect(body.remainingSeconds).toBe(1000)
  })

  it('stops a session with a custom remainingSeconds when paused mid-session', async () => {
    const postRes = await POST(makePostRequest({ user: 'alice', intention: 'deep work', plannedDurationSeconds: 2700 }))
    const session = await postRes.json()

    const { req, ctx } = makePatchRequest(session.id, { user: 'alice', remainingSeconds: 1500 })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.remainingSeconds).toBe(1500)
  })

  it('returns 404 for an unknown session id', async () => {
    const { req, ctx } = makePatchRequest('nonexistent-id', { user: 'alice' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'session not found' })
  })

  it('returns 403 when user does not own the session', async () => {
    const postRes = await POST(makePostRequest({ user: 'alice', intention: 'work', plannedDurationSeconds: 1500 }))
    const session = await postRes.json()

    const { req, ctx } = makePatchRequest(session.id, { user: 'bob' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'forbidden' })
  })

  it('returns 409 when session is already ended', async () => {
    const postRes = await POST(makePostRequest({ user: 'alice', intention: 'work', plannedDurationSeconds: 1500 }))
    const session = await postRes.json()
    sqlite.exec(`UPDATE sessions SET ended_at = unixepoch() WHERE id = '${session.id}'`)

    const { req, ctx } = makePatchRequest(session.id, { user: 'alice' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'session already ended' })
  })

  it('returns 400 when user is missing', async () => {
    const { req, ctx } = makePatchRequest('some-id', {})
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'user is required' })
  })
})
