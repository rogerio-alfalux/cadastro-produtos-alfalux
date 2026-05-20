/**
 * Script de migração: extrai prefixo "NX " (ex: "2x", "3X") do início dos campos
 * de componentes (drivers, módulo LED, ótica, dissipador, holder) e coloca a
 * quantidade no campo qtd correspondente.
 *
 * Padrão detectado: valor começa com "NX " onde N é um inteiro >= 1
 * Ex: "2x LIFUD 30W 700MA LF/GIF030ES0700H 220V" → modelo="LIFUD 30W 700MA LF/GIF030ES0700H 220V", qtd=2
 *
 * Campos tratados:
 *   - driverOnoff220       → qtdDriverOnoff220
 *   - driverOnoffBivolt    → qtdDriverOnoffBivolt
 *   - driverDim110v        → qtdDriverDim110v
 *   - driverDimDali        → qtdDriverDimDali
 *   - moduloLed            → qtdModuloLed
 *   - otica                → qtdOtica
 *   - dissipador           → qtdDissipador
 *   - holder               → qtdHolder
 *
 * Também processa os campos *Extra (JSON arrays) para extrair prefixos de drivers extras.
 *
 * IMPORTANTE: Não altera a estrutura do banco. A API continua funcionando normalmente.
 */

import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

function parseDbUrl(url) {
  const u = new URL(url);
  const sslParam = u.searchParams.get('ssl');
  return {
    host: u.hostname,
    port: parseInt(u.port || '4000'),
    user: u.username,
    password: u.password,
    database: u.pathname.replace('/', ''),
    ssl: sslParam ? JSON.parse(sslParam) : { rejectUnauthorized: true },
  };
}

/**
 * Detecta se o valor começa com "NX " (ex: "2x ", "1X ", "3x ").
 * Retorna { qtd, modelo } ou null se não tiver prefixo.
 */
function extractQtyPrefix(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+)[Xx]\s+(.+)$/);
  if (!match) return null;
  const qtd = parseInt(match[1]);
  if (qtd <= 0) return null;
  return { qtd, modelo: match[2].trim() };
}

const FIELD_PAIRS = [
  { field: 'driverOnoff220',    qtdField: 'qtdDriverOnoff220',    extraField: 'driverOnoff220Extra' },
  { field: 'driverOnoffBivolt', qtdField: 'qtdDriverOnoffBivolt', extraField: 'driverOnoffBivoltExtra' },
  { field: 'driverDim110v',     qtdField: 'qtdDriverDim110v',     extraField: 'driverDim110vExtra' },
  { field: 'driverDimDali',     qtdField: 'qtdDriverDimDali',     extraField: 'driverDimDaliExtra' },
  { field: 'moduloLed',         qtdField: 'qtdModuloLed',         extraField: null },
  { field: 'otica',             qtdField: 'qtdOtica',             extraField: null },
  { field: 'dissipador',        qtdField: 'qtdDissipador',        extraField: null },
  { field: 'holder',            qtdField: 'qtdHolder',            extraField: null },
];

async function main() {
  const config = parseDbUrl(DB_URL);
  const conn = await mysql.createConnection(config);

  console.log('Conectado ao banco. Buscando produtos com prefixos NX...\n');

  // Monta a cláusula WHERE para buscar qualquer campo com prefixo NX
  const whereConditions = FIELD_PAIRS.map(({ field }) =>
    `\`${field}\` REGEXP '^[0-9]+[Xx] '`
  ).join(' OR ');

  // Também inclui campos extra com prefixo NX dentro do JSON
  const extraWhereConditions = FIELD_PAIRS
    .filter(p => p.extraField)
    .map(({ extraField }) => `\`${extraField}\` LIKE '%"modelo":"[0-9]%'`)
    .join(' OR ');

  const [rows] = await conn.execute(
    `SELECT id, ${FIELD_PAIRS.map(p => `\`${p.field}\`, \`${p.qtdField}\``).join(', ')},
            driverOnoff220Extra, driverOnoffBivoltExtra, driverDim110vExtra, driverDimDaliExtra
     FROM products
     WHERE ${whereConditions}`
  );

  console.log(`Encontrados ${rows.length} produtos com prefixos NX nos campos principais.\n`);

  let totalUpdated = 0;
  let totalFieldsFixed = 0;

  for (const row of rows) {
    const updates = {};
    let hasChanges = false;

    for (const { field, qtdField } of FIELD_PAIRS) {
      const value = row[field];
      if (!value) continue;

      const extracted = extractQtyPrefix(value);
      if (!extracted) continue;

      // Só atualiza se a qtd atual for 1 (padrão) ou se o campo ainda tem prefixo
      updates[field] = extracted.modelo;
      updates[qtdField] = extracted.qtd;

      console.log(`  [FIX] id=${row.id} campo=${field}:`);
      console.log(`    Original: "${value}"`);
      console.log(`    Modelo: "${extracted.modelo}" | Qtd: ${extracted.qtd}`);

      hasChanges = true;
      totalFieldsFixed++;
    }

    // Processa também os campos Extra (JSON arrays)
    const extraFields = [
      { extraField: 'driverOnoff220Extra' },
      { extraField: 'driverOnoffBivoltExtra' },
      { extraField: 'driverDim110vExtra' },
      { extraField: 'driverDimDaliExtra' },
    ];

    for (const { extraField } of extraFields) {
      const extraJson = row[extraField];
      if (!extraJson) continue;

      let extras;
      try {
        extras = JSON.parse(extraJson);
      } catch {
        continue;
      }

      if (!Array.isArray(extras) || extras.length === 0) continue;

      let changed = false;
      const newExtras = extras.map(item => {
        const extracted = extractQtyPrefix(item.modelo);
        if (extracted) {
          console.log(`  [FIX EXTRA] id=${row.id} campo=${extraField}:`);
          console.log(`    Original: "${item.modelo}"`);
          console.log(`    Modelo: "${extracted.modelo}" | Qtd: ${extracted.qtd}`);
          changed = true;
          totalFieldsFixed++;
          return { ...item, modelo: extracted.modelo, qtd: extracted.qtd };
        }
        return item;
      });

      if (changed) {
        updates[extraField] = JSON.stringify(newExtras);
        hasChanges = true;
      }
    }

    if (hasChanges && Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map(k => `\`${k}\` = ?`).join(', ');
      const values = [...Object.values(updates), row.id];
      await conn.execute(`UPDATE products SET ${setClauses} WHERE id = ?`, values);
      totalUpdated++;
    }
  }

  await conn.end();

  console.log(`\n✅ Migração concluída!`);
  console.log(`   Produtos atualizados: ${totalUpdated}`);
  console.log(`   Campos corrigidos: ${totalFieldsFixed}`);
}

main().catch(err => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
