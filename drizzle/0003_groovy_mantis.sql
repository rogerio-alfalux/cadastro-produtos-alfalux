ALTER TABLE `products` ADD `custoDriverOnoff220` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `custoDriverOnoffBivolt` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `custoDriverDim110v` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `custoDriverDimDali` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `custoDriver`;