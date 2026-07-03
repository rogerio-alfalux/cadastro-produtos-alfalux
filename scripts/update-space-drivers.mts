import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const NOVO_DRIVER = "STELLA STL22685";

const conn = await mysql.createConnection(process.env.DATABASE_URL!);

// Atualizar o driver BIVOLT de todos os produtos SPACE
const [result] = await conn.execute(
  `UPDATE products
   SET driverOnoffBivolt = ?
   WHERE familia LIKE '%SPACE%'`,
  [NOVO_DRIVER]
) as any[];

console.log(`\n✅ Produtos SPACE atualizados: ${result.affectedRows}`);
console.log(`   Driver BIVOLT substituído por: ${NOVO_DRIVER}\n`);

// Confirmar os dados atualizados
const [rows] = await conn.execute(
  `SELECT id, sku, produto, driverOnoffBivolt
   FROM products
   WHERE familia LIKE '%SPACE%'
   ORDER BY sku`
) as any[];

for (const r of rows) {
  console.log(`[${r.id}] ${r.sku} — ${r.produto}`);
  console.log(`  BIVOLT: ${r.driverOnoffBivolt}`);
}

await conn.end();
