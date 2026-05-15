import { createConnection } from "mysql2/promise";
import XLSX from "xlsx";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const EXCEL_PATH = "/home/ubuntu/upload/DRIVER_LOOKUP_ALFALUX_LUMINARIAS_R01_(14-05-2026).xlsx";

// Column mapping based on actual Excel structure (uses __EMPTY_N keys)
// Row 0 is header: __EMPTY_1=INSTALAÇÃO, __EMPTY_2=SKU, __EMPTY_3=FAMÍLIA, etc.
const COL_MAP = {
  instalacao: "__EMPTY_1",
  sku: "__EMPTY_2",
  familia: "__EMPTY_3",
  produto: "__EMPTY_4",
  holder: "__EMPTY_5",
  otica: "__EMPTY_6",
  dissipador: "__EMPTY_7",
  moduloLed: "__EMPTY_8",
  driverOnoff220: "__EMPTY_9",
  driverOnoffBivolt: "__EMPTY_10",
  driverDim110v: "__EMPTY_11",
  driverDimDali: "__EMPTY_12",
};

// For PAINÉIS sheet (different column order: no HOLDER, ÓTICA, DISSIPADOR)
const COL_MAP_PAINEIS = {
  instalacao: "__EMPTY_1",
  sku: "__EMPTY_2",
  familia: "__EMPTY_3",
  produto: "__EMPTY_4",
  moduloLed: "__EMPTY_5",
  driverOnoff220: "__EMPTY_6",
  driverOnoffBivolt: "__EMPTY_7",
  driverDim110v: "__EMPTY_8",
  driverDimDali: "__EMPTY_9",
};

async function seed() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not found");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const conn = await createConnection(dbUrl);

  // Check if products already exist
  const [rows] = await conn.execute("SELECT COUNT(*) as count FROM products");
  const count = rows[0].count;
  if (count > 0) {
    console.log(`Database already has ${count} products. Skipping seed.`);
    await conn.end();
    return;
  }

  console.log("Reading Excel file...");
  const wb = XLSX.readFile(EXCEL_PATH);
  const allProducts = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    // Read all rows as array of arrays (header: 1 means no header processing)
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    // First row is header row
    // Data rows start from index 1
    const isPaineis = sheetName.toUpperCase().includes("PAINEL");

    console.log(`\nSheet: ${sheetName} — ${rawData.length - 1} data rows`);

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length < 3) continue;

      // Column indices based on actual data (0-indexed, col 0 is empty)
      const sku = String(row[2] || "").trim();
      const produto = String(row[4] || "").trim();

      if (!sku || !produto) continue;

      let oticaRaw, holderRaw, dissipadorRaw, moduloLed, driverOnoff220, driverOnoffBivolt, driverDim110v, driverDimDali;

      if (isPaineis) {
        // PAINÉIS: instalacao[1], sku[2], familia[3], produto[4], moduloLed[5], onoff220[6], onoffBivolt[7], dim110v[8], dimDali[9]
        moduloLed = String(row[5] || "").trim().toUpperCase();
        driverOnoff220 = String(row[6] || "").trim().toUpperCase();
        driverOnoffBivolt = String(row[7] || "").trim().toUpperCase();
        driverDim110v = String(row[8] || "").trim().toUpperCase() || null;
        driverDimDali = String(row[9] || "").trim().toUpperCase() || null;
        oticaRaw = "NÃO APLICÁVEL";
        holderRaw = "NÃO APLICÁVEL";
        dissipadorRaw = "NÃO APLICÁVEL";
      } else {
        // DOWNLIGHTS: instalacao[1], sku[2], familia[3], produto[4], holder[5], otica[6], dissipador[7], moduloLed[8], onoff220[9], onoffBivolt[10], dim110v[11], dimDali[12]
        holderRaw = String(row[5] || "").trim().toUpperCase();
        oticaRaw = String(row[6] || "").trim().toUpperCase();
        dissipadorRaw = String(row[7] || "").trim().toUpperCase();
        moduloLed = String(row[8] || "").trim().toUpperCase();
        driverOnoff220 = String(row[9] || "").trim().toUpperCase();
        driverOnoffBivolt = String(row[10] || "").trim().toUpperCase();
        driverDim110v = String(row[11] || "").trim().toUpperCase() || null;
        driverDimDali = String(row[12] || "").trim().toUpperCase() || null;
      }

      const oticaNaoAplicavel = !oticaRaw || oticaRaw === "NÃO APLICÁVEL" || oticaRaw === "NAO APLICAVEL";
      const holderNaoAplicavel = !holderRaw || holderRaw === "NÃO APLICÁVEL" || holderRaw === "NAO APLICAVEL";
      const dissipadorNaoAplicavel = !dissipadorRaw || dissipadorRaw === "NÃO APLICÁVEL" || dissipadorRaw === "NAO APLICAVEL";

      allProducts.push({
        categoria: sheetName.toUpperCase(),
        instalacao: String(row[1] || "").trim().toUpperCase(),
        familia: String(row[3] || "").trim().toUpperCase(),
        sku: sku.toUpperCase(),
        produto: produto.toUpperCase(),
        moduloLed: moduloLed || "",
        otica: oticaNaoAplicavel ? "NÃO APLICÁVEL" : oticaRaw,
        oticaNaoAplicavel: oticaNaoAplicavel ? 1 : 0,
        holder: holderNaoAplicavel ? "NÃO APLICÁVEL" : holderRaw,
        holderNaoAplicavel: holderNaoAplicavel ? 1 : 0,
        dissipador: dissipadorNaoAplicavel ? "NÃO APLICÁVEL" : dissipadorRaw,
        dissipadorNaoAplicavel: dissipadorNaoAplicavel ? 1 : 0,
        driverOnoff220: driverOnoff220 || "",
        driverOnoffBivolt: driverOnoffBivolt || "",
        driverDim110v: driverDim110v || null,
        driverDimDali: driverDimDali || null,
        temperaturasCor: '["2700","3000","4000","5000"]',
      });
    }
  }

  console.log(`\nTotal products to insert: ${allProducts.length}`);

  if (allProducts.length === 0) {
    console.log("No products found!");
    await conn.end();
    return;
  }

  // Insert in batches
  let inserted = 0;
  for (const p of allProducts) {
    try {
      await conn.execute(
        `INSERT INTO products 
         (categoria, instalacao, familia, sku, produto, moduloLed, otica, oticaNaoAplicavel, 
          holder, holderNaoAplicavel, dissipador, dissipadorNaoAplicavel, 
          driverOnoff220, driverOnoffBivolt, driverDim110v, driverDimDali, temperaturasCor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.categoria, p.instalacao, p.familia, p.sku, p.produto,
          p.moduloLed, p.otica, p.oticaNaoAplicavel,
          p.holder, p.holderNaoAplicavel, p.dissipador, p.dissipadorNaoAplicavel,
          p.driverOnoff220, p.driverOnoffBivolt, p.driverDim110v, p.driverDimDali,
          p.temperaturasCor
        ]
      );
      inserted++;
      if (inserted % 50 === 0) console.log(`Inserted ${inserted}/${allProducts.length}...`);
    } catch (err) {
      console.error(`Error inserting product ${p.sku}:`, err.message);
    }
  }

  console.log(`\n✅ Seed complete! ${inserted} products inserted.`);
  await conn.end();
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
