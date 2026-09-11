CREATE TABLE `homepage_upload_items` (
	`id` text PRIMARY KEY NOT NULL,
	`taskId` text NOT NULL,
	`purpose` text NOT NULL,
	`mediaId` text,
	`owned` integer DEFAULT 1 NOT NULL,
	`leaseToken` text,
	`leaseUntil` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`taskId`) REFERENCES `homepage_upload_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mediaId`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homepage_task_purpose` ON `homepage_upload_items` (`taskId`,`purpose`);--> statement-breakpoint
CREATE TABLE `homepage_upload_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` integer NOT NULL,
	`expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `homepage_tasks_expiry` ON `homepage_upload_tasks` (`status`,`expiresAt`);--> statement-breakpoint
ALTER TABLE `media` ADD `hasAudio` integer;