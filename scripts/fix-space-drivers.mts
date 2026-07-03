import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const MODELO = "FONTE DE TENSÃO 72W 24V IP20 BIV EVO ULTRAFINA";

const conn = await mysql.createConnection(process.env.DATABASE_URL!);

// 1. Buscar o componente com todas as colunas de custo
const [comps] = await conn.execute(
  `SELECT id, modelo, custo, custoDriver FROM components WHERE modelo = ? AND tipo = 'DRIVER_ONOFF_BIVOLT'`,
  [MODELO]
) as any[];

if (comps.length === 0) {
  console.error("❌ Componente não encontrado!");
  await conn.end();
  process.exit(1);
}

const comp = comps[0];
console.log(`\nComponente: [${comp.id}] ${comp.modelo}`);
console.log(`  custo:       ${comp.custo}`);
console.log(`  custoDriver: ${comp.custoDriver}`);

// Usar custo ou custoDriver, o que estiver preenchido
const custoFinal = comp.custo ?? comp.custoDriver;
if (custoFinal === null || custoFinal === undefined) {
  console.error("❌ Nenhum custo encontrado no componente!");
  await conn.end();
  process.exit(1);
}

console.log(`\n→ Usando custo: R$ ${custoFinal}`);

// 2. Atualizar custoDriverOnoffBivolt nos produtos SPACE
const [result] = await conn.execute(
  `UPDATE products SET custoDriverOnoffBivolt = ? WHERE familia LIKE '%SPACE%'`,
  [custoFinal]
) as any[];

console.log(`\n✅ Custo atualizado em ${result.affectedRows} produtos SPACE`);
console.log(`   custoDriverOnoffBivolt = R$ ${custoFinal}\n`);

// 3. Confirmar
const [rows] = await conn.execute(
  `SELECT id, sku, produto, driverOnoffBivolt, custoDriverOnoffBivolt FROM products WHERE familia LIKE '%SPACE%' ORDER BY sku`
) as any[];

for (const r of rows) {
  console.log(`[${r.id}] ${r.sku} | driver: ${r.driverOnoffBivolt} | custo: R$ ${r.custoDriverOnoffBivolt}`);
}

await conn.end();
