/**
 * Script: insert_led_bar_45.mjs
 * Cria os produtos da família LED BAR 45 baseados na LED BAR U.
 * Fotos:
 *   DA → /manus-storage/LEDBARU45DA_f060b5b9.png
 *   DB → /manus-storage/LEDBARU45DB_7f14c66e.png
 *   DC → /manus-storage/LEDBARU45DC_e3c2eeff.png
 */

import mysql from "mysql2/promise";

const FOTOS = {
  DA: "/manus-storage/LEDBARU45DA_f060b5b9.png",
  DB: "/manus-storage/LEDBARU45DB_7f14c66e.png",
  DC: "/manus-storage/LEDBARU45DC_e3c2eeff.png",
};

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

const url = new URL(DB_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port || "3306"),
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.replace("/", ""),
  ssl: { rejectUnauthorized: false },
});

console.log("Conectado ao banco de dados.");

// 1. Verificar se já existem produtos LED BAR 45
const [[existCheck]] = await conn.execute(
  "SELECT COUNT(*) as total FROM products WHERE familia = 'LED BAR 45'"
);
if (existCheck.total > 0) {
  console.log(`\nAVISO: Já existem ${existCheck.total} produtos da família LED BAR 45 no banco.`);
  console.log("Abortando para evitar duplicatas.");
  await conn.end();
  process.exit(0);
}

// 2. Buscar todos os produtos da família LED BAR U
const [rows] = await conn.execute(
  "SELECT * FROM products WHERE familia = 'LED BAR U' ORDER BY produto"
);

console.log(`\nEncontrados ${rows.length} produtos da família LED BAR U:`);
rows.forEach((r) => console.log(`  - ${r.produto} (SKU: ${r.sku})`));

if (rows.length === 0) {
  console.error("Nenhum produto encontrado.");
  await conn.end();
  process.exit(1);
}

// 3. Determinar foto pelo difusor no SKU
function getFoto(sku) {
  const upper = (sku || "").toUpperCase();
  if (upper.includes(" DA")) return { url: FOTOS.DA, key: null };
  if (upper.includes(" DB")) return { url: FOTOS.DB, key: null };
  if (upper.includes(" DC")) return { url: FOTOS.DC, key: null };
  return { url: null, key: null };
}

// 4. Criar lista de produtos a inserir
const toInsert = rows.map((r) => {
  const newSku = r.sku.replace(/LED BAR U/g, "LED BAR 45");
  const newProduto = r.produto.replace(/LED BAR U/g, "LED BAR 45");
  const { url: fotoUrl, key: fotoKey } = getFoto(newSku);

  return {
    categoria: r.categoria,
    instalacao: r.instalacao,
    familia: "LED BAR 45",
    sku: newSku,
    produto: newProduto,
    moduloLed: r.moduloLed,
    otica: r.otica,
    oticaNaoAplicavel: r.oticaNaoAplicavel,
    holder: r.holder,
    holderNaoAplicavel: r.holderNaoAplicavel,
    dissipador: r.dissipador,
    dissipadorNaoAplicavel: r.dissipadorNaoAplicavel,
    driverOnoff220: r.driverOnoff220,
    driverOnoffBivolt: r.driverOnoffBivolt,
    driverOnoffBivoltNaoAplicavel: r.driverOnoffBivoltNaoAplicavel,
    driverDim110v: r.driverDim110v,
    driverDim110vNaoAplicavel: r.driverDim110vNaoAplicavel,
    driverDimDali: r.driverDimDali,
    driverDimDaliNaoAplicavel: r.driverDimDaliNaoAplicavel,
    driverOnoff220Extra: r.driverOnoff220Extra,
    driverOnoffBivoltExtra: r.driverOnoffBivoltExtra,
    driverDim110vExtra: r.driverDim110vExtra,
    driverDimDaliExtra: r.driverDimDaliExtra,
    oticaExtra: r.oticaExtra,
    temperaturasCor: r.temperaturasCor,
    fotoUrl: fotoUrl,
    fotoKey: fotoKey,
    custoLuminaria: r.custoLuminaria,
    custoDriverOnoff220: r.custoDriverOnoff220,
    custoDriverOnoffBivolt: r.custoDriverOnoffBivolt,
    custoDriverDim110v: r.custoDriverDim110v,
    custoDriverDimDali: r.custoDriverDimDali,
    precoVendaOnoff220: r.precoVendaOnoff220,
    precoVendaOnoffBivolt: r.precoVendaOnoffBivolt,
    precoVendaDim110v: r.precoVendaDim110v,
    precoVendaDimDali: r.precoVendaDimDali,
  };
});

console.log("\nProdutos a serem criados:");
toInsert.forEach((p) =>
  console.log(`  - ${p.produto} (SKU: ${p.sku}) | Foto: ${p.fotoUrl ? "✓ " + p.fotoUrl : "sem foto"}`)
);

// 5. Inserir no banco
const columns = Object.keys(toInsert[0]);
const placeholders = columns.map(() => "?").join(", ");
const sql = `INSERT INTO products (${columns.join(", ")}) VALUES (${placeholders})`;

let inserted = 0;
let skipped = 0;

for (const p of toInsert) {
  const values = columns.map((c) => {
    const v = p[c];
    return v === undefined ? null : v;
  });

  try {
    await conn.execute(sql, values);
    inserted++;
    console.log(`  ✓ Inserido: ${p.produto}`);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      console.log(`  ⚠ Duplicata ignorada: ${p.produto}`);
      skipped++;
    } else {
      console.error(`  ✗ Erro ao inserir ${p.produto}:`, err.message);
    }
  }
}

console.log(`\nConcluído: ${inserted} inseridos, ${skipped} ignorados.`);
await conn.end();
