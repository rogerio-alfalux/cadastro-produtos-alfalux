ALTER TABLE `products` DROP INDEX `uq_products_sku_otica`;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `uq_products_sku_produto` UNIQUE(`sku`,`produto`);