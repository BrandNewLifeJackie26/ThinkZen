ALTER TABLE `sessions` RENAME COLUMN "planned_duration_minutes" TO "planned_duration_seconds";--> statement-breakpoint
CREATE TABLE `animal_encounters` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`animal_emoji` text NOT NULL,
	`encountered_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `remaining_seconds` integer;