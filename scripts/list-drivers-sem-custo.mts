import { getDb } from '../server/db.js';
import { products, components } from '../drizzle/schema.js';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

const allComps = await db.select({ modelo: components.modelo, custo: components.custo }).from(components);
const modeloCusto = new Map<string, number | null>();
for (const c of allComps) if (c.modelo) modeloCusto.set(c.modelo, c.custo);

const pares = [
  { driver: 'driverOnoff220',    custo: 'custoDriverOnoff220' },
  { driver: 'driverOnoffBivolt', custo: 'custoDriverOnoffBivolt' },
  { driver: 'driverDim110v',     custo: 'custoDriverDim110v' },
  { driver: 'driverDimDali',     custo: 'custoDriverDimDali' },
  { driver: 'driverDimTriac110v',custo: 'custoDriverDimTriac110v' },
  { driver: 'driverDimTriac220v',custo: 'custoDriverDimTriac220v' },
] as const;

const allProducts = await db.select().from(products);

// Coletar modelos não encontrados com contagem
const naoEncontrados = new Map<string, number>();

for (const produto of allProducts) {
  const p = produto as any;
  for (const { driver, custo } of pares) {
    const modelo = p[driver];
    const custoAtual = p[custo];
    if (modelo && (custoAtual === null || custoAtual === undefined || custoAtual === '')) {
      if (!modeloCusto.has(modelo)) {
        naoEncontrados.set(modelo, (naoEncontrados.get(modelo) ?? 0) + 1);
      }
    }
  }
  // Extras
  const extraFields = [
    'driverOnoff220Extra','driverOnoffBivoltExtra',
    'driverDim110vExtra','driverDimDaliExtra',
    'driverDimTriac110vExtra','driverDimTriac220vExtra',
  ];
  for (const ef of extraFields) {
    const raw = p[ef];
    if (!raw) continue;
    try {
      const extras = JSON.parse(raw) as Array<{ modelo: string; custo: any }>;
      for (const e of extras) {
        if (e.modelo && (e.custo === null || e.custo === undefined || e.custo === '')) {
          if (!modeloCusto.has(e.modelo)) {
            naoEncontrados.set(e.modelo, (naoEncontrados.get(e.modelo) ?? 0) + 1);
          }
        }
      }
    } catch {}
  }
}

// Ordenar por contagem decrescente
const sorted = [...naoEncontrados.entries()].sort((a, b) => b[1] - a[1]);

console.log(`\n=== MODELOS DE DRIVERS SEM CUSTO (não cadastrados como componente) ===`);
console.log(`Total de modelos distintos: ${sorted.length}\n`);
console.log('OCORRÊNCIAS | MODELO');
console.log('------------|' + '-'.repeat(80));
for (const [modelo, count] of sorted) {
  console.log(`${String(count).padStart(11)} | ${modelo}`);
}
