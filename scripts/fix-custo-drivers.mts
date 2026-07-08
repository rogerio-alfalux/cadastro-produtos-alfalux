import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { isNull, isNotNull, and, eq, inArray, or } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// Mapa modelo → custo (de todos os componentes do banco)
const allComps = await db.select({ modelo: components.modelo, custo: components.custo }).from(components);
const modeloCusto = new Map<string, number | null>();
for (const c of allComps) {
  if (c.modelo && !modeloCusto.has(c.modelo)) {
    modeloCusto.set(c.modelo, c.custo);
  }
}
console.log(`Componentes no banco: ${modeloCusto.size}`);

// Pares de campos driver → custo
const pares = [
  { driver: 'driverOnoff220',    custo: 'custoDriverOnoff220' },
  { driver: 'driverOnoffBivolt', custo: 'custoDriverOnoffBivolt' },
  { driver: 'driverDim110v',     custo: 'custoDriverDim110v' },
  { driver: 'driverDimDali',     custo: 'custoDriverDimDali' },
  { driver: 'driverDimTriac110v',custo: 'custoDriverDimTriac110v' },
  { driver: 'driverDimTriac220v',custo: 'custoDriverDimTriac220v' },
] as const;

// Buscar todos os produtos
const allProducts = await db.select().from(products);
console.log(`Total de produtos: ${allProducts.length}`);

let totalFixed = 0;
let totalNotFound = 0;

for (const produto of allProducts) {
  const p = produto as any;
  const updateData: Record<string, number | null> = {};

  for (const { driver, custo } of pares) {
    const modelo = p[driver];
    const custoAtual = p[custo];

    // Se driver preenchido e custo vazio/null
    if (modelo && (custoAtual === null || custoAtual === undefined || custoAtual === '')) {
      const custoComp = modeloCusto.get(modelo);
      if (custoComp !== undefined) {
        updateData[custo] = custoComp;
      } else {
        totalNotFound++;
      }
    }
  }

  // Também verificar extras (JSON) — preencher custo nos itens extras sem custo
  const extraFields = [
    'driverOnoff220Extra', 'driverOnoffBivoltExtra',
    'driverDim110vExtra', 'driverDimDaliExtra',
    'driverDimTriac110vExtra', 'driverDimTriac220vExtra',
  ] as const;

  for (const extraField of extraFields) {
    const raw = p[extraField];
    if (!raw) continue;
    try {
      const extras = JSON.parse(raw) as Array<{ modelo: string; qtd: number; custo: any }>;
      let changed = false;
      const fixed = extras.map(e => {
        if (e.modelo && (e.custo === null || e.custo === undefined || e.custo === '')) {
          const custoComp = modeloCusto.get(e.modelo);
          if (custoComp !== undefined) {
            changed = true;
            return { ...e, custo: custoComp };
          }
        }
        return e;
      });
      if (changed) updateData[extraField] = JSON.stringify(fixed) as any;
    } catch {}
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(products).set(updateData as any).where(eq(products.id, p.id));
    totalFixed++;
  }
}

console.log(`\n✅ Produtos corrigidos: ${totalFixed}`);
if (totalNotFound > 0) console.log(`⚠️  Modelos não encontrados no banco: ${totalNotFound}`);
console.log('Concluído!');
