/**
 * Script de migração: atualiza qtdOtica dos produtos EASY LED POINT
 * calculando a quantidade como N × M a partir do padrão "NxM" no nome do produto.
 *
 * Exemplos:
 *   "EASY LED POINT 3X3 ..." → qtdOtica = 3 × 3 = 9
 *   "EASY LED POINT 3X6 ..." → qtdOtica = 3 × 6 = 18
 *   "EASY LED POINT 4X5 ..." → qtdOtica = 4 × 5 = 20
 *   "EASY LED POINT 4X6 ..." → qtdOtica = 4 × 6 = 24
 *
 * Apenas altera qtdOtica. Não toca em nenhum outro campo.
 * Não altera produtos com otica = 'NÃO APLICÁVEL' ou otica vazia.
 */

import mysql from 'mysql2/promise';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

// Parsear URL para objeto de conexão mysql2 com SSL
function parseDbUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: parseInt(u.port || '4000', 10),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
      ssl: { rejectUnauthorized: true },
    };
  } catch (e) {
    throw new Error('URL de banco inválida: ' + e.message);
  }
}

function extractNxM(nomeProduto) {
  // Busca padrão NxM (case-insensitive) no nome: ex "3X3", "4X6", "3x6"
  const m = nomeProduto.match(/\b(\d+)[xX](\d+)\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  return n * mm;
}

async function main() {
  const conn = await mysql.createConnection(parseDbUrl(DATABASE_URL));
  console.log('Conectado ao banco de dados.\n');

  // Buscar todos os produtos EASY LED POINT com ótica ativa
  const [rows] = await conn.execute(
    `SELECT id, produto, otica, qtdOtica 
     FROM products 
     WHERE produto LIKE 'EASY LED POINT%'
     AND otica IS NOT NULL 
     AND otica != '' 
     AND otica != 'NÃO APLICÁVEL'
     ORDER BY produto`
  );

  console.log(`Encontrados ${rows.length} produtos EASY LED POINT com ótica ativa.\n`);

  let updated = 0;
  let skipped = 0;
  let noPattern = 0;

  // Agrupar por padrão NxM para exibir resumo
  const groups = {};

  for (const row of rows) {
    const qty = extractNxM(row.produto);
    if (qty === null) {
      console.log(`[SKIP - sem padrão NxM] ID=${row.id} | "${row.produto}"`);
      noPattern++;
      continue;
    }

    const key = `${qty}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ id: row.id, produto: row.produto, qtdAtual: row.qtdOtica });

    if (row.qtdOtica === qty) {
      skipped++;
      continue;
    }

    console.log(`[UPDATE] ID=${row.id} | "${row.produto}" | qtdOtica: ${row.qtdOtica} → ${qty}`);
    await conn.execute(
      `UPDATE products SET qtdOtica = ? WHERE id = ?`,
      [qty, row.id]
    );
    updated++;
  }

  await conn.end();

  console.log('\n📊 Resumo por quantidade calculada:');
  for (const [qty, items] of Object.entries(groups).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    console.log(`  qtd=${qty}: ${items.length} produto(s)`);
  }

  console.log(`\n✅ Migração concluída:`);
  console.log(`   - ${updated} produtos atualizados`);
  console.log(`   - ${skipped} produtos já com qtd correta (sem alteração)`);
  console.log(`   - ${noPattern} produtos sem padrão NxM no nome (não alterados)`);
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
