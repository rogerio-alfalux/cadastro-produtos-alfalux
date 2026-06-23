/**
 * Upload em massa de custos e markups das luminárias por tipo de driver.
 * Matching por SKU (extraído da descrição da planilha: "LDB-6402.300.68F - FLOOR...")
 * e também por nome do produto (parte após " - ").
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config({ path: '/home/ubuntu/cadastro-produtos-alfalux/.env' });

const DB_URL = process.env.DATABASE_URL;
const url = new URL(DB_URL);
const conn = await mysql.createConnection({
  host: url.hostname, port: parseInt(url.port || '3306'),
  user: url.username, password: url.password,
  database: url.pathname.slice(1), ssl: { rejectUnauthorized: false }
});
console.log('Conectado ao banco.');

// ── Ler planilha ─────────────────────────────────────────────────────────────
const wb = XLSX.readFile('/home/ubuntu/upload/ALFALUX-TABELADEPREÇO22.06.26.xlsx');
const sheetName = wb.SheetNames.find(n => n.includes('TABELA') && !n.includes('DRIVER')) || wb.SheetNames[0];
console.log(`Aba: ${sheetName}`);
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

console.log(`Total de linhas: ${rows.length}`);
if (rows.length > 0) {
  console.log('Colunas:', Object.keys(rows[0]).join(', '));
}

// ── Mapeamento de tipo de driver ──────────────────────────────────────────────
function mapTipo(raw) {
  if (!raw) return null;
  const r = String(raw).toUpperCase().trim().replace(/\s+/g, ' ');
  if (r.includes('TRIAC') && r.includes('110')) return 'DimTriac110v';
  if (r.includes('TRIAC') && r.includes('220')) return 'DimTriac220v';
  if (r.includes('TRIAC')) return 'DimTriac110v';
  if (r.includes('DALI')) return 'DimDali';
  if (r.includes('1-10') || r.includes('1 10') || r.includes('DIM')) return 'Dim110v';
  if (r.includes('BIVOLT') || r.includes('BIV')) return 'OnoffBivolt';
  if (r.includes('220')) return 'Onoff220v';
  if (r.includes('ON') && r.includes('OFF')) return 'Onoff220v';
  return null;
}

const TIPO_TO_CAMPOS = {
  Onoff220v:    ['custoCorpoOnoff220v',    'mkpPadraoOnoff220v',    'mkpMinimoOnoff220v'],
  OnoffBivolt:  ['custoCorpoOnoffBivolt',  'mkpPadraoOnoffBivolt',  'mkpMinimoOnoffBivolt'],
  Dim110v:      ['custoCorpoDim110v',      'mkpPadraoDim110v',      'mkpMinimoDim110v'],
  DimDali:      ['custoCorpoDimDali',      'mkpPadraoDimDali',      'mkpMinimoDimDali'],
  DimTriac110v: ['custoCorpoDimTriac110v', 'mkpPadraoDimTriac110v', 'mkpMinimoDimTriac110v'],
  DimTriac220v: ['custoCorpoDimTriac220v', 'mkpPadraoDimTriac220v', 'mkpMinimoDimTriac220v'],
};

function toFloat(v) {
  if (v === null || v === undefined || v === '') return null;
  const f = parseFloat(String(v).replace(',', '.'));
  return isNaN(f) || f <= 0 ? null : f;
}

// ── Encontrar colunas relevantes ──────────────────────────────────────────────
const sampleKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
const colDescricao = sampleKeys.find(k => k.toUpperCase().includes('DESCRI')) || null;
const colTipo = sampleKeys.find(k => k.toUpperCase().includes('TIPO')) || null;
const colCusto = sampleKeys.find(k => k.toUpperCase().includes('CUSTO SEM DRIVER')) || null;
const colMkpP = sampleKeys.find(k => k.toUpperCase().includes('MKP PADRÃO') || k.toUpperCase().includes('MKP PADRAO')) || null;
const colMkpM = sampleKeys.find(k => k.toUpperCase().includes('MKP MÍNIMO') || k.toUpperCase().includes('MKP MINIMO')) || null;

console.log(`\nColunas mapeadas:`);
console.log(`  Descrição: "${colDescricao}"`);
console.log(`  Tipo Driver: "${colTipo}"`);
console.log(`  Custo Sem Driver: "${colCusto}"`);
console.log(`  MKP Padrão: "${colMkpP}"`);
console.log(`  MKP Mínimo: "${colMkpM}"`);

if (!colDescricao || !colCusto) {
  console.error('ERRO: Colunas essenciais não encontradas!');
  process.exit(1);
}

// ── Carregar todos os produtos do banco (sku + produto) ───────────────────────
const [dbProducts] = await conn.execute('SELECT id, sku, produto FROM products');
console.log(`\nProdutos no banco: ${dbProducts.length}`);

// Criar mapas para matching
const skuToId = new Map();
const nomeToId = new Map();
for (const p of dbProducts) {
  if (p.sku) skuToId.set(p.sku.toUpperCase().trim(), p.id);
  if (p.produto) nomeToId.set(p.produto.toUpperCase().trim(), p.id);
}

// ── Processar linhas da planilha ──────────────────────────────────────────────
// Agrupar por (id_produto, tipo) → {custo, mkp_p, mkp_m}
const updates = new Map(); // key: `${id}|${tipo}` → {custo, mkp_p, mkp_m}

let semTipo = 0, semCusto = 0, naoEncontrado = 0, processados = 0;
const naoEncontradoList = [];

for (const row of rows) {
  const descricao = String(row[colDescricao] || '').trim();
  if (!descricao) continue;

  const tipo = mapTipo(row[colTipo]);
  if (!tipo) { semTipo++; continue; }

  const custo = toFloat(row[colCusto]);
  const mkpP = toFloat(row[colMkpP]);
  const mkpM = toFloat(row[colMkpM]);

  if (custo === null && mkpP === null) { semCusto++; continue; }

  // Tentar extrair SKU da descrição: "LDB-6402.300.68F - FLOOR BALIZADOR..."
  let prodId = null;
  const skuMatch = descricao.match(/^([A-Z0-9\-\.]+)\s*-\s*/i);
  if (skuMatch) {
    const skuPart = skuMatch[1].toUpperCase().trim();
    prodId = skuToId.get(skuPart);
  }

  // Fallback: matching por nome (parte após " - ")
  if (!prodId) {
    const nomePart = descricao.replace(/^[A-Z0-9\-\.]+\s*-\s*/i, '').toUpperCase().trim();
    // Normalizar D1/D2 → D1+D2
    const nomeNorm = nomePart.replace(/D1\s*\/\s*D2/g, 'D1+D2');
    prodId = nomeToId.get(nomeNorm);
    if (!prodId) {
      // Tentar sem normalização
      prodId = nomeToId.get(nomePart);
    }
  }

  // Fallback 2: matching por descrição completa normalizada
  if (!prodId) {
    const descNorm = descricao.toUpperCase().replace(/D1\s*\/\s*D2/g, 'D1+D2');
    prodId = nomeToId.get(descNorm);
  }

  if (!prodId) {
    naoEncontrado++;
    if (naoEncontradoList.length < 15) naoEncontradoList.push(descricao);
    continue;
  }

  const key = `${prodId}|${tipo}`;
  updates.set(key, { prodId, tipo, custo, mkpP, mkpM });
  processados++;
}

