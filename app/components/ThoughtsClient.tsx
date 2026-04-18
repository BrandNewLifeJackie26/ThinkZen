'use client'

import { useState } from 'react'

export interface SerializedThought {
  id: string
  userId: string
  content: string
  createdAt: string
  archivedAt: string | null
  tags: string[]
}

const CURRENT_USER = 'demo'
const PAGE_SIZE = 20

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ThoughtsClient({ initialThoughts }: { initialThoughts: SerializedThought[] }) {
  const [thoughts, setThoughts] = useState<SerializedThought[]>(initialThoughts)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(initialThoughts.length === PAGE_SIZE)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [content, setContent] = useState('')

  async function handleLoadMore() {
    const lastId = thoughts[thoughts.length - 1]?.id
    if (!lastId) return
    setIsLoadingMore(true)
    const res = await fetch(`/api/thoughts?user=${CURRENT_USER}&limit=${PAGE_SIZE}&from=${lastId}`)
    const batch: SerializedThought[] = await res.json()
    setThoughts(prev => [...prev, ...batch])
    setHasMore(batch.length === PAGE_SIZE)
    setIsLoadingMore(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!content.trim()) return
    setIsSubmitting(true)
    await fetch('/api/thoughts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ user: CURRENT_USER, timestamp: Date.now(), content: content.trim() }]),
    })
    const res = await fetch(`/api/thoughts?user=${CURRENT_USER}&limit=${PAGE_SIZE}`)
    const fresh: SerializedThought[] = await res.json()
    setThoughts(fresh)
    setHasMore(fresh.length === PAGE_SIZE)
    setContent('')
    setIsSubmitting(false)
    setIsPanelOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-indigo-600 font-bold text-lg tracking-tight">✦ ThinkZen</span>
          <button
            onClick={() => setIsPanelOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            New Thought
          </button>
        </div>
      </header>

      {/* Main */}
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
            {thoughts.map((thought) => {
              const firstLine = thought.content.split('\n')[0]
              return (
                <div
                  key={thought.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <h2 className="font-medium text-gray-900 truncate">{firstLine}</h2>
                  <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed flex-1">
                    {thought.content}
                  </p>
                  <span className="text-xs text-gray-400 mt-1">{formatDate(thought.createdAt)}</span>
                </div>
              )
            })}
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
      {isPanelOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/30"
          onClick={() => setIsPanelOpen(false)}
        />
      )}

      {/* Side panel */}
      <div
        className={`fixed inset-y-0 right-0 z-20 w-full max-w-sm bg-white shadow-xl flex flex-col transform transition-transform duration-300 ${
          isPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">New Thought</h2>
          <button
            onClick={() => setIsPanelOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 px-6 py-5 gap-4">
          <textarea
            name="content"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={8}
            className="w-full resize-none rounded-xl border border-gray-200 p-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving…' : 'Save Thought'}
          </button>
        </form>
      </div>
    </div>
  )
}
