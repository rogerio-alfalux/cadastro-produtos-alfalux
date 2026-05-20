/**
 * Script de migração: separa drivers compostos (padrão "NX modelo + NX modelo")
 * em driver principal + drivers extras (colunas *Extra como JSON).
 *
 * Lógica:
 *  - Detecta o padrão: "NX MODELO + NX MODELO [+ NX MODELO ...]"
 *    onde N é um número inteiro (ex: "1X", "2X", "3X")
 *  - Separa pelo " + " e para cada parte extrai: qtd e modelo
 *  - O primeiro item fica no campo principal (sem alteração no valor do campo,
 *    apenas normalizado para "MODELO" sem o prefixo "NX ")
 *  - Os demais itens vão para o campo *Extra como JSON array [{modelo, qtd, custo}]
 *
 * IMPORTANTE: Não altera a estrutura do banco, apenas atualiza os dados.
 * A API continua recebendo o campo principal normalmente.
 */

import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

// Parseia a URL mysql://user:pass@host:port/db?ssl=...
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
 * Tenta fazer o parse de um driver composto.
 * Retorna array de { modelo, qtd } ou null se não for composto.
 *
 * Padrões suportados:
 *   "1X PHILIPS XITANIUM 44W 250MA + 1X PHILIPS XITANIUM 65W 250MA"
 *   "2X LIFUD 30W 700MA + 1X OSRAM 20W"
 *   "1x MODELO A + 2x MODELO B + 1x MODELO C"
 */
function parseCompositeDriver(value) {
  if (!value || !value.includes('+')) return null;

  // Divide pelo " + " (com espaços ao redor)
  const parts = value.split(/\s*\+\s*/);
  if (parts.length < 2) return null;

  const result = [];
  for (const part of parts) {
    const trimmed = part.trim();
    // Verifica se começa com NX (número seguido de X, case insensitive)
    const match = trimmed.match(/^(\d+)[Xx]\s+(.+)$/);
    if (match) {
      result.push({
        qtd: parseInt(match[1]),
        modelo: match[2].trim().toUpperCase(),
      });
    } else {
      // Parte sem prefixo NX — trata como qtd=1
      result.push({ qtd: 1, modelo: trimmed.toUpperCase() });
    }
  }

  return result.length >= 2 ? result : null;
}

async function main() {
  const config = parseDbUrl(DB_URL);
  const conn = await mysql.createConnection(config);

  console.log('Conectado ao banco. Buscando produtos com drivers compostos...\n');

  // Busca todos os produtos que têm "+" em algum campo de driver
  const [rows] = await conn.execute(
    `SELECT id, driverOnoff220, driverOnoffBivolt, driverDim110v, driverDimDali,
            driverOnoff220Extra, driverOnoffBivoltExtra, driverDim110vExtra, driverDimDaliExtra,
            qtdDriverOnoff220, qtdDriverOnoffBivolt, qtdDriverDim110v, qtdDriverDimDali
     FROM products
     WHERE driverOnoff220 LIKE '%+%'
        OR driverOnoffBivolt LIKE '%+%'
        OR driverDim110v LIKE '%+%'
        OR driverDimDali LIKE '%+%'`
  );

  console.log(`Encontrados ${rows.length} produtos com drivers compostos.\n`);

  const driverFields = [
    { field: 'driverOnoff220',    extraField: 'driverOnoff220Extra',    qtdField: 'qtdDriverOnoff220' },
    { field: 'driverOnoffBivolt', extraField: 'driverOnoffBivoltExtra', qtdField: 'qtdDriverOnoffBivolt' },
    { field: 'driverDim110v',     extraField: 'driverDim110vExtra',     qtdField: 'qtdDriverDim110v' },
    { field: 'driverDimDali',     extraField: 'driverDimDaliExtra',     qtdField: 'qtdDriverDimDali' },
  ];

  let totalUpdated = 0;
  let totalSplits = 0;

  for (const row of rows) {
    const updates = {};
    let hasSplit = false;

    for (const { field, extraField, qtdField } of driverFields) {
      const value = row[field];
      if (!value || !value.includes('+')) continue;

      const parts = parseCompositeDriver(value);
      if (!parts) continue;

      // O primeiro item fica no campo principal
      const [first, ...rest] = parts;

      // Só atualiza se ainda não tem extras (para não sobrescrever migrações anteriores)
      const existingExtra = row[extraField];
      if (existingExtra && existingExtra !== 'null') {
        console.log(`  [SKIP] id=${row.id} campo=${field} já tem extras: ${existingExtra}`);
        continue;
      }

      updates[field] = first.modelo;
      updates[qtdField] = first.qtd;
      updates[extraField] = JSON.stringify(
        rest.map((d) => ({ modelo: d.modelo, qtd: d.qtd, custo: '' }))
      );

      console.log(`  [SPLIT] id=${row.id} campo=${field}:`);
      console.log(`    Original: "${value}"`);
      console.log(`    Principal: "${first.modelo}" (qtd=${first.qtd})`);
      rest.forEach((d, i) => console.log(`    Extra[${i}]: "${d.modelo}" (qtd=${d.qtd})`));

      hasSplit = true;
      totalSplits++;
    }

    if (hasSplit && Object.keys(updates).length > 0) {
      // Monta o SET dinâmico
      const setClauses = Object.keys(updates).map((k) => `\`${k}\` = ?`).join(', ');
      const values = [...Object.values(updates), row.id];
      await conn.execute(`UPDATE products SET ${setClauses} WHERE id = ?`, values);
      totalUpdated++;
    }
  }

  await conn.end();

  console.log(`\n✅ Migração concluída!`);
  console.log(`   Produtos atualizados: ${totalUpdated}`);
  console.log(`   Campos separados: ${totalSplits}`);
}

main().catch((err) => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
