ALTER TABLE `products` ADD `driverDimTriac110v` text;--> statement-breakpoint
ALTER TABLE `products` ADD `qtdDriverDimTriac110v` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `driverDimTriac110vNaoAplicavel` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `driverDimTriac220v` text;--> statement-breakpoint
ALTER TABLE `products` ADD `qtdDriverDimTriac220v` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `driverDimTriac220vNaoAplicavel` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `driverDimTriac110vExtra` text;--> statement-breakpoint
ALTER TABLE `products` ADD `driverDimTriac220vExtra` text;--> statement-breakpoint
ALTER TABLE `products` ADD `custoDriverDimTriac110v` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `custoDriverDimTriac220v` decimal(10,2);