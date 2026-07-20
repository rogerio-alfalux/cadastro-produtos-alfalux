import { getDb } from "../server/db.ts";
import { sql } from "drizzle-orm";

const markups: Record<string, { padrao: number; minimo: number }> = {
  "ALE-2423": { padrao: 3.00, minimo: 2.00 },
  "ALS-2142": { padrao: 2.50, minimo: 2.00 },
  "ALS-3103": { padrao: 2.50, minimo: 2.00 },
  "ALS-3140": { padrao: 2.50, minimo: 2.00 },
  "ALS-3462": { padrao: 2.50, minimo: 2.00 },
  "ALS-3750": { padrao: 2.50, minimo: 2.00 },
  "BAGEO SINUOSA E": { padrao: 4.00, minimo: 3.00 },
  "BLAZE": { padrao: 3.00, minimo: 2.00 },
  "BLAZE H": { padrao: 3.00, minimo: 2.00 },
  "EASY LED POINT": { padrao: 3.00, minimo: 2.00 },
  "EASY LED POINT S": { padrao: 3.00, minimo: 2.00 },
  "EASY PRIME": { padrao: 3.00, minimo: 2.00 },
  "FLOW": { padrao: 3.00, minimo: 2.00 },
  "HIT": { padrao: 2.00, minimo: 2.00 },
  "LEAVE": { padrao: 4.00, minimo: 3.00 },
  "LED BAR WW E": { padrao: 3.00, minimo: 2.00 },
  "LED BAR WW S": { padrao: 2.00, minimo: 2.00 },
  "LUNA SPOT": { padrao: 3.00, minimo: 2.00 },
  "MINI BAGEO S": { padrao: 7.00, minimo: 6.00 },
  "MINI ZEUS": { padrao: 3.00, minimo: 2.00 },
  "ORBITAL": { padrao: 3.00, minimo: 2.00 },
  "ORBITAL RE": { padrao: 2.50, minimo: 2.00 },
  "SHARP": { padrao: 3.00, minimo: 2.00 },
  "SKYLINE": { padrao: 3.00, minimo: 2.00 },
  "SMART MINI": { padrao: 3.00, minimo: 2.00 },
  "SOFT": { padrao: 3.00, minimo: 2.00 },
  "VEGA": { padrao: 2.50, minimo: 2.00 },
};

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");

  let totalUpdated = 0;

  for (const [familia, { padrao, minimo }] of Object.entries(markups)) {
    // Usar LIKE para pegar variações (ex: "EASY LED POINT S " com espaço)
    const result = await db.execute(sql`
      UPDATE products SET
        mkpPadraoOnoff220v    = ${padrao},
        mkpMinimoOnoff220v    = ${minimo},
        mkpPadraoOnoffBivolt  = ${padrao},
        mkpMinimoOnoffBivolt  = ${minimo},
        mkpPadraoDim110v      = ${padrao},
        mkpMinimoDim110v      = ${minimo},
        mkpPadraoDimDali      = ${padrao},
        mkpMinimoDimDali      = ${minimo},
        mkpPadraoDimTriac110v = ${padrao},
        mkpMinimoDimTriac110v = ${minimo},
        mkpPadraoDimTriac220v = ${padrao},
        mkpMinimoDimTriac220v = ${minimo}
      WHERE TRIM(familia) = ${familia}
        AND mkpPadraoOnoff220v IS NULL
    `);
    const rows = (result[0] as any).affectedRows;
    if (rows > 0) {
      console.log(`✅ ${familia.padEnd(20)} → Padrão: ${padrao} | Mínimo: ${minimo} | ${rows} produtos`);
      totalUpdated += rows;
    } else {
      console.log(`⚠️  ${familia.padEnd(20)} → 0 produtos (já preenchidos ou família não encontrada)`);
    }
  }

  console.log(`\n🎯 Total atualizado: ${totalUpdated} produtos`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
