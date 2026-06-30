CREATE TABLE `backups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(500) NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`sizeBytes` int NOT NULL DEFAULT 0,
	`counts` text,
	`status` enum('success','error') NOT NULL DEFAULT 'success',
	`errorMessage` text,
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `components` ADD `mkpMinimoDriver` decimal(6,4);--> statement-breakpoint
ALTER TABLE `products` ADD `mkpPadraoDriverOnoff220v` decimal(6,4);--> statement-breakpoint
ALTER TABLE `products` ADD `mkpPadraoDriverOnoffBivolt` decimal(6,4);--> statement-breakpoint
ALTER TABLE `products` ADD `mkpPadraoDriverDim110v` decimal(6,4);--> statement-breakpoint
ALTER TABLE `products` ADD `mkpPadraoDriverDimDali` decimal(6,4);--> statement-breakpoint
ALTER TABLE `products` ADD `mkpPadraoDriverDimTriac110v` decimal(6,4);--> statement-breakpoint
ALTER TABLE `products` ADD `mkpPadraoDriverDimTriac220v` decimal(6,4);--> statement-breakpoint
ALTER TABLE `products` ADD `mkpMinimoDriver` decimal(6,4);--> statement-breakpoint
ALTER TABLE `products` ADD `custoCorpoOnoff220vD1D2` decimal(10,4);--> statement-breakpoint
ALTER TABLE `products` ADD `custoCorpoOnoffBivoltD1D2` decimal(10,4);--> statement-breakpoint
ALTER TABLE `products` ADD `custoCorpoDim110vD1D2` decimal(10,4);--> statement-breakpoint
ALTER TABLE `products` ADD `custoCorpoDimDaliD1D2` decimal(10,4);--> statement-breakpoint
ALTER TABLE `products` ADD `custoCorpoDimTriac110vD1D2` decimal(10,4);--> statement-breakpoint
ALTER TABLE `products` ADD `custoCorpoDimTriac220vD1D2` decimal(10,4);