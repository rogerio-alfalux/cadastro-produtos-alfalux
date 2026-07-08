import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { like } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

const c = await db.select().from(components).where(like(components.modelo, '%XITANIUM 19W%'));
console.log('COMPONENTE:', JSON.stringify(c[0], null, 2));

const p = await db.select({
  id: products.id,
  d220: products.driverOnoff220,
  c220: products.custoDriverOnoff220,
  dbivolt: products.driverOnoffBivolt,
  cbivolt: products.custoDriverOnoffBivolt,
}).from(products).where(like(products.driverOnoff220, '%XITANIUM 19W%')).limit(1);
console.log('PRODUTO:', JSON.stringify(p[0], null, 2));
