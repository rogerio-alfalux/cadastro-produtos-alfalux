import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertProduct, InsertUser, components, products, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function listProducts(opts?: {
  search?: string;
  categoria?: string;
  instalacao?: string;
  familia?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [];
  if (opts?.search) {
    const term = `%${opts.search}%`;
    conditions.push(
      or(
        like(products.produto, term),
        like(products.sku, term),
        like(products.familia, term),
        like(products.moduloLed, term)
      )
    );
  }
  if (opts?.categoria) conditions.push(eq(products.categoria, opts.categoria));
  if (opts?.instalacao) conditions.push(eq(products.instalacao, opts.instalacao));
  if (opts?.familia) conditions.push(eq(products.familia, opts.familia));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .limit(opts?.limit ?? 50)
      .offset(opts?.offset ?? 0)
      .orderBy(products.familia, products.produto),
    db.select({ count: sql<number>`count(*)` }).from(products).where(where),
  ]);

  return { items, total: Number(countResult[0]?.count ?? 0) };
}

/**
 * Busca os códigos EQ dos módulos LED de um produto a partir dos nomes armazenados.
 * Faz lookup na tabela components pelo campo `modelo` (nome do módulo).
 */
async function enrichWithModuloLedEq(db: ReturnType<typeof drizzle>, product: typeof products.$inferSelect) {
  const moduloNames = [
    product.moduloLed,
    product.moduloLed2700,
    product.moduloLed3000,
    product.moduloLed4000,
    product.moduloLed5000,
  ].filter((n): n is string => !!n);

  const uniqueNames = Array.from(new Set(moduloNames));
  if (uniqueNames.length === 0) return product;

  // Busca todos os componentes do tipo MODULO_LED que correspondem aos nomes
  const comps = await db
    .select({ modelo: components.modelo, codigo: components.codigo })
    .from(components)
    .where(
      and(
        eq(components.tipo, "MODULO_LED" as any),
        sql`${components.modelo} IN (${sql.join(uniqueNames.map((n) => sql`${n}`), sql`, `)})`
      )
    );

  const eqMap = new Map(comps.map((c) => [c.modelo, c.codigo ?? null]));

  return {
    ...product,
    eqModuloLed:     product.moduloLed     ? (eqMap.get(product.moduloLed)     ?? null) : null,
    eqModuloLed2700: product.moduloLed2700 ? (eqMap.get(product.moduloLed2700) ?? null) : null,
    eqModuloLed3000: product.moduloLed3000 ? (eqMap.get(product.moduloLed3000) ?? null) : null,
    eqModuloLed4000: product.moduloLed4000 ? (eqMap.get(product.moduloLed4000) ?? null) : null,
    eqModuloLed5000: product.moduloLed5000 ? (eqMap.get(product.moduloLed5000) ?? null) : null,
  };
}

/**
 * Enriquece uma lista de produtos com códigos EQ dos módulos LED.
 * Faz uma única query na tabela components para todos os produtos.
 */
export async function enrichManyWithModuloLedEq(
  db: ReturnType<typeof drizzle>,
  items: (typeof products.$inferSelect)[]
) {
  const allNames = new Set<string>();
  for (const p of items) {
    if (p.moduloLed)     allNames.add(p.moduloLed);
    if (p.moduloLed2700) allNames.add(p.moduloLed2700);
    if (p.moduloLed3000) allNames.add(p.moduloLed3000);
    if (p.moduloLed4000) allNames.add(p.moduloLed4000);
    if (p.moduloLed5000) allNames.add(p.moduloLed5000);
  }
  if (allNames.size === 0) return items.map((p) => ({ ...p, eqModuloLed: null, eqModuloLed2700: null, eqModuloLed3000: null, eqModuloLed4000: null, eqModuloLed5000: null }));

  const uniqueNames = Array.from(allNames);
  const comps = await db
    .select({ modelo: components.modelo, codigo: components.codigo })
    .from(components)
    .where(
      and(
        eq(components.tipo, "MODULO_LED" as any),
        sql`${components.modelo} IN (${sql.join(uniqueNames.map((n) => sql`${n}`), sql`, `)})`
      )
    );

  const eqMap = new Map(comps.map((c) => [c.modelo, c.codigo ?? null]));

  return items.map((p) => ({
    ...p,
    eqModuloLed:     p.moduloLed     ? (eqMap.get(p.moduloLed)     ?? null) : null,
    eqModuloLed2700: p.moduloLed2700 ? (eqMap.get(p.moduloLed2700) ?? null) : null,
    eqModuloLed3000: p.moduloLed3000 ? (eqMap.get(p.moduloLed3000) ?? null) : null,
    eqModuloLed4000: p.moduloLed4000 ? (eqMap.get(p.moduloLed4000) ?? null) : null,
    eqModuloLed5000: p.moduloLed5000 ? (eqMap.get(p.moduloLed5000) ?? null) : null,
  }));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!result[0]) return null;
  return enrichWithModuloLedEq(db, result[0]);
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return result;
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(products).where(eq(products.id, id));
}

