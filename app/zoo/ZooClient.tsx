'use client'

import { useEffect, useState } from 'react'
import { useFetchAnimals } from '@/app/hooks/animals'
import { getAnimalName } from '@/app/components/companion/constants'
import { type AnimalGroup, groupEncounters, formatEncounterDate } from '@/app/components/utils'
import Link from 'next/link'

const CURRENT_USER = 'demo'

export default function ZooClient() {
  const [groups, setGroups] = useState<AnimalGroup[]>([])
  const [loaded, setLoaded] = useState(false)
  const fetchAnimals = useFetchAnimals(CURRENT_USER)

  useEffect(() => {
    fetchAnimals()
      .then((encounters) =>
        setGroups(groupEncounters(encounters.map((e) => ({ ...e, animalName: getAnimalName(e.animalEmoji) }))))
      )
      .catch(() => setGroups([]))
      .finally(() => setLoaded(true))
  }, [fetchAnimals])

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your Zoo</h1>
            <p className="text-sm text-gray-500 mt-0.5">Animals you've encountered during focus sessions</p>
          </div>
          <Link
            href="/"
            className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            ← Back
          </Link>
        </div>

        {!loaded ? null : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <span className="text-5xl">🐾</span>
            <p className="text-gray-500 text-sm">No animals yet — complete a focus session to meet your first companion!</p>
            <Link
              href="/"
              className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Start a session
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {groups.map((g) => (
              <div
                key={g.animalEmoji}
                className="relative bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col items-center gap-2 hover:shadow-md transition-shadow"
              >
                {g.count > 1 && (
                  <span className="absolute top-2.5 right-2.5 bg-indigo-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                    ×{g.count}
                  </span>
                )}
                <span className="text-4xl select-none">{g.animalEmoji}</span>
                <span className="text-sm font-semibold text-gray-800">{g.animalName}</span>
                <span className="text-xs text-gray-400">{formatEncounterDate(g.lastEncounteredAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
