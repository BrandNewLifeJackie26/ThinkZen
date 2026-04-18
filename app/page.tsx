const FAKE_THOUGHTS = [
  {
    id: '1',
    title: 'Morning reflection',
    preview: 'Started the day with a walk around the block. Feeling more grounded when I do this before opening my laptop.',
    date: 'Apr 11',
  },
  {
    id: '2',
    title: 'Project ideas',
    preview: 'Build a habit tracker with streaks, a minimal read-later app, and a CLI tool for organizing notes by topic.',
    date: 'Apr 10',
  },
  {
    id: '3',
    title: 'Book notes: Deep Work',
    preview: 'Cal Newport argues that the ability to focus without distraction is becoming rare — and increasingly valuable.',
    date: 'Apr 9',
  },
  {
    id: '4',
    title: 'Weekly review',
    preview: 'Things that went well this week: shipped the auth flow, cleared my inbox, had a good 1:1 with the team.',
    date: 'Apr 7',
  },
  {
    id: '5',
    title: 'Random thought',
    preview: 'What if note-taking apps focused on getting thoughts out fast rather than organizing them perfectly?',
    date: 'Apr 5',
  },
  {
    id: '6',
    title: 'Setup checklist',
    preview: 'Install dependencies, configure ESLint, set up the database schema, deploy to Vercel on first working build.',
    date: 'Apr 3',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-indigo-600 font-bold text-lg tracking-tight">
            ✦ ThinkZen
          </span>
          <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <span className="text-base leading-none">+</span>
            New Thought
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Section heading */}
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Your Thoughts</h1>
          <span className="text-sm text-gray-400">{FAKE_THOUGHTS.length} thoughts</span>
        </div>

        {/* Thoughts grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FAKE_THOUGHTS.map((thought) => (
            <div
              key={thought.id}
              className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <h2 className="font-medium text-gray-900 truncate">{thought.title}</h2>
              <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed flex-1">
                {thought.preview}
              </p>
              <span className="text-xs text-gray-400 mt-1">{thought.date}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
