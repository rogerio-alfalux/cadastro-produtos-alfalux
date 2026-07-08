import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// 1. Buscar componentes necessários
const codigos = ['EQ00353', 'EQ00220', 'EQ00124', 'EQ00125', 'EQ00585'];
const comps = await db.select({ codigo: components.codigo, modelo: components.modelo, custo: components.custo })
  .from(components).where(inArray(components.codigo, codigos));

const map = new Map<string, { modelo: string; custo: number | null }>();
for (const c of comps) if (c.codigo) map.set(c.codigo, { modelo: c.modelo, custo: c.custo });

const faltando = codigos.filter(c => !map.has(c));
if (faltando.length > 0) { console.error(`Não encontrados: ${faltando.join(', ')}`); process.exit(1); }

console.log('=== COMPONENTES ===');
for (const [k, v] of map) console.log(`  ${k} → ${v.modelo}`);

const d353 = map.get('EQ00353')!; // ≤1.6B
const d220 = map.get('EQ00220')!; // >1.6B
const m3000 = map.get('EQ00125')!;
const m4000 = map.get('EQ00124')!;
const m5000 = map.get('EQ00585')!;

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

// 3. Buscar todos os perfis 26W
const perfis = await db.select({ id: products.id, sku: products.sku, produto: products.produto })
  .from(products).where(and(eq(products.categoria, 'PERFIS'), eq(products.potencia, '26W')));

console.log(`\nTotal de perfis 26W: ${perfis.length}`);

// 4. Classificar por faixa
const faixa1: number[] = []; // ≤1.6B → EQ00353
const faixa2: number[] = []; // >1.6B → EQ00220
let anomalos = 0;

for (const p of perfis) {
  const barras = extrairBarras(p.sku);
  if (barras === null || barras > 8) {
    // Tentar pelo nome do produto
    const match = p.produto.toLowerCase().match(/(\d+\.?\d*)b\b/);
    if (match) {
      const b = parseFloat(match[1]);
      if (b <= 1.6) faixa1.push(p.id);
      else faixa2.push(p.id);
    } else {
      anomalos++;
    }
    continue;
  }
  if (barras <= 1.6) faixa1.push(p.id);
  else faixa2.push(p.id);
}

console.log(`Faixa ≤1.6B (EQ00353): ${faixa1.length} produtos`);
console.log(`Faixa >1.6B (EQ00220): ${faixa2.length} produtos`);
if (anomalos > 0) console.log(`Anômalos (não alterados): ${anomalos}`);

// 5. Aplicar: mesmos módulos do 18W, driver 220V por faixa, SEM bivolt (limpar bivolt)
console.log('\n=== APLICANDO ===');

if (faixa1.length > 0) {
  const r = await db.update(products).set({
    // Módulos LED — mesmos do 18W (qtd=1)
    moduloLed: m4000.modelo,
    qtdModuloLed: '1.00',
    moduloLed2700: null, qtdModuloLed2700: null,
    moduloLed3000: m3000.modelo, qtdModuloLed3000: '1.00',
    moduloLed4000: m4000.modelo, qtdModuloLed4000: '1.00',
    moduloLed5000: m5000.modelo, qtdModuloLed5000: '1.00',
    // Driver 220V
    driverOnoff220: d353.modelo, custoDriverOnoff220: d353.custo,
    // Sem bivolt
    driverOnoffBivolt: null, custoDriverOnoffBivolt: null,
    driverOnoffBivoltNaoAplicavel: true,
  }).where(inArray(products.id, faixa1));
  console.log(`Faixa ≤1.6B: ${(r as any)[0]?.affectedRows ?? faixa1.length} atualizados → ${d353.modelo}`);
}

if (faixa2.length > 0) {
  const r = await db.update(products).set({
    moduloLed: m4000.modelo,
    qtdModuloLed: '1.00',
    moduloLed2700: null, qtdModuloLed2700: null,
    moduloLed3000: m3000.modelo, qtdModuloLed3000: '1.00',
    moduloLed4000: m4000.modelo, qtdModuloLed4000: '1.00',
    moduloLed5000: m5000.modelo, qtdModuloLed5000: '1.00',
    driverOnoff220: d220.modelo, custoDriverOnoff220: d220.custo,
    driverOnoffBivolt: null, custoDriverOnoffBivolt: null,
    driverOnoffBivoltNaoAplicavel: true,
  }).where(inArray(products.id, faixa2));
  console.log(`Faixa >1.6B: ${(r as any)[0]?.affectedRows ?? faixa2.length} atualizados → ${d220.modelo}`);
}

console.log('\nConcluído!');
