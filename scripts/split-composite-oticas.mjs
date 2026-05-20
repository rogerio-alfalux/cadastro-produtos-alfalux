/**
 * Script de migração: separa óticas compostas (padrão "MODELO1 + NxMODELO2")
 * em ótica principal + oticaExtra JSON.
 *
 * Padrões reconhecidos:
 *   "LENTE DARKOO DK-15 + 3x LOUVER PRETO DK-S80"
 *   "LENTE X + LOUVER Y"
 *   "2x LENTE X + 3x LOUVER Y"  (já deveria ter sido tratado, mas cobre o caso)
 *
 * Regras:
 *   - Divide no primeiro " + " (case-insensitive)
 *   - Cada parte pode ter prefixo "Nx " ou "NX " indicando quantidade
 *   - Ótica principal: parte[0] → campo otica + qtdOtica
 *   - Óticas extras: parte[1..n] → oticaExtra JSON array [{modelo, qtd}]
 *   - Não altera produtos que já têm oticaExtra preenchido
 *   - Não altera produtos sem "+" no campo otica
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

function parseQtyPrefix(str) {
  str = str.trim();
  // Padrão: "Nx " ou "NX " no início (ex: "3x LOUVER", "3X LOUVER", "3 x LOUVER")
  const m = str.match(/^(\d+)\s*[xX]\s+(.+)$/);
  if (m) {
    return { qtd: parseInt(m[1], 10), modelo: m[2].trim().toUpperCase() };
  }
  return { qtd: 1, modelo: str.toUpperCase() };
}

function splitCompositeOtica(oticaStr) {
  if (!oticaStr || !oticaStr.includes('+')) return null;

  // Divide no " + " (com espaços ao redor)
  const parts = oticaStr.split(/\s+\+\s+/).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const principal = parseQtyPrefix(parts[0]);
  const extras = parts.slice(1).map(p => parseQtyPrefix(p));

  return { principal, extras };
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log('Conectado ao banco de dados.');

  // Buscar produtos com "+" no campo otica e sem oticaExtra já preenchido
  const [rows] = await conn.execute(
    `SELECT id, otica, qtdOtica, oticaExtra FROM products 
     WHERE otica LIKE '%+%' 
     AND (oticaExtra IS NULL OR oticaExtra = '' OR oticaExtra = '[]')`
  );

  console.log(`\nEncontrados ${rows.length} produtos com óticas compostas para migrar.\n`);

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const result = splitCompositeOtica(row.otica);
    if (!result) {
      skipped++;
      continue;
    }

    const { principal, extras } = result;
    const oticaExtraJson = JSON.stringify(extras);

    console.log(`[${row.id}] "${row.otica}"`);
    console.log(`  → Principal: "${principal.modelo}" (qtd=${principal.qtd})`);
    extras.forEach((e, i) => console.log(`  → Extra[${i}]: "${e.modelo}" (qtd=${e.qtd})`));

    await conn.execute(
      `UPDATE products SET otica = ?, qtdOtica = ?, oticaExtra = ? WHERE id = ?`,
      [principal.modelo, principal.qtd, oticaExtraJson, row.id]
    );

    migrated++;
  }

  await conn.end();

  console.log(`\n✅ Migração concluída:`);
  console.log(`   - ${migrated} produtos migrados`);
  console.log(`   - ${skipped} produtos ignorados (sem padrão reconhecido)`);
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
