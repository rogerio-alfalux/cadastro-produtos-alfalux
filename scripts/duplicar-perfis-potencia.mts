/**
 * Script de duplicação dos perfis modulares em 3 versões de potência.
 * Usa apenas colunas que existem no banco de produção.
 */

import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const FAMILIAS_PERFIS = ["BLAZE","BLAZE H","EASY H PLUS","EASY PRIME","FLOW","HIT","MINI BLAZE","SKYLINE","SMART MINI","SOFT"];

// Colunas de custo que existem no banco
const CUSTO_COLS = [
  "custoLuminaria", "custoDriver",
  "custoDriverOnoff220", "custoDriverOnoffBivolt", "custoDriverDim110v", "custoDriverDimDali",
  "custoDriverDimTriac110v", "custoDriverDimTriac220v",
  "custoCorpoOnoff220v", "custoCorpoOnoffBivolt", "custoCorpoDim110v", "custoCorpoDimDali",
  "custoCorpoDimTriac110v", "custoCorpoDimTriac220v",
  "custoCorpoOnoff220vD1D2", "custoCorpoOnoffBivoltD1D2", "custoCorpoDim110vD1D2", "custoCorpoDimDaliD1D2",
  "custoCorpoDimTriac110vD1D2", "custoCorpoDimTriac220vD1D2",
];

// Colunas de preço que existem no banco
const PRECO_COLS = [
  "precoVendaOnoff220", "precoVendaOnoffBivolt", "precoVendaDim110v", "precoVendaDimDali",
  "precoVendaOnoff220D1", "precoVendaOnoff220D1D2",
  "precoVendaOnoffBivoltD1", "precoVendaOnoffBivoltD1D2",
  "precoVendaDim110vD1", "precoVendaDim110vD1D2",
  "precoVendaDimDaliD1", "precoVendaDimDaliD1D2",
];

// Colunas auto-geradas que não devem ser inseridas
const SKIP_COLS = new Set(["id", "createdAt", "updatedAt"]);

async function getDriver26W(conn: mysql.Connection): Promise<{modelo: string, custo: number | null} | null> {
  for (const codigo of ["EQ00220", "EQ00353"]) {
    const [rows] = await conn.query<any[]>(
      `SELECT modelo, custoDriver FROM components WHERE codigo = ? LIMIT 1`, [codigo]
    );
    if (rows.length > 0) {
      return { modelo: rows[0].modelo, custo: rows[0].custoDriver ? parseFloat(rows[0].custoDriver) : null };
    }
  }
  return null;
}

async function getStriplineEquivalente(conn: mysql.Connection, stripflexModelo: string, cache: Map<string, any>): Promise<{modelo: string} | null> {
  if (cache.has(stripflexModelo)) return cache.get(stripflexModelo);
  const cctMatch = stripflexModelo.match(/(\d{4}K)/);
  if (!cctMatch) { cache.set(stripflexModelo, null); return null; }
  const cct = cctMatch[1];
  const [rows] = await conn.query<any[]>(
    `SELECT modelo FROM components WHERE tipo = 'MODULO_LED' AND modelo LIKE '%STRIPLINE%' AND modelo LIKE ? LIMIT 1`,
    [`%${cct}%`]
  );
  const result = rows.length > 0 ? { modelo: rows[0].modelo } : null;
  cache.set(stripflexModelo, result);
  return result;
}

function applyFator(val: any, fator: number): any {
  if (val == null || val === "") return val;
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return val;
  return (Math.round(n * fator * 100) / 100).toString();
}

