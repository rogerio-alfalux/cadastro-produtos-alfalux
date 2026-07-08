import { getDb } from '../server/db.js';
import { products } from '../drizzle/schema.js';
import { eq, and, sql } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// Distribuição de qtdModuloLed nos perfis 18W
const dist = await db.select({
  qtd: products.qtdModuloLed,
  count: sql<number>`COUNT(*)`,
  exemplo_sku: sql<string>`MIN(sku)`,
  exemplo_driver220: sql<string>`MIN(driverOnoff220)`,
}).from(products).where(
  and(
    eq(products.categoria, 'PERFIS'),
    eq(products.potencia, '18W')
  )
).groupBy(products.qtdModuloLed)
 .orderBy(products.qtdModuloLed);

console.log('=== DISTRIBUIÇÃO qtdModuloLed NOS PERFIS 18W ===');
for (const r of dist) {
  console.log(`  qtd=${r.qtd} → ${r.count} produtos | ex: ${r.exemplo_sku} | driver220: ${r.exemplo_driver220}`);
}

// Verificar se o SKU contém o número de barras (ex: 1IN, 2IN, 3IN...)
// Pegar alguns exemplos de cada qtd
console.log('\n=== EXEMPLOS POR QTD ===');
const exemplos = await db.select({
  sku: products.sku,
  produto: products.produto,
  qtdModuloLed: products.qtdModuloLed,
  moduloLed: products.moduloLed,
  driverOnoff220: products.driverOnoff220,
  driverOnoffBivolt: products.driverOnoffBivolt,
}).from(products).where(
  and(
    eq(products.categoria, 'PERFIS'),
    eq(products.potencia, '18W')
  )
).limit(200);

// Agrupar por qtd e mostrar 3 exemplos de cada
const byQtd = new Map<number, typeof exemplos>();
for (const r of exemplos) {
  const q = Number(r.qtdModuloLed);
  if (!byQtd.has(q)) byQtd.set(q, []);
  byQtd.get(q)!.push(r);
}

for (const [qtd, items] of [...byQtd.entries()].sort((a,b) => a[0]-b[0])) {
  console.log(`\n--- qtd=${qtd} (${items.length} na amostra) ---`);
  for (const r of items.slice(0, 3)) {
    console.log(`  SKU=${r.sku} | ${r.moduloLed}`);
    console.log(`    220V: ${r.driverOnoff220}`);
    console.log(`    BIV:  ${r.driverOnoffBivolt}`);
  }
}
