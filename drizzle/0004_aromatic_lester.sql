ALTER TABLE `products` MODIFY COLUMN `driverOnoffBivolt` text;--> statement-breakpoint
ALTER TABLE `products` ADD `driverOnoffBivoltNaoAplicavel` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `driverDim110vNaoAplicavel` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `driverDimDaliNaoAplicavel` boolean DEFAULT false NOT NULL;