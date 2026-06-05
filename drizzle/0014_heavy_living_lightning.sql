CREATE TABLE `accessories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(50),
	`sku` varchar(100),
	`produto` text,
	`familia` varchar(200),
	`dimensao` varchar(200),
	`fotoUrl` text,
	`fotoKey` text,
	`custo` decimal(10,2),
	`precoVenda` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accessories_id` PRIMARY KEY(`id`)
);
