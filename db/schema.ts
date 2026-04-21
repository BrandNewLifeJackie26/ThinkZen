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
  tags: text('tags'),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  intention: text('intention').notNull(),
  plannedDurationSeconds: integer('planned_duration_seconds').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  remainingSeconds: integer('remaining_seconds'),
})
