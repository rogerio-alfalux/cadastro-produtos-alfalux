import { getDb } from '../server/db.js';
import { products } from '../drizzle/schema.js';
import { eq, and } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

const rows = await db.select({
  id: products.id,
  sku: products.sku,
  produto: products.produto,
  driverOnoff220: products.driverOnoff220,
  driverOnoffBivolt: products.driverOnoffBivolt,
}).from(products).where(
  and(
    eq(products.categoria, 'PERFIS'),
    eq(products.potencia, '18W')
  )
);

function extrairBarras(sku: string): number | null {
  const partes = sku.split('.');
  if (partes.length < 2) return null;
  const seg = partes[1];
  const numStr = seg.replace(/[A-Z]+$/i, '');
  const num = parseInt(numStr, 10);
  if (isNaN(num)) return null;
  if (num < 10) return num;
  const inteiro = Math.floor(num / 10);
  const decimal = num % 10;
  return inteiro + decimal / 10;
}

// Mostrar SKUs com barras > 8 (anômalos)
console.log('=== SKUs ANÔMALOS (barras > 8) ===');
for (const r of rows) {
  const b = extrairBarras(r.sku);
  if (b !== null && b > 8) {
    console.log(`ID=${r.id} | SKU=${r.sku} | barras=${b} | produto=${r.produto}`);
    console.log(`  220V: ${r.driverOnoff220}`);
    console.log(`  BIV:  ${r.driverOnoffBivolt}`);
  }
}

// Contar total por faixa correta
let f1 = 0, f2 = 0, f3 = 0, fErr = 0;
for (const r of rows) {
  const b = extrairBarras(r.sku);
  if (b === null || b > 8) { fErr++; continue; }
  if (b <= 2) f1++;
  else if (b <= 5) f2++;
  else f3++;
}
console.log(`\n=== CONTAGEM FINAL (excluindo anômalos) ===`);
console.log(`≤2 barras: ${f1}`);
console.log(`2.1-5 barras: ${f2}`);
console.log(`>5-8 barras: ${f3}`);
console.log(`Anômalos/erro: ${fErr}`);
