import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { eq, and, inArray, or } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// 1. Buscar os modelos dos drivers pelos códigos EQ
const codigosNeeded = ['EQ00346', 'EQ00347', 'EQ00348', 'EQ00580', 'EQ00581', 'EQ00582'];

const drivers = await db.select({
  codigo: components.codigo,
  modelo: components.modelo,
  custo: components.custo,
}).from(components).where(
  inArray(components.codigo, codigosNeeded)
);

console.log('=== DRIVERS ENCONTRADOS NO BANCO ===');
const driverMap = new Map<string, { modelo: string; custo: number | null }>();
for (const d of drivers) {
  if (d.codigo) {
    driverMap.set(d.codigo, { modelo: d.modelo, custo: d.custo });
    console.log(`${d.codigo} → ${d.modelo} (custo: R$${d.custo ?? 'N/A'})`);
  }
}

// Verificar se todos foram encontrados
const faltando = codigosNeeded.filter(c => !driverMap.has(c));
if (faltando.length > 0) {
  console.error(`\nERRO: Códigos não encontrados: ${faltando.join(', ')}`);
  process.exit(1);
}

// 2. Função para extrair número de barras do SKU
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

// 3. Buscar todos os perfis 18W
const perfis18w = await db.select({
  id: products.id,
  sku: products.sku,
  produto: products.produto,
}).from(products).where(
  and(
    eq(products.categoria, 'PERFIS'),
    eq(products.potencia, '18W')
  )
);

console.log(`\nTotal de perfis 18W: ${perfis18w.length}`);

// 4. Classificar e agrupar por faixa
const faixa1: number[] = []; // ≤2 barras
const faixa2: number[] = []; // 2.1–5 barras
const faixa3: number[] = []; // >5 barras (inclui anômalos por nome)
const anomalos: { id: number; sku: string; produto: string }[] = [];

for (const p of perfis18w) {
  const barras = extrairBarras(p.sku);
  
  if (barras === null || barras > 8) {
    // Anômalo: verificar pelo nome do produto
    const nomeLower = p.produto.toLowerCase();
    // Extrair número de barras do nome (ex: "5.6B", "5B")
    const matchNome = nomeLower.match(/(\d+\.?\d*)b\b/);
    if (matchNome) {
      const b = parseFloat(matchNome[1]);
      if (b <= 2) faixa1.push(p.id);
      else if (b <= 5) faixa2.push(p.id);
      else faixa3.push(p.id);
    } else {
      anomalos.push(p);
    }
    continue;
  }
  
  if (barras <= 2) faixa1.push(p.id);
  else if (barras <= 5) faixa2.push(p.id);
  else faixa3.push(p.id);
}

console.log(`Faixa ≤2 barras: ${faixa1.length} produtos`);
console.log(`Faixa 2.1-5 barras: ${faixa2.length} produtos`);
console.log(`Faixa >5-8 barras: ${faixa3.length} produtos`);
if (anomalos.length > 0) {
  console.log(`Não classificados: ${anomalos.length}`);
  for (const a of anomalos) console.log(`  ID=${a.id} SKU=${a.sku} | ${a.produto}`);
}

// 5. Aplicar drivers por faixa
const d346 = driverMap.get('EQ00346')!;
const d347 = driverMap.get('EQ00347')!;
const d348 = driverMap.get('EQ00348')!;
const d580 = driverMap.get('EQ00580')!;
const d581 = driverMap.get('EQ00581')!;
const d582 = driverMap.get('EQ00582')!;

console.log('\n=== APLICANDO DRIVERS ===');

// Faixa 1: ≤2 barras → EQ00346 (220V) + EQ00580 (bivolt)
if (faixa1.length > 0) {
  const r1 = await db.update(products).set({
    driverOnoff220: d346.modelo,
    custoDriverOnoff220: d346.custo,
    driverOnoffBivolt: d580.modelo,
    custoDriverOnoffBivolt: d580.custo,
  }).where(inArray(products.id, faixa1));
  console.log(`Faixa ≤2: ${(r1 as any)[0]?.affectedRows ?? faixa1.length} atualizados → ${d346.modelo} / ${d580.modelo}`);
}

// Faixa 2: 2.1–5 barras → EQ00347 (220V) + EQ00581 (bivolt)
if (faixa2.length > 0) {
  const r2 = await db.update(products).set({
    driverOnoff220: d347.modelo,
    custoDriverOnoff220: d347.custo,
    driverOnoffBivolt: d581.modelo,
    custoDriverOnoffBivolt: d581.custo,
  }).where(inArray(products.id, faixa2));
  console.log(`Faixa 2.1-5: ${(r2 as any)[0]?.affectedRows ?? faixa2.length} atualizados → ${d347.modelo} / ${d581.modelo}`);
}

// Faixa 3: >5 barras → EQ00348 (220V) + EQ00582 (bivolt)
if (faixa3.length > 0) {
  const r3 = await db.update(products).set({
    driverOnoff220: d348.modelo,
    custoDriverOnoff220: d348.custo,
    driverOnoffBivolt: d582.modelo,
    custoDriverOnoffBivolt: d582.custo,
  }).where(inArray(products.id, faixa3));
  console.log(`Faixa >5: ${(r3 as any)[0]?.affectedRows ?? faixa3.length} atualizados → ${d348.modelo} / ${d582.modelo}`);
}

console.log('\nConcluído!');
