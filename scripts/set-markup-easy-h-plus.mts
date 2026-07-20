import { getDb } from "../server/db.ts";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");

  // Primeiro, verificar quantos produtos EASY H PLUS existem
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as total FROM products
    WHERE familia LIKE '%EASY H PLUS%' OR produto LIKE '%EASY H PLUS%'
  `);
  const rows = countResult[0] as any[];
  console.log("Total EASY H PLUS:", rows[0]?.total ?? 0);

  // Verificar amostra de famílias com EASY
  const sampleResult = await db.execute(sql`
    SELECT DISTINCT familia FROM products
    WHERE familia LIKE '%EASY%'
    LIMIT 10
  `);
  const sampleRows = sampleResult[0] as any[];
  console.log("Famílias com EASY:", sampleRows.map((r: any) => r.familia));

  // Aplicar markup padrão 2.91 e mínimo 2.00 em todos os EASY H PLUS
  const updateResult = await db.execute(sql`
    UPDATE products SET
      mkpPadraoOnoff220v    = 2.9100,
      mkpMinimoOnoff220v    = 2.0000,
      mkpPadraoOnoffBivolt  = 2.9100,
      mkpMinimoOnoffBivolt  = 2.0000,
      mkpPadraoDim110v      = 2.9100,
      mkpMinimoDim110v      = 2.0000,
      mkpPadraoDimDali      = 2.9100,
      mkpMinimoDimDali      = 2.0000,
      mkpPadraoDimTriac110v = 2.9100,
      mkpMinimoDimTriac110v = 2.0000,
      mkpPadraoDimTriac220v = 2.9100,
      mkpMinimoDimTriac220v = 2.0000
    WHERE familia LIKE '%EASY H PLUS%' OR produto LIKE '%EASY H PLUS%'
  `);
  const updateRows = updateResult[0] as any;
  console.log(`\n✅ Produtos atualizados: ${updateRows.affectedRows}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
