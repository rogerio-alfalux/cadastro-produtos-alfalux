ALTER TABLE `products` DROP INDEX `products_sku_unique`;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `uq_products_sku_otica` UNIQUE(`sku`,`otica`);