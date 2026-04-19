CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`intention` text NOT NULL,
	`planned_duration_minutes` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
