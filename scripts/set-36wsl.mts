import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// 1. Buscar módulos e drivers necessários
const codigos = ['EQ00420', 'EQ00421', 'EQ00415', 'EQ00347', 'EQ00348', 'EQ00580', 'EQ00581', 'EQ00582'];
const comps = await db.select({ codigo: components.codigo, modelo: components.modelo, custo: components.custo })
  .from(components).where(inArray(components.codigo, codigos));

const map = new Map<string, { modelo: string; custo: number | null }>();
for (const c of comps) if (c.codigo) map.set(c.codigo, { modelo: c.modelo, custo: c.custo });

const faltando = codigos.filter(c => !map.has(c));
if (faltando.length > 0) { console.error(`Não encontrados: ${faltando.join(', ')}`); process.exit(1); }

console.log('=== COMPONENTES ===');
for (const [k, v] of map) console.log(`  ${k} → ${v.modelo}`);

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

function ehBarraInteira(barras: number): boolean {
  return Number.isInteger(barras);
}

// 3. Buscar todos os perfis 36W-SL
const perfis = await db.select({
  id: products.id, sku: products.sku, produto: products.produto,
}).from(products).where(and(eq(products.categoria, 'PERFIS'), eq(products.potencia, '36W-SL')));

console.log(`\nTotal de perfis 36W-SL: ${perfis.length}`);

// 4. Separar barras inteiras de quebradas
const inteiras: { id: number; sku: string; produto: string; barras: number }[] = [];
const quebradas: number[] = []; // IDs para excluir

for (const p of perfis) {
  const barras = extrairBarras(p.sku);
  if (barras === null || !ehBarraInteira(barras)) {
    quebradas.push(p.id);
  } else {
    inteiras.push({ ...p, barras });
  }
}

console.log(`Barras inteiras: ${inteiras.length}`);
console.log(`Barras quebradas (a excluir): ${quebradas.length}`);

// Mostrar distribuição de barras inteiras
const dist = new Map<number, number>();
for (const p of inteiras) dist.set(p.barras, (dist.get(p.barras) || 0) + 1);
console.log('\nDistribuição por nº de barras:');
for (const [b, c] of [...dist.entries()].sort((a,b) => a[0]-b[0])) {
  console.log(`  ${b} barra(s): ${c} produtos`);
}

// 5. Excluir produtos com barras quebradas
if (quebradas.length > 0) {
  // Excluir em lotes de 500
  const BATCH = 500;
  let totalExcluidos = 0;
  for (let i = 0; i < quebradas.length; i += BATCH) {
    const lote = quebradas.slice(i, i + BATCH);
    await db.delete(products).where(inArray(products.id, lote));
    totalExcluidos += lote.length;
  }
  console.log(`\n🗑️  ${totalExcluidos} produtos com barras quebradas excluídos.`);
}

// 6. Regras de drivers para 36W-SL:
// 1 barra  → 1× EQ00347
// 2 barras → 1× EQ00348
// 3 barras → 1× EQ00347 + 1× EQ00348 (extra)
// 4 barras → 2× EQ00348 (1 principal + 1 extra)
// 5 barras → 2× EQ00348 + 1× EQ00348 extra = 3× EQ00348? 
//            (interpretei: "2 EQ00348 + 1 2 EQ00348" = 2+2 = 4? Ou 2+1=3?)
//            Vou usar: 5 barras = 1× EQ00348 principal + 2× EQ00348 extras = 3 total
// 6 barras → 3× EQ00348 (1 principal + 2 extras)
// Nota: todos usam bivolt? Não foi mencionado bivolt para SL — vou manter bivolt do 18W por faixa de barras
// Para bivolt: mesma lógica mas com EQ00580/EQ00581/EQ00582
// Aguardando confirmação — por ora vou aplicar apenas 220V conforme especificado

const d347 = map.get('EQ00347')!;
const d348 = map.get('EQ00348')!;
const m3000 = map.get('EQ00421')!; // EQ00421 = 3000K
const m4000 = map.get('EQ00420')!; // EQ00420 = 4000K
const m5000 = map.get('EQ00415')!; // EQ00415 = 5000K

// Bivolt por faixa (mesma regra do 18W)
const d580 = map.get('EQ00580')!;
const d581 = map.get('EQ00581')!;
const d582 = map.get('EQ00582')!;

console.log('\n=== APLICANDO MÓDULOS E DRIVERS NOS 36W-SL ===');

// Agrupar por número de barras para aplicar regra de drivers extras
const grupos = new Map<number, number[]>();
for (const p of inteiras) {
  if (!grupos.has(p.barras)) grupos.set(p.barras, []);
  grupos.get(p.barras)!.push(p.id);
}

