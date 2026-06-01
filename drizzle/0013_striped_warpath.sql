CREATE TABLE `revenda_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(50) NOT NULL,
	`descricao` text NOT NULL,
	`referencia` varchar(200),
	`fornecedor` varchar(200),
	`observacoes` text,
	`fotoUrl` text,
	`fotoKey` text,
	`custo` decimal(10,2),
	`precoVenda` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenda_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `revenda_products_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `qtdModuloLed` decimal(10,2) NOT NULL DEFAULT '1.00';--> statement-breakpoint
ALTER TABLE `products` ADD `precoVendaOnoff220` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `precoVendaOnoffBivolt` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `precoVendaDim110v` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `precoVendaDimDali` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `precoVendaOnoff220D1` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `precoVendaOnoff220D1D2` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `precoVendaOnoffBivoltD1` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `precoVendaOnoffBivoltD1D2` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `precoVendaDim110vD1` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `precoVendaDim110vD1D2` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `precoVendaDimDaliD1` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `precoVendaDimDaliD1D2` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `configuracaoPlanos` enum('D1','D2','D1+D2');