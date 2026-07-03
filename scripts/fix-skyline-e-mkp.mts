import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const MKP = "2.9900";
const conn = await mysql.createConnection(process.env.DATABASE_URL!);

// 1. Ver todos os produtos SKYLINE (família = SKYLINE) para identificar os embutir
const [rows] = await conn.execute(
  `SELECT id, sku, produto, familia,
          mkpPadraoOnoff220v, mkpPadraoOnoffBivolt, mkpPadraoDim110v,
          mkpPadraoDimDali, mkpPadraoDimTriac110v, mkpPadraoDimTriac220v
   FROM products
   WHERE familia = 'SKYLINE'
   ORDER BY sku`
) as any[];

console.log(`\n=== Todos os produtos SKYLINE: ${rows.length} ===`);
for (const r of rows) {
  console.log(`[${r.id}] ${r.sku} — ${r.produto}`);
}

// 2. Filtrar apenas os embutir: produto contém " E " ou começa com "SKYLINE E "
const embutir = (rows as any[]).filter((r: any) => {
  const nome = String(r.produto ?? "").toUpperCase();
  return nome.includes(" E ") || nome.startsWith("SKYLINE E ");
});

console.log(`\n=== Produtos SKYLINE EMBUTIR identificados: ${embutir.length} ===`);
for (const r of embutir) {
  console.log(`[${r.id}] ${r.sku} — ${r.produto}`);
  console.log(`  220v=${r.mkpPadraoOnoff220v} | bivolt=${r.mkpPadraoOnoffBivolt} | dim110v=${r.mkpPadraoDim110v} | dali=${r.mkpPadraoDimDali} | triac110v=${r.mkpPadraoDimTriac110v} | triac220v=${r.mkpPadraoDimTriac220v}`);
}

if (embutir.length === 0) {
  console.log("❌ Nenhum produto SKYLINE embutir identificado!");
  await conn.end();
  process.exit(1);
}

// 3. Atualizar MKP padrão para 2,99 nos produtos embutir
const ids = embutir.map((r: any) => r.id);
const placeholders = ids.map(() => "?").join(",");

const [result] = await conn.execute(
  `UPDATE products SET
    mkpPadraoOnoff220v      = ?,
    mkpPadraoOnoffBivolt    = ?,
    mkpPadraoDim110v        = ?,
    mkpPadraoDimDali        = ?,
    mkpPadraoDimTriac110v   = ?,
    mkpPadraoDimTriac220v   = ?
   WHERE id IN (${placeholders})`,
  [MKP, MKP, MKP, MKP, MKP, MKP, ...ids]
) as any[];

console.log(`\n✅ ${result.affectedRows} produtos SKYLINE E (embutir) atualizados`);
console.log(`   Todos os MKP padrão → 2,99\n`);

// 4. Confirmar
const [updated] = await conn.execute(
  `SELECT id, sku, produto,
          mkpPadraoOnoff220v, mkpPadraoOnoffBivolt, mkpPadraoDim110v,
          mkpPadraoDimDali, mkpPadraoDimTriac110v, mkpPadraoDimTriac220v
   FROM products WHERE id IN (${placeholders})
   ORDER BY sku`,
  ids
) as any[];

for (const r of updated) {
  console.log(`[${r.id}] ${r.sku} | 220v=${r.mkpPadraoOnoff220v} | bivolt=${r.mkpPadraoOnoffBivolt} | dim110v=${r.mkpPadraoDim110v} | dali=${r.mkpPadraoDimDali} | triac110v=${r.mkpPadraoDimTriac110v} | triac220v=${r.mkpPadraoDimTriac220v}`);
}

await conn.end();
