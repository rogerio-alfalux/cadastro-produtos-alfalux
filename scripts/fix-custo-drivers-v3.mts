import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// Mapa modelo → custoDriver (campo correto nos componentes)
const allComps = await db.select({
  modelo: components.modelo,
  custo: components.custo,
  custoDriver: components.custoDriver,
}).from(components);

const modeloCusto = new Map<string, number | null>();
for (const c of allComps) {
  if (c.modelo && !modeloCusto.has(c.modelo)) {
    // Preferir custoDriver, fallback para custo
    const val = c.custoDriver ?? c.custo;
    modeloCusto.set(c.modelo, val);
  }
}
console.log(`Componentes no banco: ${modeloCusto.size}`);

// Verificar amostra
const xitanium = modeloCusto.get('LED DRIVER XITANIUM 19W 200-350MA 30-54VDC DS 230V');
console.log(`Custo XITANIUM 19W: ${xitanium}`);

// Pares de campos driver → custo
const pares = [
  { driver: 'driverOnoff220',    custo: 'custoDriverOnoff220' },
  { driver: 'driverOnoffBivolt', custo: 'custoDriverOnoffBivolt' },
  { driver: 'driverDim110v',     custo: 'custoDriverDim110v' },
  { driver: 'driverDimDali',     custo: 'custoDriverDimDali' },
  { driver: 'driverDimTriac110v',custo: 'custoDriverDimTriac110v' },
  { driver: 'driverDimTriac220v',custo: 'custoDriverDimTriac220v' },
] as const;

const IGNORAR = new Set(['NÃO APLICÁVEL', 'N/A', 'NÃO TEM OPÇÃO BIVOLT', 'NÃO APLICAVEL']);

const allProducts = await db.select().from(products);
console.log(`Total de produtos: ${allProducts.length}`);

let totalFixed = 0;
const semCadastro = new Map<string, number>();

for (const produto of allProducts) {
  const p = produto as any;
  const updateData: Record<string, any> = {};

  for (const { driver, custo } of pares) {
    const modelo: string | null = p[driver];
    if (!modelo || IGNORAR.has(modelo.trim())) continue;

    if (modeloCusto.has(modelo)) {
      updateData[custo] = modeloCusto.get(modelo);
    } else {
      semCadastro.set(modelo, (semCadastro.get(modelo) ?? 0) + 1);
    }
  }

  // Extras
  const extraFields = [
    'driverOnoff220Extra', 'driverOnoffBivoltExtra',
    'driverDim110vExtra', 'driverDimDaliExtra',
    'driverDimTriac110vExtra', 'driverDimTriac220vExtra',
  ] as const;

  for (const ef of extraFields) {
    const raw = p[ef];
    if (!raw) continue;
    try {
      const extras = JSON.parse(raw) as Array<{ modelo: string; qtd: number; custo: any }>;
      let changed = false;
      const fixed = extras.map(e => {
        if (!e.modelo || IGNORAR.has(e.modelo.trim())) return e;
        if (modeloCusto.has(e.modelo)) {
          changed = true;
          return { ...e, custo: modeloCusto.get(e.modelo) };
        } else {
          semCadastro.set(e.modelo, (semCadastro.get(e.modelo) ?? 0) + 1);
        }
        return e;
      });
      if (changed) updateData[ef] = JSON.stringify(fixed);
    } catch {}
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(products).set(updateData as any).where(eq(products.id, p.id));
    totalFixed++;
  }
}

console.log(`\n✅ Produtos atualizados: ${totalFixed}`);
if (semCadastro.size > 0) {
  console.log(`\n⚠️  Modelos NÃO encontrados no cadastro:`);
  for (const [modelo, count] of [...semCadastro.entries()].sort((a,b) => b[1]-a[1])) {
    console.log(`  ${String(count).padStart(5)}× ${modelo}`);
  }
}
console.log('\nConcluído!');
