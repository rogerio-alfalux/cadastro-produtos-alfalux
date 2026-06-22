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
  qtdModuloLed: decimal("qtdModuloLed", { precision: 10, scale: 2 }).default("1.00").notNull(),
  // Módulo LED por temperatura de cor (CCT)
  moduloLed2700: text("moduloLed2700"),
  moduloLed3000: text("moduloLed3000"),
  moduloLed4000: text("moduloLed4000"),
  moduloLed5000: text("moduloLed5000"),
  qtdModuloLed2700: decimal("qtdModuloLed2700", { precision: 10, scale: 2 }),
  qtdModuloLed3000: decimal("qtdModuloLed3000", { precision: 10, scale: 2 }),
  qtdModuloLed4000: decimal("qtdModuloLed4000", { precision: 10, scale: 2 }),
  qtdModuloLed5000: decimal("qtdModuloLed5000", { precision: 10, scale: 2 }),
  otica: text("otica").notNull(),
  qtdOtica: int("qtdOtica").default(1).notNull(),
  oticaNaoAplicavel: boolean("oticaNaoAplicavel").default(false).notNull(),
  holder: text("holder").notNull(),
  qtdHolder: int("qtdHolder").default(1).notNull(),
  holderNaoAplicavel: boolean("holderNaoAplicavel").default(false).notNull(),
  dissipador: text("dissipador").notNull(),
  qtdDissipador: int("qtdDissipador").default(1).notNull(),
  dissipadorNaoAplicavel: boolean("dissipadorNaoAplicavel").default(false).notNull(),
  semDriver: boolean("semDriver").default(false).notNull(),

  // Drivers
  driverOnoff220: text("driverOnoff220").notNull(),
  qtdDriverOnoff220: int("qtdDriverOnoff220").default(1).notNull(),
  driverOnoffBivolt: text("driverOnoffBivolt"),
  qtdDriverOnoffBivolt: int("qtdDriverOnoffBivolt").default(1).notNull(),
  driverOnoffBivoltNaoAplicavel: boolean("driverOnoffBivoltNaoAplicavel").default(false).notNull(),
  driverDim110v: text("driverDim110v"),
  qtdDriverDim110v: int("qtdDriverDim110v").default(1).notNull(),
  driverDim110vNaoAplicavel: boolean("driverDim110vNaoAplicavel").default(false).notNull(),
  driverDimDali: text("driverDimDali"),
  qtdDriverDimDali: int("qtdDriverDimDali").default(1).notNull(),
    driverDimDaliNaoAplicavel: boolean("driverDimDaliNaoAplicavel").default(false).notNull(),
  driverDimTriac110v: text("driverDimTriac110v"),
  qtdDriverDimTriac110v: int("qtdDriverDimTriac110v").default(1).notNull(),
  driverDimTriac110vNaoAplicavel: boolean("driverDimTriac110vNaoAplicavel").default(false).notNull(),
  driverDimTriac220v: text("driverDimTriac220v"),
  qtdDriverDimTriac220v: int("qtdDriverDimTriac220v").default(1).notNull(),
  driverDimTriac220vNaoAplicavel: boolean("driverDimTriac220vNaoAplicavel").default(false).notNull(),
  // Drivers extras (JSON array: [{modelo, qtd, custo}])
  driverOnoff220Extra: text("driverOnoff220Extra"),
  driverOnoffBivoltExtra: text("driverOnoffBivoltExtra"),
  driverDim110vExtra: text("driverDim110vExtra"),
  driverDimDaliExtra: text("driverDimDaliExtra"),
  driverDimTriac110vExtra: text("driverDimTriac110vExtra"),
  driverDimTriac220vExtra: text("driverDimTriac220vExtra"),

  // Óticas extras (JSON array: [{modelo, qtd}])
  oticaExtra: text("oticaExtra"),

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
  custoDriverDimTriac110v: decimal("custoDriverDimTriac110v", { precision: 10, scale: 2 }),
  custoDriverDimTriac220v: decimal("custoDriverDimTriac220v", { precision: 10, scale: 2 }),

  // Preço de venda por tipo de driver
  // Categoria "PERFIS": preço por metro linear; demais categorias: preço por peça
  precoVendaOnoff220: decimal("precoVendaOnoff220", { precision: 10, scale: 2 }),
  precoVendaOnoffBivolt: decimal("precoVendaOnoffBivolt", { precision: 10, scale: 2 }),
  precoVendaDim110v: decimal("precoVendaDim110v", { precision: 10, scale: 2 }),
  precoVendaDimDali: decimal("precoVendaDimDali", { precision: 10, scale: 2 }),

  // Preço de venda por tipo de driver — configuração D1 (simples) e D1+D2 (duplo)
  // Exclusivo para categoria PERFIS com dois planos de iluminação
  precoVendaOnoff220D1:      decimal("precoVendaOnoff220D1",      { precision: 10, scale: 2 }),
  precoVendaOnoff220D1D2:    decimal("precoVendaOnoff220D1D2",    { precision: 10, scale: 2 }),
  precoVendaOnoffBivoltD1:   decimal("precoVendaOnoffBivoltD1",   { precision: 10, scale: 2 }),
  precoVendaOnoffBivoltD1D2: decimal("precoVendaOnoffBivoltD1D2", { precision: 10, scale: 2 }),
  precoVendaDim110vD1:       decimal("precoVendaDim110vD1",       { precision: 10, scale: 2 }),
  precoVendaDim110vD1D2:     decimal("precoVendaDim110vD1D2",     { precision: 10, scale: 2 }),
  precoVendaDimDaliD1:       decimal("precoVendaDimDaliD1",       { precision: 10, scale: 2 }),
  precoVendaDimDaliD1D2:     decimal("precoVendaDimDaliD1D2",     { precision: 10, scale: 2 }),

  // Configuração de planos de iluminação (exclusivo para PERFIS)
  // D1 = iluminação para baixo, D2 = iluminação para cima, D1+D2 = dois planos
  configuracaoPlanos: mysqlEnum("configuracaoPlanos", ["D1", "D2", "D1+D2"]),

  // Metadados
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // Um produto é único pela combinação de SKU + Nome do Produto (variantes do mesmo SKU têm nomes diferentes)
  skuProdutoUnique: uniqueIndex("uq_products_sku_produto").on(table.sku, table.produto),
}));

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// Tabela de componentes reutilizáveis (drivers, óticas, holders, etc.)
export const components = mysqlTable("components", {
  id: int("id").autoincrement().primaryKey(),

  // Tipo do componente
  tipo: mysqlEnum("tipo", [
    "DRIVER_ONOFF_220",
    "DRIVER_ONOFF_BIVOLT",
    "DRIVER_DIM_110V",
    "DRIVER_DIM_DALI",
    "DRIVER_DIM_TRIAC_110V",
    "DRIVER_DIM_TRIAC_220V",
    "OTICA",
    "HOLDER",
    "DISSIPADOR",
    "MODULO_LED",
  ]).notNull(),

  // Descrição completa do componente (ex: "PHILIPS CERTADRIVE 20W 500MA (EQ00353)")
  modelo: text("modelo").notNull(),

  // Código interno opcional (ex: "EQ00353")
  codigo: varchar("codigo", { length: 100 }),

  // Observações opcionais
  observacao: text("observacao"),

    // Custo unitário do componente
  custo: decimal("custo", { precision: 10, scale: 2 }),
  // Foto do componente (opcional)
  fotoUrl: text("fotoUrl"),
  fotoKey: text("fotoKey"),
  // Metadados
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Component = typeof components.$inferSelect;
export type InsertComponent = typeof components.$inferInsert;

// Tabela de produtos de revenda (itens de terceiros revendidos pela Alfalux)
export const revendaProducts = mysqlTable("revenda_products", {
  id: int("id").autoincrement().primaryKey(),

  // Identificação
  codigo: varchar("codigo", { length: 50 }).notNull().unique(),
  descricao: text("descricao").notNull(),
  referencia: varchar("referencia", { length: 200 }),
  fornecedor: varchar("fornecedor", { length: 200 }),
  familia: varchar("familia", { length: 200 }),
  observacoes: text("observacoes"),

  // Foto (a ser adicionada futuramente)
  fotoUrl: text("fotoUrl"),
  fotoKey: text("fotoKey"),

  // Financeiro
  custo: decimal("custo", { precision: 10, scale: 2 }),
  precoVenda: decimal("precoVenda", { precision: 10, scale: 2 }),

  // Metadados
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RevendaProduct = typeof revendaProducts.$inferSelect;
export type InsertRevendaProduct = typeof revendaProducts.$inferInsert;

// Tabela de acessórios (peças e acessórios fabricados ou revendidos pela Alfalux)
export const accessories = mysqlTable("accessories", {
  id: int("id").autoincrement().primaryKey(),
  // Identificação
  codigo: varchar("codigo", { length: 50 }),
  sku: varchar("sku", { length: 100 }),
  produto: text("produto"),
  familia: varchar("familia", { length: 200 }),
  dimensao: varchar("dimensao", { length: 200 }),
  // Foto
  fotoUrl: text("fotoUrl"),
  fotoKey: text("fotoKey"),
  // Financeiro
  custo: decimal("custo", { precision: 10, scale: 2 }),
  precoVenda: decimal("precoVenda", { precision: 10, scale: 2 }),
  observacoes: text("observacoes"),
  // Metadados
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Accessory = typeof accessories.$inferSelect;
export type InsertAccessory = typeof accessories.$inferInsert;
