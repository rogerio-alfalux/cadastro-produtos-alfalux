import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// 1. Buscar os modelos dos módulos LED pelos códigos EQ
const codigosNeeded = ['EQ00124', 'EQ00125', 'EQ00585'];

const modulos = await db.select({
  codigo: components.codigo,
  modelo: components.modelo,
  custo: components.custo,
}).from(components).where(
  inArray(components.codigo, codigosNeeded)
);

console.log('=== MÓDULOS LED ENCONTRADOS NO BANCO ===');
const moduloMap = new Map<string, { modelo: string; custo: number | null }>();
for (const m of modulos) {
  if (m.codigo) {
    moduloMap.set(m.codigo, { modelo: m.modelo, custo: m.custo });
    console.log(`${m.codigo} → ${m.modelo} (custo: R$${m.custo ?? 'N/A'})`);
  }
}

const faltando = codigosNeeded.filter(c => !moduloMap.has(c));
if (faltando.length > 0) {
  console.error(`\nERRO: Códigos não encontrados: ${faltando.join(', ')}`);
  process.exit(1);
}

// Mapeamento:
// EQ00125 → 3000K  (moduloLed3000)
// EQ00124 → 4000K  (moduloLed4000)
// EQ00585 → 5000K  (moduloLed5000)
// 2700K   → vazio  (moduloLed2700 = null)
// moduloLed (campo principal) → manter como está (ou usar o 4000K como referência?)

const m3000 = moduloMap.get('EQ00125')!;
const m4000 = moduloMap.get('EQ00124')!;
const m5000 = moduloMap.get('EQ00585')!;

console.log(`\n3000K → ${m3000.modelo}`);
console.log(`4000K → ${m4000.modelo}`);
console.log(`5000K → ${m5000.modelo}`);
console.log(`2700K → (vazio)`);

// 2. Atualizar todos os perfis 18W
const result = await db.update(products).set({
  moduloLed2700: null,
  moduloLed3000: m3000.modelo,
  moduloLed4000: m4000.modelo,
  moduloLed5000: m5000.modelo,
  // moduloLed (campo principal) — atualizar para o 4000K como referência padrão
  moduloLed: m4000.modelo,
}).where(
  and(
    eq(products.categoria, 'PERFIS'),
    eq(products.potencia, '18W')
  )
);

const affected = (result as any)[0]?.affectedRows ?? 0;
console.log(`\n✅ ${affected} perfis 18W atualizados com os novos módulos LED.`);
