import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL!;

async function main() {
  const conn = await createConnection(DATABASE_URL);

  const mkpPadrao = 3.15;
  const mkpMinimo = 2.15;

  const [result] = await conn.execute(
    `UPDATE products SET
      mkpPadraoOnoff220v = ?,
      mkpMinimoOnoff220v = ?,
      mkpPadraoOnoffBivolt = ?,
      mkpMinimoOnoffBivolt = ?,
      mkpPadraoDim110v = ?,
      mkpMinimoDim110v = ?,
      mkpPadraoDimDali = ?,
      mkpMinimoDimDali = ?,
      mkpPadraoDimTriac110v = ?,
      mkpMinimoDimTriac110v = ?,
      mkpPadraoDimTriac220v = ?,
      mkpMinimoDimTriac220v = ?
    WHERE familia = 'HIT'`,
    [
      mkpPadrao, mkpMinimo,
      mkpPadrao, mkpMinimo,
      mkpPadrao, mkpMinimo,
      mkpPadrao, mkpMinimo,
      mkpPadrao, mkpMinimo,
      mkpPadrao, mkpMinimo,
    ]
  );

  console.log(`✅ HIT → Padrão: ${mkpPadrao} | Mínimo: ${mkpMinimo} | ${(result as any).affectedRows} produtos atualizados`);

  await conn.end();
}

main().catch(console.error);
