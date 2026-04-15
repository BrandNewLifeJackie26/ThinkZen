import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  steps: text('steps'),        // JSON array of micro-steps
  status: text('status').default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
})

export const thoughts = sqliteTable('thoughts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
})