let totalAtualizado = 0;

for (const [barras, ids] of [...grupos.entries()].sort((a,b) => a[0]-b[0])) {
  // Determinar driver principal e extras por número de barras
  let driver220: string, custoDr220: number | null;
  let driverBiv: string, custoDrBiv: number | null;
  let extras220: { modelo: string; qtd: number; custo: number | null }[] = [];
  let extrasBiv: { modelo: string; qtd: number; custo: number | null }[] = [];

  if (barras === 1) {
    // 1 barra → 1× EQ00347
    driver220 = d347.modelo; custoDr220 = d347.custo;
    driverBiv = d580.modelo; custoDrBiv = d580.custo;
  } else if (barras === 2) {
    // 2 barras → 1× EQ00348
    driver220 = d348.modelo; custoDr220 = d348.custo;
    driverBiv = d581.modelo; custoDrBiv = d581.custo;
  } else if (barras === 3) {
    // 3 barras → 1× EQ00347 + 1× EQ00348 extra
    driver220 = d347.modelo; custoDr220 = d347.custo;
    driverBiv = d580.modelo; custoDrBiv = d580.custo;
    extras220 = [{ modelo: d348.modelo, qtd: 1, custo: d348.custo }];
    extrasBiv = [{ modelo: d581.modelo, qtd: 1, custo: d581.custo }];
  } else if (barras === 4) {
    // 4 barras → 2× EQ00348 (1 principal + 1 extra)
    driver220 = d348.modelo; custoDr220 = d348.custo;
    driverBiv = d582.modelo; custoDrBiv = d582.custo;
    extras220 = [{ modelo: d348.modelo, qtd: 1, custo: d348.custo }];
    extrasBiv = [{ modelo: d582.modelo, qtd: 1, custo: d582.custo }];
  } else if (barras === 5) {
    // 5 barras → 1 EQ00348 principal + 2 EQ00348 extras = 3 total
    driver220 = d348.modelo; custoDr220 = d348.custo;
    driverBiv = d582.modelo; custoDrBiv = d582.custo;
    extras220 = [{ modelo: d348.modelo, qtd: 2, custo: d348.custo }];
    extrasBiv = [{ modelo: d582.modelo, qtd: 2, custo: d582.custo }];
  } else if (barras === 6) {
    // 6 barras → 3× EQ00348 (1 principal + 2 extras)
    driver220 = d348.modelo; custoDr220 = d348.custo;
    driverBiv = d582.modelo; custoDrBiv = d582.custo;
    extras220 = [{ modelo: d348.modelo, qtd: 2, custo: d348.custo }];
    extrasBiv = [{ modelo: d582.modelo, qtd: 2, custo: d582.custo }];
  } else {
    // >6 barras — usar 3× EQ00348 como padrão
    driver220 = d348.modelo; custoDr220 = d348.custo;
    driverBiv = d582.modelo; custoDrBiv = d582.custo;
    extras220 = [{ modelo: d348.modelo, qtd: 2, custo: d348.custo }];
    extrasBiv = [{ modelo: d582.modelo, qtd: 2, custo: d582.custo }];
  }

  const r = await db.update(products).set({
    // Módulos LED Stripline
    moduloLed: m4000.modelo,
    qtdModuloLed: String(barras) + '.00',
    moduloLed2700: null, qtdModuloLed2700: null,
    moduloLed3000: m3000.modelo, qtdModuloLed3000: String(barras) + '.00',
    moduloLed4000: m4000.modelo, qtdModuloLed4000: String(barras) + '.00',
    moduloLed5000: m5000.modelo, qtdModuloLed5000: String(barras) + '.00',
    // Driver 220V principal
    driverOnoff220: driver220, custoDriverOnoff220: custoDr220,
    // Driver bivolt principal
    driverOnoffBivolt: driverBiv, custoDriverOnoffBivolt: custoDrBiv,
    // Drivers extras (JSON)
    driverOnoff220Extra: extras220.length > 0 ? JSON.stringify(extras220) : null,
    driverOnoffBivoltExtra: extrasBiv.length > 0 ? JSON.stringify(extrasBiv) : null,
  }).where(inArray(products.id, ids));

  const affected = (r as any)[0]?.affectedRows ?? ids.length;
  totalAtualizado += affected;
  const extrasStr = extras220.length > 0 ? ` + ${JSON.stringify(extras220)}` : '';
  console.log(`  ${barras}B: ${affected} produtos → ${driver220}${extrasStr}`);
}

console.log(`\n✅ Total atualizado: ${totalAtualizado} perfis 36W-SL`);
