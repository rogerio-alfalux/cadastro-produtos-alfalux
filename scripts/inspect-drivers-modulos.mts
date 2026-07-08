import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const FAMILIAS_PERFIS = ["BLAZE","BLAZE H","EASY H PLUS","EASY PRIME","FLOW","HIT","MINI BLAZE","SKYLINE","SMART MINI","SOFT"];
const famPlaceholders = FAMILIAS_PERFIS.map(() => "?").join(",");

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Buscar todos os produtos das famílias de perfis (não customizados)
  const [rows] = await conn.query<any[]>(
    `SELECT id, familia, produto, sku, categoria,
      moduloLed, qtdModuloLed,
      moduloLed2700, moduloLed3000, moduloLed4000, moduloLed5000,
      qtdModuloLed2700, qtdModuloLed3000, qtdModuloLed4000, qtdModuloLed5000,
      driverOnoffBivolt, qtdDriverOnoffBivolt, custoOnoffBivolt,
      correnteDriver, custoLuminaria
    FROM products
    WHERE familia IN (${famPlaceholders}) AND categoria != 'CUSTOMIZADOS'
    ORDER BY familia, produto
    LIMIT 20`,
    FAMILIAS_PERFIS
  );

  // Analisar padrões de módulo LED
  const moduloPatterns = new Map<string, number>();
  for (const r of rows) {
    const mod = r.moduloLed || r.moduloLed2700 || "";
    const key = mod.includes("STRIPLINE") ? "STRIPLINE" : mod.includes("STRIPFLEX") ? "STRIPFLEX" : mod.substring(0, 30);
    moduloPatterns.set(key, (moduloPatterns.get(key) || 0) + 1);
  }
  console.log("\n=== PADRÕES DE MÓDULO LED (amostra de 20) ===");
  for (const [k, v] of [...moduloPatterns.entries()].sort((a,b) => b[1]-a[1])) {
    console.log(`  ${k}: ${v} produtos`);
  }

  // Analisar padrões de driver bivolt
  const driverPatterns = new Map<string, number>();
  for (const r of rows) {
    const d = r.driverOnoffBivolt || "";
    driverPatterns.set(d.substring(0, 60), (driverPatterns.get(d.substring(0, 60)) || 0) + 1);
  }
  console.log("\n=== PADRÕES DE DRIVER BIVOLT (amostra) ===");
  for (const [k, v] of [...driverPatterns.entries()].sort((a,b) => b[1]-a[1])) {
    console.log(`  "${k}": ${v}`);
  }

  // Analisar correntes
  const correntePatterns = new Map<string, number>();
  for (const r of rows) {
    const c = r.correnteDriver || "(vazio)";
    correntePatterns.set(c, (correntePatterns.get(c) || 0) + 1);
  }
  console.log("\n=== CORRENTES DO DRIVER (amostra) ===");
  for (const [k, v] of [...correntePatterns.entries()].sort((a,b) => b[1]-a[1])) {
    console.log(`  "${k}": ${v}`);
  }

  // Amostras com stripflex
  const comStripflex = rows.filter((r: any) => (r.moduloLed || "").includes("STRIPFLEX") || (r.moduloLed2700 || "").includes("STRIPFLEX"));
  console.log(`\n=== AMOSTRAS COM STRIPFLEX (primeiros 3) ===`);
  comStripflex.slice(0, 3).forEach((r: any) => {
    console.log(`  ${r.produto}`);
    console.log(`    moduloLed: ${r.moduloLed} (qtd: ${r.qtdModuloLed})`);
    console.log(`    moduloLed2700: ${r.moduloLed2700} (qtd: ${r.qtdModuloLed2700})`);
    console.log(`    moduloLed3000: ${r.moduloLed3000} (qtd: ${r.qtdModuloLed3000})`);
  });

  // Amostras com stripline
  const comStripline = rows.filter((r: any) => (r.moduloLed || "").includes("STRIPLINE") || (r.moduloLed2700 || "").includes("STRIPLINE"));
  console.log(`\n=== AMOSTRAS COM STRIPLINE (primeiros 3) ===`);
  comStripline.slice(0, 3).forEach((r: any) => {
    console.log(`  ${r.produto}`);
    console.log(`    moduloLed: ${r.moduloLed} (qtd: ${r.qtdModuloLed})`);
    console.log(`    moduloLed2700: ${r.moduloLed2700} (qtd: ${r.qtdModuloLed2700})`);
  });

  // Buscar EQ00220 e EQ00353 especificamente
  const [driversEspecificos] = await conn.query<any[]>(
    `SELECT codigo, modelo, tipo, custoDriver FROM components WHERE codigo IN ('EQ00220', 'EQ00353')`
  );
  console.log(`\n=== DRIVERS EQ00220 E EQ00353 ===`);
  driversEspecificos.forEach((d: any) => console.log(`  [${d.codigo}] ${d.modelo} | tipo: ${d.tipo} | custo: ${d.custoDriver}`));

  // Buscar STRIPLINEs disponíveis
  const [striplines] = await conn.query<any[]>(
    `SELECT codigo, modelo, tipo, custoDriver FROM components WHERE modelo LIKE '%STRIPLINE%' LIMIT 10`
  );
  console.log(`\n=== STRIPLINES DISPONÍVEIS ===`);
  striplines.forEach((s: any) => console.log(`  [${s.codigo}] ${s.modelo} | custo: ${s.custoDriver}`));

  await conn.end();
}

main().catch(console.error);
