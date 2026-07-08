import { getDb } from '../server/db.js';
import { products } from '../drizzle/schema.js';
import { like, or } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// Investigar ALE-3462 e ORBIT S
const rows = await db.select({
  id: products.id,
  sku: products.sku,
  produto: products.produto,
  familia: products.familia,
  categoria: products.categoria,
  fotoUrl: products.fotoUrl,
}).from(products).where(
  or(
    like(products.sku, '%ALE-3462%'),
    like(products.produto, '%ORBIT S%'),
    like(products.produto, '%ALE-3462%'),
  )
).limit(30);

console.log('=== ALE-3462 e ORBIT S ===');
for (const r of rows) {
  console.log(`ID=${r.id} | SKU=${r.sku} | PRODUTO=${r.produto} | FAMILIA=${r.familia}`);
  console.log(`  FOTO: ${r.fotoUrl || '(sem foto)'}`);
}

// Verificar SPOTS
const spots = await db.select({
  id: products.id,
  sku: products.sku,
  produto: products.produto,
  familia: products.familia,
  categoria: products.categoria,
}).from(products).where(
  or(
    like(products.categoria, '%SPOT%'),
    like(products.familia, '%SPOT%'),
    like(products.produto, '%SPOT%'),
  )
).limit(20);

console.log('\n=== SPOTS ===');
for (const r of spots) {
  console.log(`ID=${r.id} | SKU=${r.sku} | PRODUTO=${r.produto} | CAT=${r.categoria} | FAMILIA=${r.familia}`);
}

// Verificar categorias únicas no banco
const cats = await db.selectDistinct({ categoria: products.categoria }).from(products).orderBy(products.categoria);
console.log('\n=== CATEGORIAS ÚNICAS ===');
for (const c of cats) {
  console.log(`  "${c.categoria}"`);
}
