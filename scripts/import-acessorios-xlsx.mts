import mysql from "mysql2/promise";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config();

const FILE_PATH = "/home/ubuntu/upload/Cópiadetemplate-acessorios.xlsx";

const conn = await mysql.createConnection(process.env.DATABASE_URL!);

// Ler o arquivo
const wb = XLSX.readFile(FILE_PATH);
console.log(`\nAbas encontradas: ${wb.SheetNames.join(", ")}`);

// Encontrar a aba de dados (ignorar INSTRUÇÕES)
const sheetName = wb.SheetNames.find((n) => !n.toUpperCase().includes("INSTRU")) ?? wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
console.log(`Usando aba: ${sheetName}`);

const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];

// Encontrar linha de cabeçalho
let headerRowIdx = -1;
let colMap: Record<string, number> = {};
for (let i = 0; i < Math.min(5, rawData.length); i++) {
  const row = rawData[i];
  if (!row) continue;
  const normalized: Record<string, number> = {};
  for (let j = 0; j < row.length; j++) {
    const cell = String(row[j] ?? "").trim().toUpperCase();
    if (cell) normalized[cell] = j;
  }
  const hasProduto = "PRODUTO" in normalized || "DESCRIÇÃO" in normalized || "DESCRICAO" in normalized || "NOME" in normalized;
  if (hasProduto) {
    headerRowIdx = i;
    colMap = normalized;
    break;
  }
}

if (headerRowIdx === -1) {
  console.error("❌ Não encontrei linha de cabeçalho com coluna PRODUTO!");
  process.exit(1);
}

console.log(`Cabeçalho na linha ${headerRowIdx + 1}: ${Object.keys(colMap).join(", ")}`);

const getCol = (...names: string[]): number => {
  for (const n of names) { if (n in colMap) return colMap[n]; }
  return -1;
};

const produtoCol    = getCol("PRODUTO", "DESCRIÇÃO", "DESCRICAO", "NOME");
const codigoCol     = getCol("CÓDIGO", "CODIGO", "COD", "CÓD", "CODE");
const skuCol        = getCol("SKU", "REF", "REFERÊNCIA", "REFERENCIA");
const familiaCol    = getCol("FAMÍLIA", "FAMILIA", "FAMILY", "GRUPO");
const dimensaoCol   = getCol("DIMENSÃO", "DIMENSAO", "DIM", "TAMANHO", "SIZE");
const custoCol      = getCol("CUSTO", "COST", "VALOR", "PREÇO CUSTO");
const precoVendaCol = getCol("PREÇO VENDA", "PRECO VENDA", "VENDA", "PRICE", "PREÇO");
const obsCol        = getCol("OBSERVAÇÕES", "OBSERVACOES", "OBS", "OBSERVATION", "NOTA");

const parseNum = (v: any): number | undefined => {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = parseFloat(String(v).replace(",", ".").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? undefined : n;
};

interface ParsedRow {
  codigo?: string;
  sku?: string;
  produto: string;
  familia?: string;
  dimensao?: string;
  custo?: number;
  precoVenda?: number;
  observacoes?: string;
}

const parsed: ParsedRow[] = [];
for (let i = headerRowIdx + 1; i < rawData.length; i++) {
  const row = rawData[i];
  if (!row) continue;
  const produto = String(row[produtoCol] ?? "").trim();
  if (!produto) continue;
  parsed.push({
    produto,
    codigo:      codigoCol >= 0 ? String(row[codigoCol] ?? "").trim() || undefined : undefined,
    sku:         skuCol >= 0 ? String(row[skuCol] ?? "").trim() || undefined : undefined,
    familia:     familiaCol >= 0 ? String(row[familiaCol] ?? "").trim() || undefined : undefined,
    dimensao:    dimensaoCol >= 0 ? String(row[dimensaoCol] ?? "").trim() || undefined : undefined,
    custo:       custoCol >= 0 ? parseNum(row[custoCol]) : undefined,
    precoVenda:  precoVendaCol >= 0 ? parseNum(row[precoVendaCol]) : undefined,
    observacoes: obsCol >= 0 ? String(row[obsCol] ?? "").trim() || undefined : undefined,
  });
}

console.log(`\nLinhas com produto: ${parsed.length}`);

// Buscar códigos já existentes
const codigosExistentes = new Set<string>();
if (parsed.some((r) => r.codigo)) {
  const codigos = parsed.filter((r) => r.codigo).map((r) => r.codigo!);
  const [existing] = await conn.execute(
    `SELECT codigo FROM accessories WHERE codigo IN (${codigos.map(() => "?").join(",")})`,
    codigos
  ) as any[];
  for (const row of existing) codigosExistentes.add(row.codigo);
}

let inserted = 0;
let skipped = 0;
const errors: string[] = [];

for (const item of parsed) {
  if (item.codigo && codigosExistentes.has(item.codigo)) {
    console.log(`  IGNORADO (já existe): ${item.codigo} — ${item.produto}`);
    skipped++;
    continue;
  }
  try {
    await conn.execute(
      `INSERT INTO accessories (codigo, sku, produto, familia, dimensao, custo, precoVenda, observacoes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        item.codigo ?? null,
        item.sku ?? null,
        item.produto,
        item.familia ?? null,
        item.dimensao ?? null,
        item.custo ?? null,
        item.precoVenda ?? null,
        item.observacoes ?? null,
      ]
    );
    console.log(`  ✅ Inserido: ${item.codigo ?? "(sem código)"} — ${item.produto}`);
    inserted++;
  } catch (err: any) {
    const msg = `Linha "${item.produto}": ${err.message}`;
    errors.push(msg);
    console.error(`  ❌ Erro: ${msg}`);
  }
}

console.log(`\n=== RESULTADO ===`);
console.log(`Total lidos:  ${parsed.length}`);
console.log(`Inseridos:    ${inserted}`);
console.log(`Ignorados:    ${skipped}`);
if (errors.length) console.log(`Erros:        ${errors.length}`);

await conn.end();
