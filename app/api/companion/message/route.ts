import { anthropic } from '@ai-sdk/anthropic'
import { generateObject, streamText } from 'ai'
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

type RequestBody = {
  trigger: 'planning' | 'session_start' | 'ambient' | 'session_end'
  intention: string
  durationSeconds: number
  companionContext?: {
    companionTask: string
    elapsedSeconds: number
  }
}

function validateBody(body: unknown): { data: RequestBody } | { error: string; status: number } {
  if (typeof body !== 'object' || body === null) {
    return { error: 'body must be an object', status: 400 }
  }
  const { trigger, intention, durationSeconds } = body as Record<string, unknown>

  if (!['planning', 'session_start', 'ambient', 'session_end'].includes(trigger as string)) {
    return { error: 'trigger must be planning | session_start | ambient | session_end', status: 400 }
  }
  if (!intention || typeof intention !== 'string') {
    return { error: 'intention is required', status: 400 }
  }
  if (typeof durationSeconds !== 'number' || durationSeconds <= 0) {
    return { error: 'durationSeconds must be a positive number', status: 400 }
  }
  return { data: body as RequestBody }
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const validated = validateBody(body)
  if ('error' in validated) return json({ error: validated.error }, validated.status)
  const { trigger, intention, durationSeconds, companionContext } = validated.data

  if (trigger === 'planning') {
    const prompt = buildPlanningPrompt(intention, durationSeconds)
    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema: planningSchema,
      prompt,
    })
    return json(object)
  }

  if (trigger === 'session_start') {
    const prompt = buildSessionStartPrompt(intention, durationSeconds)
    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema: sessionStartSchema,
      prompt,
    })
    return json(object)
  }

  // ambient and session_end — streaming text responses
  const prompt =
    trigger === 'ambient'
      ? buildAmbientPrompt(
          intention,
          companionContext?.companionTask ?? '',
          companionContext?.elapsedSeconds ?? 0,
        )
      : buildWrapUpPrompt(intention, companionContext?.companionTask ?? '')

  const result = streamText({ model: anthropic(MODEL), prompt })
  return result.toTextStreamResponse()
}