console.log(`\nLinhas processadas com sucesso: ${processados}`);
console.log(`Sem tipo de driver: ${semTipo}`);
console.log(`Sem custo/markup: ${semCusto}`);
console.log(`Não encontrados no banco: ${naoEncontrado}`);
if (naoEncontradoList.length > 0) {
  console.log(`\nPrimeiros não encontrados:`);
  naoEncontradoList.forEach(d => console.log(`  - ${d}`));
}

// ── Executar UPDATEs ──────────────────────────────────────────────────────────
console.log(`\nExecutando ${updates.size} UPDATEs...`);

let success = 0, errors = 0, affected = 0;

for (const [key, { prodId, tipo, custo, mkpP, mkpM }] of updates) {
  const campos = TIPO_TO_CAMPOS[tipo];
  if (!campos) continue;

  const setParts = [];
  const vals = [];
  if (custo !== null) { setParts.push(`\`${campos[0]}\` = ?`); vals.push(custo); }
  if (mkpP !== null)  { setParts.push(`\`${campos[1]}\` = ?`); vals.push(mkpP); }
  if (mkpM !== null)  { setParts.push(`\`${campos[2]}\` = ?`); vals.push(mkpM); }

  if (setParts.length === 0) continue;

  vals.push(prodId);
  const sql = `UPDATE products SET ${setParts.join(', ')} WHERE id = ?`;

  try {
    const [result] = await conn.execute(sql, vals);
    affected += result.affectedRows || 0;
    success++;
  } catch (err) {
    errors++;
    console.error(`  [ERRO] id=${prodId} tipo=${tipo}: ${err.message}`);
  }
}

await conn.end();

console.log('\n=== RESULTADO FINAL ===');
console.log(`UPDATEs executados: ${success}`);
console.log(`Erros: ${errors}`);
console.log(`Linhas afetadas no banco: ${affected}`);
console.log(`Não encontrados (ignorados): ${naoEncontrado}`);
