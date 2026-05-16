import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Tabela principal de produtos
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),

  // Identificação
  categoria: varchar("categoria", { length: 100 }),
  instalacao: varchar("instalacao", { length: 100 }).notNull(),
  familia: varchar("familia", { length: 200 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  produto: varchar("produto", { length: 500 }).notNull(),

  // Componentes
  moduloLed: text("moduloLed").notNull(),
  otica: text("otica").notNull(),
  oticaNaoAplicavel: boolean("oticaNaoAplicavel").default(false).notNull(),
  holder: text("holder").notNull(),
  holderNaoAplicavel: boolean("holderNaoAplicavel").default(false).notNull(),
  dissipador: text("dissipador").notNull(),
  dissipadorNaoAplicavel: boolean("dissipadorNaoAplicavel").default(false).notNull(),

  // Drivers
  driverOnoff220: text("driverOnoff220").notNull(),
  driverOnoffBivolt: text("driverOnoffBivolt"),
  driverOnoffBivoltNaoAplicavel: boolean("driverOnoffBivoltNaoAplicavel").default(false).notNull(),
  driverDim110v: text("driverDim110v"),
  driverDim110vNaoAplicavel: boolean("driverDim110vNaoAplicavel").default(false).notNull(),
  driverDimDali: text("driverDimDali"),
  driverDimDaliNaoAplicavel: boolean("driverDimDaliNaoAplicavel").default(false).notNull(),

  // Temperatura de cor (JSON array com valores selecionados) - default aplicado na aplicação
  temperaturasCor: text("temperaturasCor").notNull(),

  // Foto
  fotoUrl: text("fotoUrl"),
  fotoKey: text("fotoKey"),

  // Custo da luminária (corpo)
  custoLuminaria: decimal("custoLuminaria", { precision: 10, scale: 2 }),

  // Custo por driver (cada driver tem seu próprio custo)
  custoDriverOnoff220: decimal("custoDriverOnoff220", { precision: 10, scale: 2 }),
  custoDriverOnoffBivolt: decimal("custoDriverOnoffBivolt", { precision: 10, scale: 2 }),
  custoDriverDim110v: decimal("custoDriverDim110v", { precision: 10, scale: 2 }),
  custoDriverDimDali: decimal("custoDriverDimDali", { precision: 10, scale: 2 }),

  // Metadados
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // Um produto é único pela combinação de SKU + Ótica (variantes do mesmo SKU têm óticas diferentes)
  skuOticaUnique: uniqueIndex("uq_products_sku_otica").on(table.sku, table.otica),
}));

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
