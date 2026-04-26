import { db } from '@/db'
import { thoughts } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import Homepage, { SerializedThought } from './components/Homepage'

const CURRENT_USER = 'demo'
const PAGE_SIZE = 20

export default async function Home() {
  const rows = await db
    .select()
    .from(thoughts)
    .where(eq(thoughts.userId, CURRENT_USER))
    .orderBy(desc(thoughts.createdAt))
    .limit(PAGE_SIZE)

  const initial: SerializedThought[] = rows.map(t => ({
    id: t.id,
    userId: t.userId,
    content: t.content,
    createdAt: t.createdAt?.toISOString() ?? new Date().toISOString(),
    archivedAt: t.archivedAt?.toISOString() ?? null,
    tags: t.tags ? JSON.parse(t.tags as string) : [],
  }))

  return <Homepage initialThoughts={initial} />
}
