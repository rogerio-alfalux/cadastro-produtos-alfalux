/**
 * Script para popular o campo correnteDriver nos produtos existentes.
 * Usa a mesma lógica da função inferirCorrenteDriver do frontend.
 * Execute com: npx tsx scripts/populate-corrente-driver.mts
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

function inferirCorrenteDriver({
  produto,
  familia,
  moduloLed,
  semDriver,
}: {
  produto: string;
  familia: string;
  moduloLed: string;
  semDriver: boolean;
}): string | null {
  const prod = produto.toUpperCase();
  const fam  = familia.toUpperCase();
  const mod  = moduloLed.toUpperCase();

  if (semDriver) return null;
  if (mod.includes("FITA LED") || mod.includes("FITA")) return null;

  // ── PERFIS ──────────────────────────────────────────────────────────────────
  if (fam.includes("PERFIL") || prod.includes("PERFIL")) {
    if (prod.includes("STRIPLINE") || prod.includes("STRIP LINE")) {
      if (prod.includes("36W") || prod.includes("36 W")) return "programar em 250mA";
      return "programar em 350mA";
    }
    if ((prod.includes("36W") || prod.includes("36 W")) && prod.includes("BARRA DUPLA")) return "programar em 350mA";
    if (prod.includes("18W") || prod.includes("18 W")) return "programar em 350mA";
    if (prod.includes("26W") || prod.includes("26 W")) return "programar em 500mA";
    if (prod.includes("36W") || prod.includes("36 W")) return "programar em 350mA";
  }

  // ── LUMINÁRIAS COM LED COB ────────────────────────────────────────────────
  if (mod.includes("COB") || prod.includes("COB")) {
    if (prod.includes("13W") || prod.includes("13 W")) return "programar em 350mA";
    if (prod.includes("18W") || prod.includes("18 W")) return "programar em 500mA";
    if (prod.includes("26W") || prod.includes("26 W")) return "programar em 700mA";
    if (prod.includes("38W") || prod.includes("38 W")) return "programar em 1050mA";
  }

  // ── LUX ROUND ─────────────────────────────────────────────────────────────
  if (prod.includes("LUX ROUND")) {
    if (prod.includes("Ø80") || prod.includes("80MM") || prod.includes("80 MM")) return "programar em 350mA";
    if ((prod.includes("Ø120") || prod.includes("120MM") || prod.includes("120 MM")) && prod.includes("54")) return "programar em 350mA";
    if ((prod.includes("Ø120") || prod.includes("120MM") || prod.includes("120 MM")) && prod.includes("120")) {
      if (prod.includes("26W") || prod.includes("26 W")) return "programar em 350mA";
      if (prod.includes("36W") || prod.includes("36 W")) return "programar em 500mA";
    }
  }

  // ── MÓDULOS Ø50 e Ø67mm ──────────────────────────────────────────────────
  if (mod.includes("Ø50") || mod.includes("50MM") || mod.includes("50 MM") ||
      mod.includes("Ø67") || mod.includes("67MM") || mod.includes("67 MM") ||
      prod.includes("Ø50") || prod.includes("Ø67")) {
    return "programar em 350mA";
  }

  // ── PAINÉIS COM STRIPFLEX ────────────────────────────────────────────────
  if (mod.includes("STRIPFLEX") || prod.includes("STRIPFLEX")) {
    if (prod.includes("26W") || prod.includes("26 W")) return "programar em 500mA";
    return "programar em 350mA";
  }

  return null;
}

async function main() {
  const conn = await createConnection(DATABASE_URL);
  
  const [rows] = await conn.execute(
    "SELECT id, produto, familia, moduloLed, semDriver FROM products"
  ) as any[];

  let updated = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const row of rows) {
    const corrente = inferirCorrenteDriver({
      produto: row.produto || "",
      familia: row.familia || "",
      moduloLed: row.moduloLed || "",
      semDriver: Boolean(row.semDriver),
    });

    if (corrente === null) {
      // Produto sem corrente (FITA LED ou SEM DRIVER) — limpar o campo
      await conn.execute(
        "UPDATE products SET correnteDriver = NULL WHERE id = ?",
        [row.id]
      );
      skipped++;
    } else {
      await conn.execute(
        "UPDATE products SET correnteDriver = ? WHERE id = ?",
        [corrente, row.id]
      );
      updated++;
      console.log(`✓ [${row.id}] ${row.produto} → ${corrente}`);
    }
  }

  console.log(`\n✅ Concluído: ${updated} atualizados, ${skipped} sem corrente (FITA/SEM DRIVER), ${noMatch} sem correspondência`);
  await conn.end();
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
