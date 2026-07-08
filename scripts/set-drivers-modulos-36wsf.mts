import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// 1. Buscar drivers e módulos pelo código EQ
const codigos = ['EQ00346', 'EQ00347', 'EQ00348', 'EQ00580', 'EQ00581', 'EQ00582', 'EQ00124', 'EQ00125', 'EQ00585'];

const comps = await db.select({
  codigo: components.codigo,
  modelo: components.modelo,
  custo: components.custo,
}).from(components).where(inArray(components.codigo, codigos));

const map = new Map<string, { modelo: string; custo: number | null }>();
for (const c of comps) {
  if (c.codigo) map.set(c.codigo, { modelo: c.modelo, custo: c.custo });
}

const faltando = codigos.filter(c => !map.has(c));
if (faltando.length > 0) { console.error(`Não encontrados: ${faltando.join(', ')}`); process.exit(1); }

console.log('=== COMPONENTES CARREGADOS ===');
for (const [k, v] of map) console.log(`  ${k} → ${v.modelo}`);

// 2. Função para extrair número de barras do SKU (mesmo padrão do 18W)
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

// 3. Buscar todos os perfis 36W-SF
const perfis = await db.select({
  id: products.id,
  sku: products.sku,
  produto: products.produto,
  qtdModuloLed: products.qtdModuloLed,
  qtdModuloLed2700: products.qtdModuloLed2700,
  qtdModuloLed3000: products.qtdModuloLed3000,
  qtdModuloLed4000: products.qtdModuloLed4000,
  qtdModuloLed5000: products.qtdModuloLed5000,
}).from(products).where(
  and(eq(products.categoria, 'PERFIS'), eq(products.potencia, '36W-SF'))
);

console.log(`\nTotal de perfis 36W-SF: ${perfis.length}`);

// 4. Classificar por faixa de barras e preparar updates individuais
// A quantidade de módulos é dobrada em relação ao 18W
// O SKU do 36W-SF é o mesmo do 18W (mesma base), então a extração de barras funciona igual

const d346 = map.get('EQ00346')!;
const d347 = map.get('EQ00347')!;
const d348 = map.get('EQ00348')!;
const d580 = map.get('EQ00580')!;
const d581 = map.get('EQ00581')!;
const d582 = map.get('EQ00582')!;
const m3000 = map.get('EQ00125')!;
const m4000 = map.get('EQ00124')!;
const m5000 = map.get('EQ00585')!;

// Agrupar IDs por faixa de driver
const faixa1: number[] = []; // ≤2 barras
const faixa2: number[] = []; // 2.1–5 barras
const faixa3: number[] = []; // >5 barras
let anomalos = 0;

// Para qtd dobrada, precisamos atualizar individualmente pois cada produto tem sua própria qtd
// Mas como todos os 36W-SF têm qtdModuloLed=1 (herdado do 18W), a qtd dobrada = 2 para todos
// Vamos verificar se há variação antes de assumir isso

const qtdUnicas = new Set(perfis.map(p => String(p.qtdModuloLed)));
console.log(`\nValores únicos de qtdModuloLed nos 36W-SF: ${[...qtdUnicas].join(', ')}`);

// Classificar por faixa de driver
for (const p of perfis) {
  const barras = extrairBarras(p.sku);
  if (barras === null || barras > 8) {
    // Tentar pelo nome
    const match = p.produto.toLowerCase().match(/(\d+\.?\d*)b\b/);
    if (match) {
      const b = parseFloat(match[1]);
      if (b <= 2) faixa1.push(p.id);
      else if (b <= 5) faixa2.push(p.id);
      else faixa3.push(p.id);
    } else {
      anomalos++;
    }
    continue;
  }
  if (barras <= 2) faixa1.push(p.id);
  else if (barras <= 5) faixa2.push(p.id);
  else faixa3.push(p.id);
}

console.log(`Faixa ≤2 barras: ${faixa1.length}`);
console.log(`Faixa 2.1-5 barras: ${faixa2.length}`);
console.log(`Faixa >5-8 barras: ${faixa3.length}`);
console.log(`Anômalos: ${anomalos}`);

// 5. Aplicar em cada faixa: drivers + módulos LED com qtd dobrada (qtdModuloLed=2, qtdModuloLedXXXX=2)
// Nota: qtdModuloLed2700 = null (2700K vazio)

console.log('\n=== APLICANDO ===');

if (faixa1.length > 0) {
  const r = await db.update(products).set({
    // Drivers
    driverOnoff220: d346.modelo, custoDriverOnoff220: d346.custo,
    driverOnoffBivolt: d580.modelo, custoDriverOnoffBivolt: d580.custo,
    // Módulos LED (qtd dobrada = 2)
    moduloLed: m4000.modelo,
    qtdModuloLed: '2.00',
    moduloLed2700: null, qtdModuloLed2700: null,
    moduloLed3000: m3000.modelo, qtdModuloLed3000: '2.00',
    moduloLed4000: m4000.modelo, qtdModuloLed4000: '2.00',
    moduloLed5000: m5000.modelo, qtdModuloLed5000: '2.00',
  }).where(inArray(products.id, faixa1));
  console.log(`Faixa ≤2: ${(r as any)[0]?.affectedRows ?? faixa1.length} atualizados → ${d346.modelo}`);
}

if (faixa2.length > 0) {
  const r = await db.update(products).set({
    driverOnoff220: d347.modelo, custoDriverOnoff220: d347.custo,
    driverOnoffBivolt: d581.modelo, custoDriverOnoffBivolt: d581.custo,
    moduloLed: m4000.modelo,
    qtdModuloLed: '2.00',
    moduloLed2700: null, qtdModuloLed2700: null,
    moduloLed3000: m3000.modelo, qtdModuloLed3000: '2.00',
    moduloLed4000: m4000.modelo, qtdModuloLed4000: '2.00',
    moduloLed5000: m5000.modelo, qtdModuloLed5000: '2.00',
  }).where(inArray(products.id, faixa2));
  console.log(`Faixa 2.1-5: ${(r as any)[0]?.affectedRows ?? faixa2.length} atualizados → ${d347.modelo}`);
}

if (faixa3.length > 0) {
  const r = await db.update(products).set({
    driverOnoff220: d348.modelo, custoDriverOnoff220: d348.custo,
    driverOnoffBivolt: d582.modelo, custoDriverOnoffBivolt: d582.custo,
    moduloLed: m4000.modelo,
    qtdModuloLed: '2.00',
    moduloLed2700: null, qtdModuloLed2700: null,
    moduloLed3000: m3000.modelo, qtdModuloLed3000: '2.00',
    moduloLed4000: m4000.modelo, qtdModuloLed4000: '2.00',
    moduloLed5000: m5000.modelo, qtdModuloLed5000: '2.00',
  }).where(inArray(products.id, faixa3));
  console.log(`Faixa >5: ${(r as any)[0]?.affectedRows ?? faixa3.length} atualizados → ${d348.modelo}`);
}

console.log('\nConcluído!');
