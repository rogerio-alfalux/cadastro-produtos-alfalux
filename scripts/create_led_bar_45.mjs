/**
 * Script: create_led_bar_45.mjs
 * Consulta todos os produtos da família LED BAR U e cria cópias como LED BAR 45,
 * substituindo nome, família e SKU conforme as regras definidas.
 * As URLs de foto são passadas como argumento ou definidas aqui após o upload.
 */

import mysql from "mysql2/promise";

// URLs das fotos (serão preenchidas após o upload)
const FOTO_DA = process.env.FOTO_DA || "";
const FOTO_DB = process.env.FOTO_DB || "";
const FOTO_DC = process.env.FOTO_DC || "";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

// Parse da DATABASE_URL (formato: mysql://user:pass@host:port/db)
const url = new URL(DB_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port || "3306"),
  user: url.username,
  password: url.password,
  database: url.pathname.replace("/", ""),
  ssl: { rejectUnauthorized: false },
});

console.log("Conectado ao banco de dados.");

// 1. Buscar todos os produtos da família LED BAR U
const [rows] = await conn.execute(
  `SELECT * FROM products WHERE familia = 'LED BAR U' ORDER BY produto`
);

console.log(`Encontrados ${rows.length} produtos da família LED BAR U:`);
rows.forEach((r) => console.log(`  - ${r.produto} (SKU: ${r.sku})`));

if (rows.length === 0) {
  console.error("Nenhum produto encontrado. Verifique o nome da família.");
  await conn.end();
  process.exit(1);
}

// 2. Verificar se já existem produtos LED BAR 45
const [existing] = await conn.execute(
  `SELECT COUNT(*) as total FROM products WHERE familia = 'LED BAR 45'`
);
if (existing[0].total > 0) {
  console.log(`\nAVISO: Já existem ${existing[0].total} produtos da família LED BAR 45 no banco.`);
  console.log("Abortando para evitar duplicatas. Delete-os primeiro se quiser recriar.");
  await conn.end();
  process.exit(0);
}

// 3. Mapear foto por difusor (DA, DB, DC)
function getFoto(sku) {
  const upper = sku.toUpperCase();
  if (upper.includes(" DA")) return FOTO_DA;
  if (upper.includes(" DB")) return FOTO_DB;
  if (upper.includes(" DC")) return FOTO_DC;
  return "";
}

// 4. Transformar cada produto LED BAR U → LED BAR 45
const toInsert = rows.map((r) => {
  // SKU: "LED BAR U DA" → "LED BAR 45 DA"
  const newSku = r.sku.replace("LED BAR U", "LED BAR 45");
  // Produto: "LED BAR U DA 5W/M" → "LED BAR 45 DA 5W/M"
  const newProduto = r.produto.replace("LED BAR U", "LED BAR 45");
  const foto = getFoto(newSku);

  return {
    ...r,
    id: undefined, // auto-increment
    familia: "LED BAR 45",
    sku: newSku,
    produto: newProduto,
    fotoUrl: foto || r.fotoUrl, // usa nova foto se disponível, senão mantém a original
    fotoKey: foto ? null : r.fotoKey,
    createdAt: undefined,
    updatedAt: undefined,
  };
});

console.log("\nProdutos a serem criados:");
toInsert.forEach((p) => console.log(`  - ${p.produto} (SKU: ${p.sku}) | Foto: ${p.fotoUrl ? "✓" : "sem foto"}`));

// 5. Inserir no banco
const columns = [
  "categoria", "instalacao", "familia", "sku", "produto", "moduloLed",
  "otica", "oticaNaoAplicavel", "holder", "holderNaoAplicavel",
  "dissipador", "dissipadorNaoAplicavel",
  "driverOnoff220", "driverOnoffBivolt", "driverOnoffBivoltNaoAplicavel",
  "driverDim110v", "driverDim110vNaoAplicavel",
  "driverDimDali", "driverDimDaliNaoAplicavel",
  "driverOnoff220Extra", "driverOnoffBivoltExtra", "driverDim110vExtra", "driverDimDaliExtra",
  "oticaExtra", "temperaturasCor", "fotoUrl", "fotoKey",
  "custoLuminaria", "custoDriverOnoff220", "custoDriverOnoffBivolt",
  "custoDriverDim110v", "custoDriverDimDali",
  "precoVendaOnoff220", "precoVendaOnoffBivolt", "precoVendaDim110v", "precoVendaDimDali",
];

let inserted = 0;
let skipped = 0;

for (const p of toInsert) {
  const values = columns.map((c) => {
    const v = p[c];
    if (v === undefined || v === null) return null;
    return v;
  });

  try {
    await conn.execute(
      `INSERT INTO products (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      values
    );
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
