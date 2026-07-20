import { createConnection } from "mysql2/promise";

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);

  const updates = [
    // BLAZE E: 2.75 / 2
    {
      label: "BLAZE E",
      padrao: 2.75,
      minimo: 2,
      where: `familia = 'BLAZE' AND produto LIKE 'BLAZE E%'`
    },
    // BLAZE S: 2.8 / 2
    {
      label: "BLAZE S",
      padrao: 2.8,
      minimo: 2,
      where: `familia = 'BLAZE' AND produto LIKE 'BLAZE S%'`
    },
    // BLAZE A: 2.8 / 2
    {
      label: "BLAZE A",
      padrao: 2.8,
      minimo: 2,
      where: `familia = 'BLAZE' AND produto LIKE 'BLAZE A%'`
    },
    // BLAZE P: 2.8 / 2
    {
      label: "BLAZE P",
      padrao: 2.8,
      minimo: 2,
      where: `familia = 'BLAZE' AND produto LIKE 'BLAZE P%'`
    },
    // BLAZE H P: 2.9 / 2
    {
      label: "BLAZE H P",
      padrao: 2.9,
      minimo: 2,
      where: `familia = 'BLAZE H'`
    },
    // MINI BLAZE P: 2.9 / 2
    {
      label: "MINI BLAZE P",
      padrao: 2.9,
      minimo: 2,
      where: `familia = 'MINI BLAZE' AND produto LIKE 'MINI BLAZE P%'`
    },
    // MINI BLAZE S: 2.75 / 2
    {
      label: "MINI BLAZE S",
      padrao: 2.75,
      minimo: 2,
      where: `familia = 'MINI BLAZE' AND produto LIKE 'MINI BLAZE S%'`
    },
  ];

  let totalUpdated = 0;

  for (const u of updates) {
    const sql = `UPDATE products SET
      mkpPadraoOnoff220v = ${u.padrao},
      mkpMinimoOnoff220v = ${u.minimo},
      mkpPadraoOnoffBivolt = ${u.padrao},
      mkpMinimoOnoffBivolt = ${u.minimo},
      mkpPadraoDim110v = ${u.padrao},
      mkpMinimoDim110v = ${u.minimo},
      mkpPadraoDimDali = ${u.padrao},
      mkpMinimoDimDali = ${u.minimo},
      mkpPadraoDimTriac110v = ${u.padrao},
      mkpMinimoDimTriac110v = ${u.minimo},
      mkpPadraoDimTriac220v = ${u.padrao},
      mkpMinimoDimTriac220v = ${u.minimo}
    WHERE ${u.where}`;

    const [result] = await conn.execute(sql);
    const affected = (result as any).affectedRows;
    totalUpdated += affected;
    console.log(`✅ ${u.label.padEnd(15)} → Padrão: ${u.padrao} | Mínimo: ${u.minimo} | ${affected} produtos`);
  }

  console.log(`\n🎯 Total atualizado: ${totalUpdated} produtos`);
  await conn.end();
}

main().catch(console.error);
