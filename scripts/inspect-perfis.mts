import { getDb } from "../server/db";
import { products } from "../drizzle/schema";
import { like, or, inArray } from "drizzle-orm";

const db = await getDb();
if (!db) { console.log("DB indisponível"); process.exit(1); }

// Famílias dos perfis modulares (exceto SHARP)
const familias = [
  "BLAZE", "BLAZE H", "EASY H PLUS", "EASY PRIME",
  "FLOW", "HIT", "MINI BLAZE", "SKYLINE", "SMART MINI", "SOFT"
];

const rows = await db
  .select({
    id: products.id,
    produto: products.produto,
    familia: products.familia,
    sku: products.sku,
    categoria: products.categoria,
    instalacao: products.instalacao,
  })
  .from(products)
  .where(inArray(products.familia, familias))
  .orderBy(products.familia, products.produto);

console.log(`Total: ${rows.length} produtos\n`);
for (const r of rows) {
  console.log(`[${r.familia}] ${r.produto} | SKU: ${r.sku} | cat: ${r.categoria} | inst: ${r.instalacao}`);
}
process.exit(0);
