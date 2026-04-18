'use client'

import { useState, useRef } from 'react'
import TagChip from './TagChip'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerializedThought {
  id: string
  userId: string
  content: string
  createdAt: string
  archivedAt: string | null
  tags: string[]
}

type PanelState = null | 'new' | SerializedThought

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_USER = 'demo'
const PAGE_SIZE = 20

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return []
}

function normalizeThoughts(raw: SerializedThought[]): SerializedThought[] {
  return raw.map(t => ({ ...t, tags: parseTags(t.tags) }))
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchThoughts(from?: string): Promise<SerializedThought[]> {
  const params = new URLSearchParams({ user: CURRENT_USER, limit: String(PAGE_SIZE) })
  if (from) params.set('from', from)
  const res = await fetch(`/api/thoughts?${params}`)
  return normalizeThoughts(await res.json())
}

async function saveThought(content: string, tags: string[]): Promise<void> {
  await fetch('/api/thoughts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ user: CURRENT_USER, timestamp: Date.now(), content, tags }]),
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ThoughtsClient({ initialThoughts }: { initialThoughts: SerializedThought[] }) {
  // List state
  const [thoughts, setThoughts] = useState<SerializedThought[]>(initialThoughts)
  const [hasMore, setHasMore] = useState(initialThoughts.length === PAGE_SIZE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Panel state
  const [panel, setPanel] = useState<PanelState>(null)
  const isOpen = panel !== null
  const isViewing = panel !== null && panel !== 'new'

  // New-thought form state
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  // ── Panel actions ────────────────────────────────────────────────────────────

  function openNew() {
    setContent('')
    setTags([])
    setTagInput('')
    setPanel('new')
  }

  function closePanel() {
    setPanel(null)
  }

  // ── Tag input actions ────────────────────────────────────────────────────────

  function commitTagInput() {
    const val = tagInput.trim().replace(/,+$/, '')
    if (val && !tags.includes(val)) setTags(prev => [...prev, val])
    setTagInput('')
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitTagInput()
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  // ── List actions ─────────────────────────────────────────────────────────────

  async function handleLoadMore() {
    const lastId = thoughts[thoughts.length - 1]?.id
    if (!lastId) return
    setIsLoadingMore(true)
    const batch = await fetchThoughts(lastId)
    setThoughts(prev => [...prev, ...batch])
    setHasMore(batch.length === PAGE_SIZE)
    setIsLoadingMore(false)
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!content.trim()) return
    commitTagInput()
    setIsSubmitting(true)
    const allTags = tagInput.trim() ? [...tags, tagInput.trim()] : tags
    await saveThought(content.trim(), allTags)
    const fresh = await fetchThoughts()
    setThoughts(fresh)
    setHasMore(fresh.length === PAGE_SIZE)
    setIsSubmitting(false)
    closePanel()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-indigo-600 font-bold text-lg tracking-tight">✦ ThinkZen</span>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            New Thought
          </button>
        </div>
      </header>

      {/* Thoughts grid */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Your Thoughts</h1>
          <span className="text-sm text-gray-400">{thoughts.length} thoughts</span>
        </div>

        {thoughts.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            No thoughts yet. Add your first one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {thoughts.map((thought) => (
              <div
                key={thought.id}
                onClick={() => setPanel(thought)}
                className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <h2 className="font-medium text-gray-900 truncate">{thought.content.split('\n')[0]}</h2>
                <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed flex-1">{thought.content}</p>
                {thought.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {thought.tags.map(tag => <TagChip key={tag} label={tag} />)}
                  </div>
                )}
                <span className="text-xs text-gray-400 mt-1">{formatDate(thought.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="bg-white border border-gray-200 hover:border-gray-300 text-gray-600 text-sm font-medium px-6 py-2.5 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </main>

      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-10 bg-black/30" onClick={closePanel} />
      )}

      {/* Side panel */}
      <div
        className={`fixed inset-y-0 right-0 z-20 w-full max-w-sm bg-white shadow-xl flex flex-col transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">
            {isViewing ? formatDate((panel as SerializedThought).createdAt) : 'New Thought'}
          </h2>
          <button
            onClick={closePanel}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {isViewing ? (
          // View mode
          <div className="flex flex-col flex-1 px-6 py-5 gap-4 overflow-y-auto">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {(panel as SerializedThought).content}
            </p>
            {(panel as SerializedThought).tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(panel as SerializedThought).tags.map(tag => <TagChip key={tag} label={tag} />)}
              </div>
            )}
          </div>
        ) : (
          // Create mode
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 px-6 py-5 gap-4">
            <textarea
              name="content"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What's on your mind?"
              rows={8}
              className="w-full resize-none rounded-xl border border-gray-200 p-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <div>
              <div
                onClick={() => tagInputRef.current?.focus()}
                className="min-h-[42px] flex flex-wrap gap-1.5 items-center rounded-xl border border-gray-200 px-3 py-2 cursor-text focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent"
              >
                {tags.map(tag => (
                  <TagChip key={tag} label={tag} onRemove={() => setTags(prev => prev.filter(t => t !== tag))} />
                ))}
                <input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={commitTagInput}
                  placeholder={tags.length === 0 ? 'Add tags…' : ''}
                  className="flex-1 min-w-[80px] text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Press Enter or comma to add a tag</p>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving…' : 'Save Thought'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
