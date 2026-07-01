/**
 * Copia as configurações do produto EASY LED POINT 1x3 10° para todos os produtos
 * com esse nome no banco.
 *
 * Configurações a copiar (conforme imagem):
 * - Ótica primária: LENTE OTICA 30X80MM 3 PONTOS 10° - DK-72-ZJ-BK-10DEG
 * - Ótica secundária: SUPORTE P/ LENTE PC PLASTIC COLOR BLACK 80X30MM 3 PONTOS ANTI DAZZLE FRAME DARKOO
 * - Holder: NÃO APLICÁVEL (holderNaoAplicavel = true)
 * - Dissipador: NÃO APLICÁVEL (dissipadorNaoAplicavel = true)
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

// Configurações a aplicar
const OTICA_PRIMARIA = "LENTE OTICA 30X80MM 3 PONTOS 10° - DK-72-ZJ-BK-10DEG";
const OTICA_SECUNDARIA = "SUPORTE P/ LENTE PC PLASTIC COLOR BLACK 80X30MM 3 PONTOS ANTI DAZZLE FRAME DARKOO";
const OTICA_EXTRA_JSON = JSON.stringify([{ modelo: OTICA_SECUNDARIA, qtd: 1 }]);

async function main() {
  const conn = await createConnection(DATABASE_URL);

  // Buscar todos os produtos EASY LED POINT 1x3 10°
  const [rows] = await conn.execute(
    "SELECT id, sku, produto, otica, oticaExtra, holder, holderNaoAplicavel, dissipador, dissipadorNaoAplicavel FROM products WHERE produto LIKE '%EASY LED POINT%1x3%10%' ORDER BY id"
  ) as any[];

  console.log(`\n📋 Produtos encontrados: ${rows.length}\n`);
  for (const row of rows) {
    console.log(`  [${row.id}] ${row.sku} — ${row.produto}`);
    console.log(`    otica atual: ${row.otica}`);
    console.log(`    oticaExtra atual: ${row.oticaExtra}`);
    console.log(`    holder atual: ${row.holder} (naoAplicavel: ${row.holderNaoAplicavel})`);
    console.log(`    dissipador atual: ${row.dissipador} (naoAplicavel: ${row.dissipadorNaoAplicavel})`);
  }

  console.log(`\n🔄 Aplicando configurações...\n`);

  let updated = 0;
  for (const row of rows) {
    await conn.execute(
      `UPDATE products SET
        otica = ?,
        oticaNaoAplicavel = 0,
        oticaExtra = ?,
        holder = 'NÃO APLICÁVEL',
        holderNaoAplicavel = 1,
        dissipador = 'NÃO APLICÁVEL',
        dissipadorNaoAplicavel = 1
      WHERE id = ?`,
      [OTICA_PRIMARIA, OTICA_EXTRA_JSON, row.id]
    );
    console.log(`  ✓ [${row.id}] ${row.produto}`);
    updated++;
  }

  console.log(`\n✅ Concluído: ${updated} produtos atualizados`);
  await conn.end();
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
