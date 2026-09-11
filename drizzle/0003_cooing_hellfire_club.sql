ALTER TABLE `posts` ADD `posterId` text REFERENCES media(id);--> statement-breakpoint
ALTER TABLE `posts` ADD `loop` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `posts_poster` ON `posts` (`posterId`);