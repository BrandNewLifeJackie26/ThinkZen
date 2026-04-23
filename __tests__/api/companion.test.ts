import { describe, expect, it, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/companion/message/route'

const { mockGenerateText, mockStreamText } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockStreamText: vi.fn(),
}))

vi.mock('ai', () => ({
  generateText: mockGenerateText,
  streamText: mockStreamText,
  Output: {
    object: vi.fn(() => ({ _tag: 'object-output' })),
  },
}))

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'mock-model'),
}))

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/companion/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/companion/message — routing', () => {
  it('returns 400 for an invalid trigger', async () => {
    const res = await POST(makeRequest({ trigger: 'unknown', intention: 'work', durationSeconds: 1500 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: /trigger must be/ })
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/companion/message', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid JSON body' })
  })

  it('returns 400 when body is not an object', async () => {
    const res = await POST(makeRequest('just a string'))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'body must be an object' })
  })
})

describe('planning trigger', () => {
  it('returns AI output on success', async () => {
    const aiOutput = { guidance: 'Looks good', shouldSplit: false }
    mockGenerateText.mockResolvedValue({ output: aiOutput })

    const res = await POST(makeRequest({ trigger: 'planning', intention: 'write report', durationSeconds: 1500 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(aiOutput)
    expect(mockGenerateText).toHaveBeenCalledOnce()
  })

  it('returns 400 when intention is missing', async () => {
    const res = await POST(makeRequest({ trigger: 'planning', durationSeconds: 1500 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'intention is required' })
  })

  it('returns 400 when durationSeconds is missing', async () => {
    const res = await POST(makeRequest({ trigger: 'planning', intention: 'work' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'durationSeconds must be a positive number' })
  })

  it('returns 400 when durationSeconds is not positive', async () => {
    const res = await POST(makeRequest({ trigger: 'planning', intention: 'work', durationSeconds: -1 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'durationSeconds must be a positive number' })
  })
})

describe('session_start trigger', () => {
  it('returns AI output on success', async () => {
    const aiOutput = {
      companionTask: 'reviewing code',
      subtasks: ['read PR', 'run tests'],
      icon: '🦊',
      tone: 'focused',
      message: "Let's get started!",
    }
    mockGenerateText.mockResolvedValue({ output: aiOutput })

    const res = await POST(makeRequest({ trigger: 'session_start', intention: 'write tests', durationSeconds: 1500 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(aiOutput)
    expect(mockGenerateText).toHaveBeenCalledOnce()
  })

  it('returns 400 when intention is missing', async () => {
    const res = await POST(makeRequest({ trigger: 'session_start', durationSeconds: 1500 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'intention is required' })
  })

  it('returns 400 when durationSeconds is zero', async () => {
    const res = await POST(makeRequest({ trigger: 'session_start', intention: 'work', durationSeconds: 0 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'durationSeconds must be a positive number' })
  })
})

describe('ambient trigger', () => {
  it('returns a stream response on success', async () => {
    const mockStreamResponse = new Response('hello world', { status: 200 })
    mockStreamText.mockReturnValue({ toTextStreamResponse: () => mockStreamResponse })

    const res = await POST(makeRequest({
      trigger: 'ambient',
      intention: 'deep work',
      durationSeconds: 1500,
      companionContext: { companionTask: 'reviewing notes', elapsedSeconds: 600 },
    }))
    expect(res.status).toBe(200)
    expect(mockStreamText).toHaveBeenCalledOnce()
  })

  it('returns 400 when intention is missing', async () => {
    const res = await POST(makeRequest({ trigger: 'ambient', durationSeconds: 1500 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'intention is required' })
  })

  it('returns 400 when durationSeconds is missing', async () => {
    const res = await POST(makeRequest({ trigger: 'ambient', intention: 'work' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'durationSeconds must be a positive number' })
  })
})

describe('session_end trigger', () => {
  it('returns a stream response on success', async () => {
    const mockStreamResponse = new Response('wrap up text', { status: 200 })
    mockStreamText.mockReturnValue({ toTextStreamResponse: () => mockStreamResponse })

    const res = await POST(makeRequest({
      trigger: 'session_end',
      intention: 'write tests',
      durationSeconds: 1500,
      companionContext: { companionTask: 'reviewing notes', elapsedSeconds: 0 },
    }))
    expect(res.status).toBe(200)
    expect(mockStreamText).toHaveBeenCalledOnce()
  })

  it('returns 400 when intention is missing', async () => {
    const res = await POST(makeRequest({ trigger: 'session_end', durationSeconds: 1500 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'intention is required' })
  })

  it('returns 400 when durationSeconds is not a number', async () => {
    const res = await POST(makeRequest({ trigger: 'session_end', intention: 'work', durationSeconds: 'long' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'durationSeconds must be a positive number' })
  })
})
