CREATE TABLE `homepage_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`originalId` text,
	`videoId` text,
	`posterId` text,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`originalId`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`videoId`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`posterId`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `media` ADD `purpose` text DEFAULT 'post' NOT NULL;--> statement-breakpoint
ALTER TABLE `media` ADD `durationMs` integer;--> statement-breakpoint
ALTER TABLE `media` ADD `frameRateMilli` integer;