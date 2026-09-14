CREATE TABLE `buyer_language_contradictions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`claim_key` text NOT NULL,
	`canonical_contradiction_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `buyer_language_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buyer_language_contradictions_run_contradiction_idx` ON `buyer_language_contradictions` (`run_id`,`id`);--> statement-breakpoint
CREATE INDEX `buyer_language_contradictions_run_idx` ON `buyer_language_contradictions` (`run_id`);--> statement-breakpoint
CREATE TABLE `buyer_language_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`claim_key` text NOT NULL,
	`language` text NOT NULL,
	`market` text NOT NULL,
	`raw_artifact_ref` text NOT NULL,
	`artifact_sha256` text NOT NULL,
	`canonical_observation_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `buyer_language_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buyer_language_observations_run_observation_idx` ON `buyer_language_observations` (`run_id`,`id`);--> statement-breakpoint
CREATE INDEX `buyer_language_observations_run_idx` ON `buyer_language_observations` (`run_id`);--> statement-breakpoint
CREATE TABLE `buyer_language_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`language` text NOT NULL,
	`market` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `buyer_language_runs_project_created_idx` ON `buyer_language_runs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `buyer_language_unknowns` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`canonical_unknown_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `buyer_language_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buyer_language_unknowns_run_unknown_idx` ON `buyer_language_unknowns` (`run_id`,`id`);