import { getDb } from "../server/db";
import { products } from "../drizzle/schema";
import { like, or } from "drizzle-orm";

const db = await getDb();
if (!db) { console.log("DB indisponível"); process.exit(1); }

const rows = await db
  .select({
    id: products.id,
    produto: products.produto,
    familia: products.familia,
    sku: products.sku,
    correnteDriver: products.correnteDriver,
  })
  .from(products)
  .where(
    or(
      like(products.familia, "%LINEAR%"),
      like(products.familia, "%PERFIL%"),
      like(products.produto, "%LINEAR%"),
      like(products.produto, "%PERFIL%"),
    )
  )
  .orderBy(products.familia, products.produto)
  .limit(30);

console.log(JSON.stringify(rows, null, 2));
process.exit(0);
