import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// Buscar EQ00090
const [comp] = await db.select({ codigo: components.codigo, modelo: components.modelo, custo: components.custo })
  .from(components).where(eq(components.codigo, 'EQ00090'));

if (!comp) { console.error('EQ00090 não encontrado'); process.exit(1); }
console.log(`EQ00090 → ${comp.modelo}`);

// Função para extrair barras do SKU
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

// Buscar perfis 26W
const perfis = await db.select({ id: products.id, sku: products.sku, produto: products.produto })
  .from(products).where(and(eq(products.categoria, 'PERFIS'), eq(products.potencia, '26W')));

// Filtrar faixa 2.1–3.9 barras
const ids: number[] = [];
for (const p of perfis) {
  const barras = extrairBarras(p.sku);
  if (barras === null || barras > 8) {
    const match = p.produto.toLowerCase().match(/(\d+\.?\d*)b\b/);
    if (match) {
      const b = parseFloat(match[1]);
      if (b > 2 && b < 4) ids.push(p.id);
    }
    continue;
  }
  if (barras > 2 && barras < 4) ids.push(p.id);
}

console.log(`Perfis 26W com 2.1–3.9B: ${ids.length}`);

if (ids.length === 0) { console.log('Nada a atualizar.'); process.exit(0); }

// Aplicar: EQ00090 principal + 1× EQ00090 extra
const extras = [{ modelo: comp.modelo, qtd: 1, custo: comp.custo }];

const r = await db.update(products).set({
  driverDimDali: comp.modelo,
  custoDriverDimDali: comp.custo,
  driverDimDaliExtra: JSON.stringify(extras),
}).where(inArray(products.id, ids));

console.log(`✅ ${(r as any)[0]?.affectedRows ?? ids.length} perfis atualizados → 2× ${comp.modelo}`);
