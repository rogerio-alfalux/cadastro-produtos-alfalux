import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// Buscar drivers
const codigos = ['EQ00659', 'EQ00221'];
const comps = await db.select({ codigo: components.codigo, modelo: components.modelo, custo: components.custo })
  .from(components).where(inArray(components.codigo, codigos));

const map = new Map<string, { modelo: string; custo: number | null }>();
for (const c of comps) if (c.codigo) map.set(c.codigo, { modelo: c.modelo, custo: c.custo });

const faltando = codigos.filter(c => !map.has(c));
if (faltando.length > 0) { console.error(`Não encontrados: ${faltando.join(', ')}`); process.exit(1); }

console.log('=== DRIVERS DALI 36W-SL ===');
for (const [k, v] of map) console.log(`  ${k} → ${v.modelo}`);

const d659 = map.get('EQ00659')!; // 1–2B
const d221 = map.get('EQ00221')!; // 2.1–3.2B e 3.3–6B (×2)

// Função para extrair barras do SKU (36W-SL só tem barras inteiras, mas mantemos a função)
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

// Buscar perfis 36W-SL
const perfis = await db.select({ id: products.id, sku: products.sku, produto: products.produto })
  .from(products).where(and(eq(products.categoria, 'PERFIS'), eq(products.potencia, '36W-SL')));

console.log(`\nTotal de perfis 36W-SL: ${perfis.length}`);

// Classificar por faixa
const faixa1: number[] = []; // 1–2B     → EQ00659
const faixa2: number[] = []; // 2.1–3.2B → EQ00221
const faixa3: number[] = []; // 3.3–6B   → 2× EQ00221
let semFaixa = 0;

for (const p of perfis) {
  const barras = extrairBarras(p.sku);
  if (barras === null || barras > 8) {
    const match = p.produto.toLowerCase().match(/(\d+\.?\d*)b\b/);
    if (match) {
      const b = parseFloat(match[1]);
      if (b >= 1 && b <= 2) faixa1.push(p.id);
      else if (b > 2 && b <= 3.2) faixa2.push(p.id);
      else if (b > 3.2 && b <= 6) faixa3.push(p.id);
      else semFaixa++;
    } else { semFaixa++; }
    continue;
  }
  if (barras >= 1 && barras <= 2) faixa1.push(p.id);
  else if (barras > 2 && barras <= 3.2) faixa2.push(p.id);
  else if (barras > 3.2 && barras <= 6) faixa3.push(p.id);
  else semFaixa++;
}

console.log(`Faixa 1–2B     (EQ00659):   ${faixa1.length}`);
console.log(`Faixa 2.1–3.2B (EQ00221):   ${faixa2.length}`);
console.log(`Faixa 3.3–6B   (2×EQ00221): ${faixa3.length}`);
if (semFaixa > 0) console.log(`Fora das faixas (não alterados): ${semFaixa}`);

// Aplicar
console.log('\n=== APLICANDO ===');

if (faixa1.length > 0) {
  const r = await db.update(products).set({
    driverDimDali: d659.modelo,
    custoDriverDimDali: d659.custo,
    driverDimDaliExtra: null,
  }).where(inArray(products.id, faixa1));
  console.log(`Faixa 1–2B: ${(r as any)[0]?.affectedRows ?? faixa1.length} → ${d659.modelo}`);
}

if (faixa2.length > 0) {
  const r = await db.update(products).set({
    driverDimDali: d221.modelo,
    custoDriverDimDali: d221.custo,
    driverDimDaliExtra: null,
  }).where(inArray(products.id, faixa2));
  console.log(`Faixa 2.1–3.2B: ${(r as any)[0]?.affectedRows ?? faixa2.length} → ${d221.modelo}`);
}

if (faixa3.length > 0) {
  const extras = [{ modelo: d221.modelo, qtd: 1, custo: d221.custo }];
  const r = await db.update(products).set({
    driverDimDali: d221.modelo,
    custoDriverDimDali: d221.custo,
    driverDimDaliExtra: JSON.stringify(extras),
  }).where(inArray(products.id, faixa3));
  console.log(`Faixa 3.3–6B: ${(r as any)[0]?.affectedRows ?? faixa3.length} → 2× ${d221.modelo}`);
}

console.log('\nConcluído!');
