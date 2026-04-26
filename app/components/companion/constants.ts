import type { Tone } from '@/app/hooks/companion'

export const COMPANION_TASKS = [
  'reviewing my notes',
  'organizing ideas',
  'planning my schedule',
  'clearing my backlog',
  'thinking through priorities',
] as const

export const DEFAULT_DURATION_MINUTES = 25
export const WRAP_UP_DELAY_MS = 2000
export const ENCOUNTER_CELEBRATION_MS = 5000
export const AMBIENT_TRIGGER_SECONDS = 1200 // 20 min

export const TONE_STYLES: Record<Tone, { bg: string; text: string }> = {
  focused: { bg: 'bg-gray-100', text: 'text-gray-600' },
  energetic: { bg: 'bg-orange-100', text: 'text-orange-600' },
  calm: { bg: 'bg-blue-100', text: 'text-blue-600' },
  playful: { bg: 'bg-purple-100', text: 'text-purple-600' },
  steady: { bg: 'bg-green-100', text: 'text-green-600' },
}

export const ANIMAL_NAMES: Record<string, string> = {
  '🐧': 'Penguin',
  '🦊': 'Fox',
  '🐺': 'Wolf',
  '🦁': 'Lion',
  '🐯': 'Tiger',
  '🐻': 'Bear',
  '🐼': 'Panda',
  '🐨': 'Koala',
  '🦝': 'Raccoon',
  '🦔': 'Hedgehog',
  '🐰': 'Bunny',
  '🐱': 'Cat',
  '🐶': 'Dog',
  '🦄': 'Unicorn',
  '🐸': 'Frog',
  '🦉': 'Owl',
  '🦋': 'Butterfly',
  '🐢': 'Turtle',
  '🐙': 'Octopus',
  '🦜': 'Parrot',
  '🐬': 'Dolphin',
  '🦭': 'Seal',
  '🐘': 'Elephant',
  '🦒': 'Giraffe',
  '🦓': 'Zebra',
}

export const ANIMAL_EMOJIS = Object.keys(ANIMAL_NAMES)

export function getAnimalName(emoji: string): string {
  return ANIMAL_NAMES[emoji] ?? 'Mystery Creature'
}
