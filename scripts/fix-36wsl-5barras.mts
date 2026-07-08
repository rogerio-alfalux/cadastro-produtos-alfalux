import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// Buscar drivers necessários
const codigos = ['EQ00347', 'EQ00348', 'EQ00581', 'EQ00582'];
const comps = await db.select({ codigo: components.codigo, modelo: components.modelo, custo: components.custo })
  .from(components).where(inArray(components.codigo, codigos));

const map = new Map<string, { modelo: string; custo: number | null }>();
for (const c of comps) if (c.codigo) map.set(c.codigo, { modelo: c.modelo, custo: c.custo });

const d347 = map.get('EQ00347')!;
const d348 = map.get('EQ00348')!;
const d581 = map.get('EQ00581')!;
const d582 = map.get('EQ00582')!;

// Regra corrigida para 5 barras: 2× EQ00348 + 1× EQ00347
// = EQ00347 principal + [EQ00348 ×2] extras  (ou EQ00348 principal + [EQ00348 ×1, EQ00347 ×1]?)
// Interpretação: "2 EQ00348 e 1 EQ00347" = driver principal EQ00347 + 2 extras EQ00348
// Total: 1× EQ00347 + 2× EQ00348

// Buscar IDs dos perfis 36W-SL com 5 barras inteiras
function extrairBarras(sku: string): number | null {
  const partes = sku.split('.');
  if (partes.length < 2) return null;
  const seg = partes[1];
  const numStr = seg.replace(/[A-Z]+$/i, '');
  const num = parseInt(numStr, 10);
  if (isNaN(num)) return null;
  if (num < 10) return num;
  return Math.floor(num / 10) + (num % 10) / 10;
}

const perfis5b = await db.select({ id: products.id, sku: products.sku })
  .from(products).where(and(eq(products.categoria, 'PERFIS'), eq(products.potencia, '36W-SL')));

const ids5b = perfis5b
  .filter(p => extrairBarras(p.sku) === 5)
  .map(p => p.id);

console.log(`Perfis 36W-SL com 5 barras: ${ids5b.length}`);

if (ids5b.length === 0) { console.log('Nada a atualizar.'); process.exit(0); }

// Corrigir: 5 barras = 1× EQ00347 (principal) + 2× EQ00348 (extras)
const extras220 = [{ modelo: d348.modelo, qtd: 2, custo: d348.custo }];
const extrasBiv = [{ modelo: d582.modelo, qtd: 2, custo: d582.custo }];

const r = await db.update(products).set({
  driverOnoff220: d347.modelo,
  custoDriverOnoff220: d347.custo,
  driverOnoffBivolt: d581.modelo,
  custoDriverOnoffBivolt: d581.custo,
  driverOnoff220Extra: JSON.stringify(extras220),
  driverOnoffBivoltExtra: JSON.stringify(extrasBiv),
}).where(inArray(products.id, ids5b));

const affected = (r as any)[0]?.affectedRows ?? ids5b.length;
console.log(`✅ ${affected} perfis 36W-SL 5B corrigidos:`);
console.log(`   220V: 1× ${d347.modelo} + 2× ${d348.modelo}`);
console.log(`   Bivolt: 1× ${d581.modelo} + 2× ${d582.modelo}`);
