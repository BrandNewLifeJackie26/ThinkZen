import type { Tone } from '@/app/hooks/companion'

export type PausedSnapshot = {
  sessionId: string
  intention: string
  companionTask: string
  subtasks: string[]
  icon: string
  tone: Tone
  currentSubtaskIdx: number
  remainingSeconds: number
  durationSeconds: number
}

export type CompanionPhase =
  | { phase: 'inactive' }
  | { phase: 'planning'; companionTask: string }
  | {
      phase: 'active'
      sessionId: string
      intention: string
      companionTask: string
      subtasks: string[]
      icon: string
      tone: Tone
      currentSubtaskIdx: number
      remainingSeconds: number
      durationSeconds: number
    }
  | {
      phase: 'paused'
      sessionId: string
      intention: string
      companionTask: string
      subtasks: string[]
      icon: string
      tone: Tone
      currentSubtaskIdx: number
      remainingSeconds: number
      durationSeconds: number
    }
  | { phase: 'switching'; prior?: PausedSnapshot }
  | {
      phase: 'wrapping'
      sessionId: string
      intention: string
      companionTask: string
      subtasks: string[]
      icon: string
      tone: Tone
      remainingSeconds: number
      durationSeconds: number
    }