async function insertProduct(conn: mysql.Connection, prod: any, potencia: string) {
  // Construir objeto apenas com colunas que existem no banco
  // Buscar colunas do banco dinamicamente na primeira chamada
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(prod)) {
    if (!SKIP_COLS.has(k)) data[k] = v;
  }
  data.potencia = potencia;
  
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const placeholders = cols.map(() => "?").join(", ");
  
  await conn.query(
    `INSERT INTO products (\`${cols.join("`, `")}\`) VALUES (${placeholders})`,
    vals
  );
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  
  // Buscar colunas reais do banco para filtrar o objeto antes de inserir
  const [dbCols] = await conn.query<any[]>("DESCRIBE products");
  const validCols = new Set((dbCols as any[]).map((c: any) => c.Field));
  console.log(`Colunas válidas no banco: ${validCols.size}`);
  
  const famPlaceholders = FAMILIAS_PERFIS.map(() => "?").join(",");
  const [rows] = await conn.query<any[]>(
    `SELECT * FROM products WHERE familia IN (${famPlaceholders}) AND categoria != 'CUSTOMIZADOS' ORDER BY familia, produto`,
    FAMILIAS_PERFIS
  );
  
  console.log(`Total de produtos para processar: ${rows.length}`);
  
  const driver26W = await getDriver26W(conn);
  console.log(`Driver 26W: ${driver26W?.modelo || "NÃO ENCONTRADO"}`);
  
  const striplineCache = new Map<string, any>();
  const fator26W = 1 / 0.97;
  const fator36W = 1 / 0.915;
  
  let renomeados = 0, criados26W = 0, criados36WSF = 0, criados36WSL = 0, erros = 0;
  
  // Função auxiliar para filtrar apenas colunas válidas
  function filterValidCols(obj: any): any {
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (validCols.has(k) && !SKIP_COLS.has(k)) result[k] = v;
    }
    return result;
  }
  
  for (const produto of rows) {
    try {
      // ─── 1. Renomear para 18W ───────────────────────────────────────────────
      const nome18W = produto.produto.endsWith(" 18W") ? produto.produto : `${produto.produto} 18W`;
      await conn.query(`UPDATE products SET produto = ?, potencia = '18W' WHERE id = ?`, [nome18W, produto.id]);
      renomeados++;
      
      // ─── 2. Criar versão 26W ────────────────────────────────────────────────
      const prod26W: any = { ...produto };
      prod26W.produto = `${produto.produto} 26W`;
      prod26W.correnteDriver = "programar em 500mA";
      
      if (driver26W) {
        prod26W.driverOnoffBivolt = driver26W.modelo;
        if (driver26W.custo != null) prod26W.custoDriverOnoffBivolt = driver26W.custo.toString();
      }
      
      for (const col of CUSTO_COLS) if (prod26W[col] != null) prod26W[col] = applyFator(prod26W[col], fator26W);
      for (const col of PRECO_COLS) if (prod26W[col] != null) prod26W[col] = applyFator(prod26W[col], fator26W);
      
      const data26W = filterValidCols(prod26W);
      data26W.potencia = "26W";
      const cols26W = Object.keys(data26W);
      await conn.query(
        `INSERT INTO products (\`${cols26W.join("`, `")}\`) VALUES (${cols26W.map(() => "?").join(", ")})`,
        Object.values(data26W)
      );
      criados26W++;
      
      // ─── 3. Criar versão 36W-SF (Stripflex duplo) ──────────────────────────
      const prod36WSF: any = { ...produto };
      prod36WSF.produto = `${produto.produto} 36W SF`;
      
      for (const qtdCol of ["qtdModuloLed", "qtdModuloLed2700", "qtdModuloLed3000", "qtdModuloLed4000", "qtdModuloLed5000"]) {
        if (prod36WSF[qtdCol] != null && prod36WSF[qtdCol] !== "") {
          const n = parseInt(prod36WSF[qtdCol]);
          if (!isNaN(n) && n > 0) prod36WSF[qtdCol] = (n * 2).toString();
        }
      }
      
      for (const col of CUSTO_COLS) if (prod36WSF[col] != null) prod36WSF[col] = applyFator(prod36WSF[col], fator36W);
      for (const col of PRECO_COLS) if (prod36WSF[col] != null) prod36WSF[col] = applyFator(prod36WSF[col], fator36W);
      
      const data36WSF = filterValidCols(prod36WSF);
      data36WSF.potencia = "36W-SF";
      const cols36WSF = Object.keys(data36WSF);
      await conn.query(
        `INSERT INTO products (\`${cols36WSF.join("`, `")}\`) VALUES (${cols36WSF.map(() => "?").join(", ")})`,
        Object.values(data36WSF)
      );
      criados36WSF++;
      
      // ─── 4. Criar versão 36W-SL (Stripline) — só barras inteiras ───────────
      const sku = produto.sku || "";
      if (!sku.includes("45M") && !sku.includes("38I")) {
        const prod36WSL: any = { ...produto };
        prod36WSL.produto = `${produto.produto} 36W SL`;
        
        for (const [ledCol, qtdCol] of [
          ["moduloLed", "qtdModuloLed"],
          ["moduloLed2700", "qtdModuloLed2700"],
          ["moduloLed3000", "qtdModuloLed3000"],
          ["moduloLed4000", "qtdModuloLed4000"],
          ["moduloLed5000", "qtdModuloLed5000"],
        ]) {
          const modAtual = prod36WSL[ledCol] || "";
          if (modAtual.includes("STRIPFLEX")) {
            const stripline = await getStriplineEquivalente(conn, modAtual, striplineCache);
            if (stripline) {
              prod36WSL[ledCol] = stripline.modelo;
              prod36WSL[qtdCol] = "1";
            }
          }
        }
        
        for (const col of CUSTO_COLS) if (prod36WSL[col] != null) prod36WSL[col] = applyFator(prod36WSL[col], fator36W);
        for (const col of PRECO_COLS) if (prod36WSL[col] != null) prod36WSL[col] = applyFator(prod36WSL[col], fator36W);
        
        const data36WSL = filterValidCols(prod36WSL);
        data36WSL.potencia = "36W-SL";
        const cols36WSL = Object.keys(data36WSL);
        await conn.query(
          `INSERT INTO products (\`${cols36WSL.join("`, `")}\`) VALUES (${cols36WSL.map(() => "?").join(", ")})`,
          Object.values(data36WSL)
        );
        criados36WSL++;
      }
      
      if (renomeados % 50 === 0) {
        process.stdout.write(`\r  Progresso: ${renomeados}/${rows.length} | 26W: ${criados26W} | 36W-SF: ${criados36WSF} | 36W-SL: ${criados36WSL}`);
      }
      
    } catch (err: any) {
      console.error(`\n  ERRO no produto ${produto.id} (${produto.produto}): ${err.message}`);
      erros++;
    }
  }
  
  console.log(`\n\n=== RESULTADO FINAL ===`);
  console.log(`Renomeados para 18W: ${renomeados}`);
  console.log(`Criados 26W: ${criados26W}`);
  console.log(`Criados 36W-SF: ${criados36WSF}`);
  console.log(`Criados 36W-SL: ${criados36WSL}`);
  console.log(`Erros: ${erros}`);
  console.log(`Total de produtos criados: ${criados26W + criados36WSF + criados36WSL}`);
  
  await conn.end();
}

main().catch(console.error);