export async function bulkInsertProducts(items: InsertProduct[]): Promise<{ inserted: number; skipped: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Deduplicate within the batch itself (keep last occurrence per SKU+Produto)
  // A product is uniquely identified by its SKU + Nome do Produto combination
  // (same SKU can have multiple variants with different names/angles/options)
  const seen = new Map<string, InsertProduct>();
  for (const item of items) {
    const key = `${(item.sku ?? "").toUpperCase()}||${(item.produto ?? "").toUpperCase()}`;
    seen.set(key, item);
  }
  const deduped = Array.from(seen.values());
  const skippedInBatch = items.length - deduped.length;

  // Insert in batches of 50 using INSERT IGNORE to skip existing SKUs
  const batchSize = 50;
  let affectedRows = 0;
  for (let i = 0; i < deduped.length; i += batchSize) {
    const batch = deduped.slice(i, i + batchSize);
    // Use raw SQL INSERT IGNORE to skip duplicate SKUs already in DB
    const placeholders = batch.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
    const vals: unknown[] = [];
    for (const p of batch) {
      vals.push(
        p.categoria ?? null, p.instalacao ?? "", p.familia ?? "", p.sku ?? "",
        p.produto ?? "", p.moduloLed ?? "", p.otica ?? "", p.oticaNaoAplicavel ?? false,
        p.holder ?? "", p.holderNaoAplicavel ?? false, p.dissipador ?? "", p.dissipadorNaoAplicavel ?? false,
        p.driverOnoff220 ?? "", p.driverOnoffBivolt ?? "", p.driverOnoffBivoltNaoAplicavel ?? false,
        p.driverDim110v ?? null, p.driverDim110vNaoAplicavel ?? false,
        p.driverDimDali ?? null, p.driverDimDaliNaoAplicavel ?? false,
        p.temperaturasCor ?? '["2700","3000","4000","5000"]',
        p.fotoUrl ?? null, p.fotoKey ?? null,
        p.custoLuminaria ?? null, p.custoDriverOnoff220 ?? null
      );
    }
    // Build parameterized INSERT IGNORE using drizzle sql tag
    const query = sql.raw(
      `INSERT IGNORE INTO products (categoria, instalacao, familia, sku, produto, moduloLed, otica, oticaNaoAplicavel, holder, holderNaoAplicavel, dissipador, dissipadorNaoAplicavel, driverOnoff220, driverOnoffBivolt, driverOnoffBivoltNaoAplicavel, driverDim110v, driverDim110vNaoAplicavel, driverDimDali, driverDimDaliNaoAplicavel, temperaturasCor, fotoUrl, fotoKey, custoLuminaria, custoDriverOnoff220) VALUES ${placeholders}`
    );
    // Inject values via the underlying mysql2 connection
    const rawDb = (db as any).session?.client ?? (db as any)._client;
    let result: any;
    if (rawDb) {
      [result] = await rawDb.execute(
        `INSERT IGNORE INTO products (categoria, instalacao, familia, sku, produto, moduloLed, otica, oticaNaoAplicavel, holder, holderNaoAplicavel, dissipador, dissipadorNaoAplicavel, driverOnoff220, driverOnoffBivolt, driverOnoffBivoltNaoAplicavel, driverDim110v, driverDim110vNaoAplicavel, driverDimDali, driverDimDaliNaoAplicavel, temperaturasCor, fotoUrl, fotoKey, custoLuminaria, custoDriverOnoff220) VALUES ${placeholders}`,
        vals
      );
    } else {
      // Fallback: use drizzle execute with raw sql (no params)
      result = { affectedRows: batch.length };
      await db.execute(query);
    }
    // mysql2 execute returns [ResultSetHeader, ...], affectedRows is on result directly
    affectedRows += result?.affectedRows ?? batch.length;
  }

  const skipped = skippedInBatch + (deduped.length - affectedRows);
  return { inserted: affectedRows, skipped };
}

export async function countProducts() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(products);
  return Number(result[0]?.count ?? 0);
}

// ─── Autocomplete suggestions ────────────────────────────────────────────────

const ALLOWED_SUGGESTION_FIELDS = [
  "familia", "produto", "moduloLed", "otica", "holder", "dissipador",
  "driverOnoff220", "driverOnoffBivolt", "driverDim110v", "driverDimDali",
] as const;

type SuggestionField = (typeof ALLOWED_SUGGESTION_FIELDS)[number];

export async function getFieldSuggestions(field: SuggestionField, query: string): Promise<string[]> {
  const db = await getDb();
  if (!db || !query || query.trim().length < 1) return [];

  // Validate field is in the allowed list (security: prevent SQL injection via column name)
  if (!ALLOWED_SUGGESTION_FIELDS.includes(field)) return [];

  const col = products[field];
  if (!col) return [];

  const term = `%${query.trim()}%`;
  const rows = await db
    .selectDistinct({ value: col })
    .from(products)
    .where(and(like(col, term), sql`${col} IS NOT NULL`, sql`${col} != ''`, sql`${col} != 'NÃO APLICÁVEL'`))
    .orderBy(asc(col))
    .limit(10);

  return rows.map((r) => String(r.value)).filter(Boolean);
}
