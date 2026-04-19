CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`steps` text,
	`status` text DEFAULT 'active',
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `thoughts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer,
	`archived_at` integer,
	`tags` text
);
