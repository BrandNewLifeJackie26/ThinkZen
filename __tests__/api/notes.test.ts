import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sqlite } from '@/db'
import { POST } from '@/app/api/notes/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: object) {
  return new Request('http://localhost/api/notes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

type NoteRow = {
  id: string
  user_id: string
  content: string
  created_at: number | null
}

function insertNote(note: NoteRow) {
  sqlite
    .prepare(
      'INSERT INTO thoughts (id, user_id, content, created_at) VALUES (?, ?, ?, ?)'
    )
    .run(note.id, note.user_id, note.content, note.created_at)
}

// ---------------------------------------------------------------------------
// DB setup — runs once per file against the :memory: DB
// ---------------------------------------------------------------------------

beforeAll(() => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS thoughts (
      id         TEXT    PRIMARY KEY,
      user_id    TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      created_at INTEGER,
      archived_at INTEGER
    )
  `)
})

beforeEach(() => {
  sqlite.exec('DELETE FROM thoughts')
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /notes', () => {
  // --- input validation ---

  it('returns 400 when user is missing', async () => {
    const res = await POST(makeRequest({ limit: 10 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when limit is missing', async () => {
    const res = await POST(makeRequest({ user: 'alice' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when limit is not a positive integer', async () => {
    const res = await POST(makeRequest({ user: 'alice', limit: 0 }))
    expect(res.status).toBe(400)
  })

  // --- happy path ---

  it('returns 200 with empty array when user has no notes', async () => {
    const res = await POST(makeRequest({ user: 'alice', limit: 10 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns only notes belonging to the requested user', async () => {
    insertNote({ id: 'a1', user_id: 'alice', content: 'alice note', created_at: 1000 })
    insertNote({ id: 'b1', user_id: 'bob',   content: 'bob note',   created_at: 2000 })

    const res = await POST(makeRequest({ user: 'alice', limit: 10 }))
    expect(res.status).toBe(200)

    const notes = await res.json()
    expect(notes).toHaveLength(1)
    expect(notes[0].id).toBe('a1')
  })

  it('respects the limit parameter', async () => {
    for (let i = 1; i <= 5; i++) {
      insertNote({ id: `n${i}`, user_id: 'alice', content: `note ${i}`, created_at: i * 1000 })
    }

    const res = await POST(makeRequest({ user: 'alice', limit: 3 }))
    expect(res.status).toBe(200)

    const notes = await res.json()
    expect(notes).toHaveLength(3)
  })

  it('returns notes ordered newest first (createdAt DESC)', async () => {
    insertNote({ id: 'old', user_id: 'alice', content: 'older', created_at: 1000 })
    insertNote({ id: 'new', user_id: 'alice', content: 'newer', created_at: 2000 })

    const res = await POST(makeRequest({ user: 'alice', limit: 10 }))
    const notes = await res.json()

    expect(notes[0].id).toBe('new')
    expect(notes[1].id).toBe('old')
  })

  // --- cursor pagination ---

  it('starts from the beginning when from is omitted', async () => {
    insertNote({ id: 'n1', user_id: 'alice', content: 'note 1', created_at: 1000 })
    insertNote({ id: 'n2', user_id: 'alice', content: 'note 2', created_at: 2000 })

    const res = await POST(makeRequest({ user: 'alice', limit: 10 }))
    const notes = await res.json()
    expect(notes).toHaveLength(2)
  })

  it('uses from as an exclusive cursor to return older notes', async () => {
    insertNote({ id: 'n1', user_id: 'alice', content: 'oldest', created_at: 1000 })
    insertNote({ id: 'n2', user_id: 'alice', content: 'middle', created_at: 2000 })
    insertNote({ id: 'n3', user_id: 'alice', content: 'newest', created_at: 3000 })

    // n3 is the cursor — we want the page after it (n2, n1)
    const res = await POST(makeRequest({ user: 'alice', from: 'n3', limit: 10 }))
    expect(res.status).toBe(200)

    const notes = await res.json()
    expect(notes.map((n: { id: string }) => n.id)).toEqual(['n2', 'n1'])
  })

  it('returns empty array when from cursor is the oldest note', async () => {
    insertNote({ id: 'n1', user_id: 'alice', content: 'only note', created_at: 1000 })

    const res = await POST(makeRequest({ user: 'alice', from: 'n1', limit: 10 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})
