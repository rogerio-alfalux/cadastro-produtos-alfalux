CREATE TABLE `components` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('DRIVER_ONOFF_220','DRIVER_ONOFF_BIVOLT','DRIVER_DIM_110V','DRIVER_DIM_DALI','OTICA','HOLDER','DISSIPADOR','MODULO_LED') NOT NULL,
	`modelo` text NOT NULL,
	`codigo` varchar(100),
	`observacao` text,
	`custo` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `components_id` PRIMARY KEY(`id`)
);
