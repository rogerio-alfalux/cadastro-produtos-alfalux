import { getDb } from "./server/db.ts";
import { products } from "./drizzle/schema.ts";
import { like } from "drizzle-orm";

const db = await getDb();
if (!db) { console.error("DB not available"); process.exit(1); }

const rows = await db
  .select({ id: products.id, produto: products.produto, sku: products.sku, fotoUrl: products.fotoUrl, fotoKey: products.fotoKey })
  .from(products)
  .where(like(products.produto, "%VIRGO%"))
  .limit(20);

for (const r of rows) {
  const fotoPreview = r.fotoUrl ? r.fotoUrl.substring(0, 100) : "NULL";
  console.log(`ID=${r.id} | ${r.produto} | ${r.sku} | fotoUrl=${fotoPreview}`);
}
process.exit(0);
