import { anthropic } from '@ai-sdk/anthropic'
import { generateText, streamText, Output } from 'ai'
import { json } from '@/app/api/utils'
import {
  buildPlanningPrompt,
  buildSessionStartPrompt,
  buildAmbientPrompt,
  buildWrapUpPrompt,
  planningSchema,
  sessionStartSchema,
} from '@/lib/companion-prompt'

const MODEL = 'claude-haiku-4-5-20251001'

async function handlePlanning(body: Record<string, unknown>): Promise<Response> {
  const { intention, durationSeconds } = body
  if (!intention || typeof intention !== 'string') {
    return json({ error: 'intention is required' }, 400)
  }
  if (typeof durationSeconds !== 'number' || durationSeconds <= 0) {
    return json({ error: 'durationSeconds must be a positive number' }, 400)
  }
  const { output } = await generateText({
    model: anthropic(MODEL),
    output: Output.object({ schema: planningSchema }),
    prompt: buildPlanningPrompt(intention, durationSeconds),
  })
  return json(output)
}

async function handleSessionStart(body: Record<string, unknown>): Promise<Response> {
  const { intention, durationSeconds } = body
  if (!intention || typeof intention !== 'string') {
    return json({ error: 'intention is required' }, 400)
  }
  if (typeof durationSeconds !== 'number' || durationSeconds <= 0) {
    return json({ error: 'durationSeconds must be a positive number' }, 400)
  }
  const { output } = await generateText({
    model: anthropic(MODEL),
    output: Output.object({ schema: sessionStartSchema }),
    prompt: buildSessionStartPrompt(intention, durationSeconds),
  })
  return json(output)
}

async function handleAmbient(body: Record<string, unknown>): Promise<Response> {
  const { intention, durationSeconds, companionContext } = body
  if (!intention || typeof intention !== 'string') {
    return json({ error: 'intention is required' }, 400)
  }
  if (typeof durationSeconds !== 'number' || durationSeconds <= 0) {
    return json({ error: 'durationSeconds must be a positive number' }, 400)
  }
  const ctx = companionContext as { companionTask?: string; elapsedSeconds?: number } | undefined
  const result = streamText({
    model: anthropic(MODEL),
    prompt: buildAmbientPrompt(intention, ctx?.companionTask ?? '', ctx?.elapsedSeconds ?? 0),
  })
  return result.toTextStreamResponse()
}

async function handleSessionEnd(body: Record<string, unknown>): Promise<Response> {
  const { intention, durationSeconds, companionContext } = body
  if (!intention || typeof intention !== 'string') {
    return json({ error: 'intention is required' }, 400)
  }
  if (typeof durationSeconds !== 'number' || durationSeconds <= 0) {
    return json({ error: 'durationSeconds must be a positive number' }, 400)
  }
  const ctx = companionContext as { companionTask?: string } | undefined
  const result = streamText({
    model: anthropic(MODEL),
    prompt: buildWrapUpPrompt(intention, ctx?.companionTask ?? ''),
  })
  return result.toTextStreamResponse()
}

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>
  try {
    const parsed = await req.json()
    if (typeof parsed !== 'object' || parsed === null) {
      return json({ error: 'body must be an object' }, 400)
    }
    body = parsed as Record<string, unknown>
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  switch (body.trigger) {
    case 'planning':     return handlePlanning(body)
    case 'session_start': return handleSessionStart(body)
    case 'ambient':      return handleAmbient(body)
    case 'session_end':  return handleSessionEnd(body)
    default:
      return json({ error: 'trigger must be planning | session_start | ambient | session_end' }, 400)
  }
}
