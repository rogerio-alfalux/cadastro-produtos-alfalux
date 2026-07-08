import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// 1. Buscar drivers DALI
const codigos = ['EQ00090', 'EQ00221'];
const comps = await db.select({ codigo: components.codigo, modelo: components.modelo, custo: components.custo })
  .from(components).where(inArray(components.codigo, codigos));

const map = new Map<string, { modelo: string; custo: number | null }>();
for (const c of comps) if (c.codigo) map.set(c.codigo, { modelo: c.modelo, custo: c.custo });

const faltando = codigos.filter(c => !map.has(c));
if (faltando.length > 0) { console.error(`Não encontrados: ${faltando.join(', ')}`); process.exit(1); }

console.log('=== DRIVERS DALI 26W ===');
for (const [k, v] of map) console.log(`  ${k} → ${v.modelo}`);

const d090 = map.get('EQ00090')!; // 1 – 2B
const d221 = map.get('EQ00221')!; // 4 – 6B

// 2. Função para extrair barras do SKU
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

// 3. Buscar perfis 26W
const perfis = await db.select({ id: products.id, sku: products.sku, produto: products.produto })
  .from(products).where(and(eq(products.categoria, 'PERFIS'), eq(products.potencia, '26W')));

console.log(`\nTotal de perfis 26W: ${perfis.length}`);

// 4. Classificar por faixa
const faixa1: number[] = []; // 1 – 2B   → EQ00090
const faixa2: number[] = []; // 4 – 6B   → EQ00221
let semFaixa = 0; // fora das faixas especificadas (2.1–3.9 e >6) — não alterar

for (const p of perfis) {
  const barras = extrairBarras(p.sku);
  if (barras === null || barras > 8) {
    const match = p.produto.toLowerCase().match(/(\d+\.?\d*)b\b/);
    if (match) {
      const b = parseFloat(match[1]);
      if (b >= 1 && b <= 2) faixa1.push(p.id);
      else if (b >= 4 && b <= 6) faixa2.push(p.id);
      else semFaixa++;
    } else {
      semFaixa++;
    }
    continue;
  }
  if (barras >= 1 && barras <= 2) faixa1.push(p.id);
  else if (barras >= 4 && barras <= 6) faixa2.push(p.id);
  else semFaixa++; // 2.1–3.9 e >6 — não especificado, não alterar
}

console.log(`Faixa 1–2B   (EQ00090): ${faixa1.length}`);
console.log(`Faixa 4–6B   (EQ00221): ${faixa2.length}`);
console.log(`Fora das faixas (não alterados): ${semFaixa}`);

// 5. Aplicar
console.log('\n=== APLICANDO ===');

if (faixa1.length > 0) {
  const r = await db.update(products).set({
    driverDimDali: d090.modelo,
    custoDriverDimDali: d090.custo,
  }).where(inArray(products.id, faixa1));
  console.log(`Faixa 1–2B: ${(r as any)[0]?.affectedRows ?? faixa1.length} → ${d090.modelo}`);
}

if (faixa2.length > 0) {
  const r = await db.update(products).set({
    driverDimDali: d221.modelo,
    custoDriverDimDali: d221.custo,
  }).where(inArray(products.id, faixa2));
  console.log(`Faixa 4–6B: ${(r as any)[0]?.affectedRows ?? faixa2.length} → ${d221.modelo}`);
}

console.log('\nConcluído!');
