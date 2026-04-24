import { z } from 'zod'

// ─── Personality ───────────────────────────────────────────────────────────────

const PERSONALITY = `
You are a warm, focused co-worker sitting alongside the user during their focus session.
Your energy is calm and present — never performative, never punishing.
You treat the user as capable. You celebrate showing up, not perfection.
Keep all messages short (1–2 sentences max). Sound human, not like a chatbot.
`.trim()

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const planningSchema = z.object({
  guidance: z.string().describe('Brief coaching note on task scope or time fit (1 sentence)'),
  suggestedDuration: z
    .number()
    .optional()
    .describe('Suggested duration in minutes if the current one seems off (must be positive)'),
  shouldSplit: z
    .boolean()
    .optional()
    .describe('True if the task seems too large and splitting is recommended'),
})

export const sessionStartSchema = z.object({
  companionTask: z
    .string()
    .describe('What the companion is working on — a realistic, specific task (5–8 words)'),
  subtasks: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe('Ordered list of sub-steps the companion will move through during the session'),
  icon: z
    .string()
    .describe(
      'A single animal or creature emoji that serves as the companion\'s avatar (e.g. 🦊 🐨 🦋 🦁 🐸 🦉 🐺 🦝 🐧 🦅)',
    ),
  tone: z
    .enum(['focused', 'energetic', 'calm', 'playful', 'steady'])
    .describe('The companion\'s emotional register for this session'),
  message: z
    .string()
    .describe('Companion\'s opening line acknowledging the user\'s intention (1 sentence, warm)'),
})

// ─── Prompt builders ───────────────────────────────────────────────────────────

export function buildPlanningPrompt(intention: string, durationSeconds: number): string {
  const durationMin = Math.round(durationSeconds / 60)
  return `${PERSONALITY}

The user is about to start a focus session.
Intention: "${intention}"
Planned duration: ${durationMin} minutes

Evaluate whether this task is well-scoped for the time available.
- If it's too large, say so gently and suggest a better duration or recommend splitting.
- If it's too vague, nudge them to be more specific.
- If it looks good, still give a brief encouraging note.

Respond with JSON matching the schema.`
}

export function buildSessionStartPrompt(intention: string, durationSeconds: number): string {
  const durationMin = Math.round(durationSeconds / 60)
  return `${PERSONALITY}

The user just started a ${durationMin}-minute focus session.
Their intention: "${intention}"

Pick a parallel task for yourself that:
- Is realistic and specific (not generic like "organizing ideas")
- Has 2–4 meaningful sub-steps that could fill ${durationMin} minutes
- Feels like real, grounded work (reading, writing, reviewing, planning something concrete)
- Complements the user's energy without copying their task

Also choose an icon and tone that fit the session's mood.
Write a warm one-sentence opening message acknowledging what the user is about to do.

Respond with JSON matching the schema.`
}

export function buildAmbientPrompt(
  intention: string,
  companionTask: string,
  elapsedSeconds: number,
): string {
  const elapsedMin = Math.round(elapsedSeconds / 60)
  return `${PERSONALITY}

The user has been working for ${elapsedMin} minutes on: "${intention}"
You've been working on: "${companionTask}"

Send a brief, genuine check-in — not a prompt, just presence.
One sentence. Don't ask questions. Acknowledge the time passing or offer quiet encouragement.
Sound like a co-worker glancing up from their screen.`
}

export function buildWrapUpPrompt(intention: string, companionTask: string): string {
  return `${PERSONALITY}

The user just finished a focus session working on: "${intention}"
You were working on: "${companionTask}"

Write a warm one-sentence closing message. Celebrate that they showed up and did the work.
Vary your phrasing — avoid clichés like "great job" or "well done". Sound genuine.`
}
