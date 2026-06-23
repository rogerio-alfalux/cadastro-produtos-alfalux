/**
 * Upload em massa de custos e markups dos drivers.
 * Aba: "TABELA DE VENDA DRIVERS SOLTOS" (ou similar)
 * Matching por código EQ/CP do driver (campo 'codigo' na tabela components).
 * Colunas: DESCRIÇÃO DRIVER, CODIGO DRIVER, CUSTO DRIVER, MKP PADRÃO
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import XLSX from 'xlsx';

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
console.log('Abas disponíveis:', wb.SheetNames);

// Encontrar a aba de drivers
const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes('DRIVER')) || wb.SheetNames[1];
console.log(`Aba de drivers: ${sheetName}`);
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

console.log(`Total de linhas: ${rows.length}`);
if (rows.length > 0) {
  console.log('Colunas:', Object.keys(rows[0]).join(' | '));
  console.log('Primeira linha:', JSON.stringify(rows[0]));
}

// ── Encontrar colunas relevantes ──────────────────────────────────────────────
const sampleKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
const colDescricao = sampleKeys.find(k => k.toUpperCase().includes('DESCRI')) || null;
const colCodigo = sampleKeys.find(k => k.toUpperCase().includes('CODIGO') || k.toUpperCase().includes('CÓDIGO')) || null;
const colCusto = sampleKeys.find(k => k.toUpperCase().includes('CUSTO')) || null;
const colMkpP = sampleKeys.find(k => k.toUpperCase().includes('MKP') || k.toUpperCase().includes('MARKUP')) || null;

console.log(`\nColunas mapeadas:`);
console.log(`  Descrição: "${colDescricao}"`);
console.log(`  Código: "${colCodigo}"`);
console.log(`  Custo: "${colCusto}"`);
console.log(`  MKP Padrão: "${colMkpP}"`);

function toFloat(v) {
  if (v === null || v === undefined || v === '') return null;
  const f = parseFloat(String(v).replace(',', '.'));
  return isNaN(f) || f <= 0 ? null : f;
}

// ── Carregar todos os componentes do banco ────────────────────────────────────
const [dbComponents] = await conn.execute('SELECT id, codigo, modelo FROM components');
console.log(`\nComponentes no banco: ${dbComponents.length}`);

// Criar mapas para matching
const codigoToId = new Map();
const modeloToId = new Map();
for (const c of dbComponents) {
  if (c.codigo) codigoToId.set(c.codigo.toUpperCase().trim(), c.id);
  if (c.modelo) modeloToId.set(c.modelo.toUpperCase().trim(), c.id);
}

// ── Processar linhas da planilha ──────────────────────────────────────────────
const updates = new Map(); // id → {custo, mkpPadrao}

let naoEncontrado = 0, semCusto = 0, processados = 0;
const naoEncontradoList = [];

for (const row of rows) {
  const descricao = String(row[colDescricao] || '').trim();
  const codigo = colCodigo ? String(row[colCodigo] || '').trim() : '';
  const custo = toFloat(row[colCusto]);
  const mkpP = toFloat(row[colMkpP]);

  if (!descricao && !codigo) continue;
  if (custo === null && mkpP === null) { semCusto++; continue; }

  let compId = null;

  // Matching por código (EQ ou CP)
  if (codigo) {
    compId = codigoToId.get(codigo.toUpperCase());
  }

  // Fallback: matching por modelo/descrição
  if (!compId && descricao) {
    const descNorm = descricao.toUpperCase().trim();
    compId = modeloToId.get(descNorm);
  }

  if (!compId) {
    naoEncontrado++;
    if (naoEncontradoList.length < 20) {
      naoEncontradoList.push({ codigo, descricao: descricao.substring(0, 60) });
    }
    continue;
  }

  updates.set(compId, { custo, mkpPadrao: mkpP });
  processados++;
}

console.log(`\nDrivers processados com sucesso: ${processados}`);
console.log(`Sem custo/markup: ${semCusto}`);
console.log(`Não encontrados no banco: ${naoEncontrado}`);
if (naoEncontradoList.length > 0) {
  console.log(`\nNão encontrados:`);
  naoEncontradoList.forEach(d => console.log(`  - [${d.codigo}] ${d.descricao}`));
}

// ── Executar UPDATEs ──────────────────────────────────────────────────────────
console.log(`\nExecutando ${updates.size} UPDATEs na tabela components...`);

let success = 0, errors = 0, affected = 0;

for (const [compId, { custo, mkpPadrao }] of updates) {
  const setParts = [];
  const vals = [];
  if (custo !== null)     { setParts.push('`custoDriver` = ?'); vals.push(custo); }
  if (mkpPadrao !== null) { setParts.push('`mkpPadraoDriver` = ?'); vals.push(mkpPadrao); }

  if (setParts.length === 0) continue;

  vals.push(compId);
  const sql = `UPDATE components SET ${setParts.join(', ')} WHERE id = ?`;

  try {
    const [result] = await conn.execute(sql, vals);
    affected += result.affectedRows || 0;
    success++;
  } catch (err) {
    errors++;
    console.error(`  [ERRO] id=${compId}: ${err.message}`);
  }
}

await conn.end();

console.log('\n=== RESULTADO FINAL ===');
console.log(`UPDATEs executados: ${success}`);
console.log(`Erros: ${errors}`);
console.log(`Linhas afetadas no banco: ${affected}`);
