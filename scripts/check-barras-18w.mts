import { getDb } from '../server/db.js';
import { products } from '../drizzle/schema.js';
import { eq, and } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// Pegar amostra dos perfis 18W para ver como moduloLed está formatado
const rows = await db.select({
  id: products.id,
  sku: products.sku,
  produto: products.produto,
  moduloLed: products.moduloLed,
  qtdModuloLed: products.qtdModuloLed,
  driverOnoff220: products.driverOnoff220,
  driverOnoffBivolt: products.driverOnoffBivolt,
}).from(products).where(
  and(
    eq(products.categoria, 'PERFIS'),
    eq(products.potencia, '18W')
  )
).limit(50);

// Mostrar valores únicos de moduloLed e qtdModuloLed
const modulos = new Map<string, number>();
for (const r of rows) {
  const key = `qtd=${r.qtdModuloLed} | moduloLed=${r.moduloLed}`;
  modulos.set(key, (modulos.get(key) || 0) + 1);
}

console.log('=== AMOSTRA DE MÓDULOS LED NOS PERFIS 18W ===');
for (const [k, count] of [...modulos.entries()].sort()) {
  console.log(`  ${k} (${count}x)`);
}

// Mostrar alguns exemplos completos
console.log('\n=== EXEMPLOS ===');
for (const r of rows.slice(0, 10)) {
  console.log(`SKU=${r.sku} | qtdModuloLed=${r.qtdModuloLed} | moduloLed=${r.moduloLed}`);
  console.log(`  driver220=${r.driverOnoff220} | driverBiv=${r.driverOnoffBivolt}`);
}
