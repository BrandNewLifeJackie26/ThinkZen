CREATE TABLE `animal_encounters` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`animal_emoji` text NOT NULL,
	`animal_name` text NOT NULL,
	`encountered_at` integer NOT NULL
);
