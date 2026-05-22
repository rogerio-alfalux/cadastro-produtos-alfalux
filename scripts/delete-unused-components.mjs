/**
 * Script: delete-unused-components.mjs
 * Remove todos os componentes da tabela `components` que não são
 * referenciados em nenhum produto (campos diretos + campos JSON extras).
 *
 * Campos diretos verificados por tipo:
 *   DRIVER_ONOFF_220  → driverOnoff220
 *   DRIVER_ONOFF_BIVOLT → driverOnoffBivolt
 *   DRIVER_DIM_110V   → driverDim110v
 *   DRIVER_DIM_DALI   → driverDimDali
 *   OTICA             → otica
 *   HOLDER            → holder
 *   DISSIPADOR        → dissipador
 *   MODULO_LED        → moduloLed
 *
 * Campos JSON extras verificados (contêm arrays [{modelo, qtd, custo}]):
 *   DRIVER_ONOFF_220  → driverOnoff220Extra
 *   DRIVER_ONOFF_BIVOLT → driverOnoffBivoltExtra
 *   DRIVER_DIM_110V   → driverDim110vExtra
 *   DRIVER_DIM_DALI   → driverDimDaliExtra
 *   OTICA             → oticaExtra
 */

import mysql from 'mysql2/promise';

// DATABASE_URL vem do ambiente (injetado pelo runtime do projeto)
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL não encontrada no ambiente');

const u = new URL(dbUrl);
const conn = await mysql.createConnection({
  host: u.hostname,
  port: parseInt(u.port || '4000'),
  user: u.username,
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, ''),
  ssl: { rejectUnauthorized: false },
});

console.log('✅ Conectado ao banco de dados');

// Mapeamento tipo → coluna direta e coluna extra (JSON)
const TYPE_MAP = {
  DRIVER_ONOFF_220:   { col: 'driverOnoff220',   extraCol: 'driverOnoff220Extra' },
  DRIVER_ONOFF_BIVOLT:{ col: 'driverOnoffBivolt', extraCol: 'driverOnoffBivoltExtra' },
  DRIVER_DIM_110V:    { col: 'driverDim110v',     extraCol: 'driverDim110vExtra' },
  DRIVER_DIM_DALI:    { col: 'driverDimDali',     extraCol: 'driverDimDaliExtra' },
  OTICA:              { col: 'otica',             extraCol: 'oticaExtra' },
  HOLDER:             { col: 'holder',            extraCol: null },
  DISSIPADOR:         { col: 'dissipador',        extraCol: null },
  MODULO_LED:         { col: 'moduloLed',         extraCol: null },
};

// 1. Buscar todos os componentes
const [allComponents] = await conn.execute(
  'SELECT id, tipo, modelo FROM components ORDER BY tipo, modelo'
);
console.log(`\n📦 Total de componentes cadastrados: ${allComponents.length}`);

// 2. Buscar todos os produtos com campos relevantes
const [allProducts] = await conn.execute(
  `SELECT 
    driverOnoff220, driverOnoffBivolt, driverDim110v, driverDimDali,
    otica, holder, dissipador, moduloLed,
    driverOnoff220Extra, driverOnoffBivoltExtra, driverDim110vExtra, driverDimDaliExtra,
    oticaExtra
  FROM products`
);
console.log(`📋 Total de produtos: ${allProducts.length}`);

// 3. Construir set de modelos usados por tipo
const usedByType = {};
for (const tipo of Object.keys(TYPE_MAP)) usedByType[tipo] = new Set();

for (const p of allProducts) {
  for (const [tipo, { col, extraCol }] of Object.entries(TYPE_MAP)) {
    // Campo direto
    const val = p[col];
    if (val && val !== 'NÃO APLICÁVEL' && val !== 'NAO APLICAVEL') {
      usedByType[tipo].add(val.trim());
    }

    // Campo extra (JSON array)
    if (extraCol && p[extraCol]) {
      try {
        const extras = JSON.parse(p[extraCol]);
        if (Array.isArray(extras)) {
          for (const item of extras) {
            if (item?.modelo && item.modelo !== 'NÃO APLICÁVEL') {
              usedByType[tipo].add(item.modelo.trim());
            }
          }
        }
      } catch (_) {}
    }
  }
}

// 4. Identificar componentes não utilizados
const unused = [];
for (const comp of allComponents) {
  const used = usedByType[comp.tipo];
  if (!used) continue; // tipo desconhecido, pular
  if (!used.has(comp.modelo?.trim())) {
    unused.push(comp);
  }
}

console.log(`\n🔍 Componentes não utilizados encontrados: ${unused.length}`);

if (unused.length === 0) {
  console.log('✅ Nenhum componente para remover.');
  await conn.end();
  process.exit(0);
}

// 5. Exibir lista antes de deletar
const byType = {};
for (const c of unused) {
  if (!byType[c.tipo]) byType[c.tipo] = [];
  byType[c.tipo].push(c);
}

for (const [tipo, items] of Object.entries(byType)) {
  console.log(`\n  [${tipo}] — ${items.length} não utilizados:`);
  for (const item of items) {
    console.log(`    id=${item.id} "${item.modelo}"`);
  }
}

// 6. Deletar em lotes de 100
const ids = unused.map(c => c.id);
let deleted = 0;
const BATCH = 100;

for (let i = 0; i < ids.length; i += BATCH) {
  const batch = ids.slice(i, i + BATCH);
  const placeholders = batch.map(() => '?').join(',');
  await conn.execute(`DELETE FROM components WHERE id IN (${placeholders})`, batch);
  deleted += batch.length;
  console.log(`  Removidos ${deleted}/${ids.length}...`);
}

console.log(`\n✅ ${deleted} componentes não utilizados removidos com sucesso!`);

await conn.end();
