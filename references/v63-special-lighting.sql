-- Feature v63 — Modalidades de Iluminação e Outros Equipamentos
-- Migração incremental gerada pelo Drizzle e aplicada em 2026-09-01.
-- Operações somente aditivas, sem alteração ou remoção de dados existentes.

ALTER TABLE `products` ADD `moduloTunableWhite` boolean DEFAULT false NOT NULL;
ALTER TABLE `products` ADD `moduloLedTunableWhite` text;
ALTER TABLE `products` ADD `qtdModuloLedTunableWhite` decimal(10,2);
ALTER TABLE `products` ADD `semModuloLed` boolean DEFAULT false NOT NULL;
ALTER TABLE `products` ADD `lampadaAcessorioId` int;
ALTER TABLE `products` ADD `outrosEquipamentos` json;
