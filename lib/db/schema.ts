import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const werewolfRooms = pgTable('werewolf_rooms', {
  id: text('id').primaryKey(), code: text('code').notNull().unique(), hostToken: text('host_token').notNull(), status: text('status').notNull().default('lobby'), phase: text('phase').notNull().default('lobby'), maxPlayers: integer('max_players').notNull().default(12), centerRoles: jsonb('center_roles').notNull().default([]), deckRoles: jsonb('deck_roles').notNull().default([]),   actionSeconds: integer('action_seconds').notNull().default(30), activeRole: text('active_role'), actionStartedAt: timestamp('action_started_at', { withTimezone: true }), enabledRoles: jsonb('enabled_roles').notNull().default([]), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const werewolfPlayers = pgTable('werewolf_players', {
  id: text('id').primaryKey(), roomId: text('room_id').notNull(), token: text('token').notNull().unique(), name: text('name').notNull(), role: text('role'), startingRole: text('starting_role'), seat: integer('seat').notNull(), isHost: boolean('is_host').notNull().default(false), nightAction: jsonb('night_action'), voteFor: text('vote_for'), joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
})
