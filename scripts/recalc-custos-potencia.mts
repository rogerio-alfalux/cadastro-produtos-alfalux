import { getDb } from '../server/db.js';
import { products } from '../drizzle/schema.js';
import { eq, and, sql } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// Campos de custo a recalcular
const camposCusto = [
  'custoLuminaria',
  'custoCorpoOnoff220v',
  'custoCorpoOnoffBivolt',
  'custoCorpoDim110v',
  'custoCorpoDimDali',
  'custoCorpoDimTriac110v',
  'custoCorpoDimTriac220v',
  'custoCorpoOnoff220vD1D2',
  'custoCorpoOnoffBivoltD1D2',
  'custoCorpoDim110vD1D2',
  'custoCorpoDimDaliD1D2',
  'custoCorpoDimTriac110vD1D2',
  'custoCorpoDimTriac220vD1D2',
] as const;

// Buscar todos os perfis 18W com seus SKUs e custos
const perfis18 = await db.select().from(products)
  .where(and(eq(products.categoria, 'PERFIS'), eq(products.potencia, '18W')));

console.log(`Perfis 18W encontrados: ${perfis18.length}`);

// Montar mapa SKU-base → produto 18W
// O SKU dos perfis derivados é igual ao do 18W mas com sufixo de potência diferente
// Ex: 18W: LLE-2810.1IN.18F → 26W: LLE-2810.1IN.26F → base: LLE-2810.1IN
const mapBase = new Map<string, typeof perfis18[0]>();
for (const p of perfis18) {
  // Remove o sufixo de potência do SKU (ex: .18F, .18S)
  const base = p.sku.replace(/\.\d{2}[A-Z]$/, '');
  mapBase.set(base, p);
}

// Buscar perfis 26W e 36W
const perfis26 = await db.select().from(products)
  .where(and(eq(products.categoria, 'PERFIS'), eq(products.potencia, '26W')));
const perfis36SF = await db.select().from(products)
  .where(and(eq(products.categoria, 'PERFIS'), eq(products.potencia, '36W-SF')));
const perfis36SL = await db.select().from(products)
  .where(and(eq(products.categoria, 'PERFIS'), eq(products.potencia, '36W-SL')));

console.log(`Perfis 26W: ${perfis26.length}, 36W-SF: ${perfis36SF.length}, 36W-SL: ${perfis36SL.length}`);

let updated26 = 0, updated36 = 0, semBase = 0;

async function recalcular(
  perfis: typeof perfis18,
  fator: number,
  label: string
) {
  let updated = 0;
  for (const p of perfis) {
    const base = p.sku.replace(/\.\d{2}[A-Z]$/, '');
    const ref = mapBase.get(base);
    if (!ref) { semBase++; continue; }

    const updateData: Record<string, number | null> = {};
    for (const campo of camposCusto) {
      const val = (ref as any)[campo];
      if (val !== null && val !== undefined) {
        updateData[campo] = Math.round((Number(val) / fator) * 10000) / 10000;
      } else {
        updateData[campo] = null;
      }
    }

    await db.update(products).set(updateData as any).where(eq(products.id, p.id));
    updated++;
  }
  console.log(`${label}: ${updated} atualizados`);
  return updated;
}

console.log('\n=== RECALCULANDO CUSTOS ===');
updated26 = await recalcular(perfis26, 0.95, '26W (÷0.95 = +5%)');
updated36 = await recalcular([...perfis36SF, ...perfis36SL], 0.90, '36W-SF+SL (÷0.90 = +10%)');

if (semBase > 0) console.log(`Sem base 18W correspondente (não alterados): ${semBase}`);
console.log(`\nTotal: ${updated26 + updated36} produtos atualizados`);
console.log('Concluído!');
