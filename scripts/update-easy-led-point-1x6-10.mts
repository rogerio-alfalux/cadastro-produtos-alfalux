/**
 * Copia as configurações do produto EASY LED POINT 1x6 10° para todos os produtos
 * com esse nome no banco.
 *
 * Configurações a copiar (conforme imagem):
 * - Módulo 2700K: MODULO LINEAR 6 LEDS 927-2700K 1300LM 154X23MM CNB (P0001839) 18V (qtd 1)
 * - Módulo 3000K: MODULO LINEAR 6 LEDS 930-3000K 1300LM 154X23MM CNB (P0001840) 18V (qtd 1)
 * - Módulo 4000K: MODULO LINEAR 6 LEDS 840-4000K 1500LM 154X23MM CNB (P0000787) 18V/700MA (qtd 1)
 * - Módulo 5000K: vazio (desabilitado)
 * - Ótica primária: LENTE OTICA 6 PONTOS 10° - DK-151-ZJ-6H1-BK-10DEG (qtd 1)
 * - Ótica secundária: SUPORTE P/ LENTE PC PLASTIC COLOR BLACK 159X30MM 6 PONTOS ANTI DAZZLE FRAME DARKOO (qtd 1)
 * - Holder: NÃO APLICÁVEL (holderNaoAplicavel = true)
 * - Dissipador: NÃO APLICÁVEL (dissipadorNaoAplicavel = true)
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

const OTICA_PRIMARIA = "LENTE OTICA 6 PONTOS 10° - DK-151-ZJ-6H1-BK-10DEG";
const OTICA_SECUNDARIA = "SUPORTE P/ LENTE PC PLASTIC COLOR BLACK 159X30MM 6 PONTOS ANTI DAZZLE FRAME DARKOO";
const OTICA_EXTRA_JSON = JSON.stringify([{ modelo: OTICA_SECUNDARIA, qtd: 1 }]);

const MODULO_2700K = "MODULO LINEAR 6 LEDS 927-2700K 1300LM 154X23MM CNB (P0001839) 18V";
const MODULO_3000K = "MODULO LINEAR 6 LEDS 930-3000K 1300LM 154X23MM CNB (P0001840) 18V";
const MODULO_4000K = "MODULO LINEAR 6 LEDS 840-4000K 1500LM 154X23MM CNB (P0000787) 18V/700MA";

async function main() {
  const conn = await createConnection(DATABASE_URL);

  // Buscar todos os produtos EASY LED POINT 1x6 10°
  const [rows] = await conn.execute(
    "SELECT id, sku, produto, otica, oticaExtra, holder, holderNaoAplicavel, dissipador, dissipadorNaoAplicavel, moduloLed2700, moduloLed3000, moduloLed4000, moduloLed5000 FROM products WHERE produto LIKE '%EASY LED POINT%1x6%10%' ORDER BY id"
  ) as any[];

  console.log(`\n📋 Produtos encontrados: ${rows.length}\n`);
  for (const row of rows) {
    console.log(`  [${row.id}] ${row.sku} — ${row.produto}`);
    console.log(`    otica: ${row.otica}`);
    console.log(`    oticaExtra: ${row.oticaExtra}`);
    console.log(`    holder: ${row.holder} (naoAplicavel: ${row.holderNaoAplicavel})`);
    console.log(`    dissipador: ${row.dissipador} (naoAplicavel: ${row.dissipadorNaoAplicavel})`);
    console.log(`    2700K: ${row.moduloLed2700}`);
    console.log(`    3000K: ${row.moduloLed3000}`);
    console.log(`    4000K: ${row.moduloLed4000}`);
    console.log(`    5000K: ${row.moduloLed5000}`);
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
        dissipadorNaoAplicavel = 1,
        moduloLed2700 = ?,
        moduloLed3000 = ?,
        moduloLed4000 = ?,
        moduloLed5000 = ''
      WHERE id = ?`,
      [OTICA_PRIMARIA, OTICA_EXTRA_JSON, MODULO_2700K, MODULO_3000K, MODULO_4000K, row.id]
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
