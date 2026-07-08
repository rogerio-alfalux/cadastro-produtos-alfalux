import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { eq, and, inArray, or } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// 1. Buscar drivers DALI
const codigos = ['EQ00509', 'EQ00659', 'EQ00221'];
const comps = await db.select({ codigo: components.codigo, modelo: components.modelo, custo: components.custo })
  .from(components).where(inArray(components.codigo, codigos));

const map = new Map<string, { modelo: string; custo: number | null }>();
for (const c of comps) if (c.codigo) map.set(c.codigo, { modelo: c.modelo, custo: c.custo });

const faltando = codigos.filter(c => !map.has(c));
if (faltando.length > 0) { console.error(`Não encontrados: ${faltando.join(', ')}`); process.exit(1); }

console.log('=== DRIVERS DALI ===');
for (const [k, v] of map) console.log(`  ${k} → ${v.modelo}`);

const d509 = map.get('EQ00509')!; // 1 – 1.6B
const d659 = map.get('EQ00659')!; // 2 – 4B
const d221 = map.get('EQ00221')!; // 4.1 – 8B

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

// 3. Buscar perfis 18W e 36W-SF
const potencias = ['18W', '36W-SF'];
const perfis = await db.select({ id: products.id, sku: products.sku, produto: products.produto, potencia: products.potencia })
  .from(products).where(
    and(
      eq(products.categoria, 'PERFIS'),
      inArray(products.potencia, potencias)
    )
  );

console.log(`\nTotal de perfis 18W + 36W-SF: ${perfis.length}`);

// 4. Classificar por faixa
const faixa1: number[] = []; // 1 – 1.6B → EQ00509
const faixa2: number[] = []; // 2 – 4B   → EQ00659
const faixa3: number[] = []; // 4.1 – 8B → EQ00221
let anomalos = 0;

for (const p of perfis) {
  const barras = extrairBarras(p.sku);
  if (barras === null || barras > 8) {
    // Tentar pelo nome do produto
    const match = p.produto.toLowerCase().match(/(\d+\.?\d*)b\b/);
    if (match) {
      const b = parseFloat(match[1]);
      if (b <= 1.6) faixa1.push(p.id);
      else if (b <= 4) faixa2.push(p.id);
      else faixa3.push(p.id);
    } else {
      anomalos++;
    }
    continue;
  }
  if (barras <= 1.6) faixa1.push(p.id);
  else if (barras <= 4) faixa2.push(p.id);
  else faixa3.push(p.id);
}

console.log(`Faixa 1–1.6B (EQ00509): ${faixa1.length}`);
console.log(`Faixa 2–4B   (EQ00659): ${faixa2.length}`);
console.log(`Faixa 4.1–8B (EQ00221): ${faixa3.length}`);
if (anomalos > 0) console.log(`Anômalos (não alterados): ${anomalos}`);

// 5. Aplicar
console.log('\n=== APLICANDO ===');

if (faixa1.length > 0) {
  const r = await db.update(products).set({
    driverDimDali: d509.modelo,
    custoDriverDimDali: d509.custo,
  }).where(inArray(products.id, faixa1));
  console.log(`Faixa 1–1.6B: ${(r as any)[0]?.affectedRows ?? faixa1.length} → ${d509.modelo}`);
}

if (faixa2.length > 0) {
  const r = await db.update(products).set({
    driverDimDali: d659.modelo,
    custoDriverDimDali: d659.custo,
  }).where(inArray(products.id, faixa2));
  console.log(`Faixa 2–4B:   ${(r as any)[0]?.affectedRows ?? faixa2.length} → ${d659.modelo}`);
}

if (faixa3.length > 0) {
  const r = await db.update(products).set({
    driverDimDali: d221.modelo,
    custoDriverDimDali: d221.custo,
  }).where(inArray(products.id, faixa3));
  console.log(`Faixa 4.1–8B: ${(r as any)[0]?.affectedRows ?? faixa3.length} → ${d221.modelo}`);
}

console.log('\nConcluído!');
