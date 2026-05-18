import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const data = JSON.parse(readFileSync('/home/ubuntu/corrections.json', 'utf-8'));
const { divergentes, planilha_index } = data;

// Mapeamento de campos da planilha para colunas do banco
const CAMPO_MAP = {
  moduloLed: 'moduloLed',
  holder: 'holder',
  otica: 'otica',
  dissipador: 'dissipador',
  driverOnoff220: 'driverOnoff220',
  driverOnoffBivolt: 'driverOnoffBivolt',
  driverDim110v: 'driverDim110v',
  driverDimDali: 'driverDimDali',
  sku: 'sku',
};

// Campos NOT NULL no banco (não podem receber null)
const NOT_NULL_FIELDS = new Set(['otica', 'holder', 'dissipador']);

// Campos que indicam "não tem opção" → setar como string vazia
const NAO_TEM = ['NÃO TEM OPÇÃO BIVOLT', 'NÃO TEM OPÇÃO', 'NÃO APLICÁVEL', 'NAO APLICAVEL'];

function normalizeValue(campo, val) {
  if (!val || val.trim() === '') return NOT_NULL_FIELDS.has(campo) ? '' : null;
  const upper = val.trim().toUpperCase();
  if (NAO_TEM.includes(upper)) {
    return NOT_NULL_FIELDS.has(campo) ? '' : null;
  }
  return val.trim();
}

let updated = 0;
let errors = 0;

for (const prod of divergentes) {
  const { id, produto } = prod;
  const planilha = planilha_index[produto.toUpperCase().trim()];
  if (!planilha) {
    console.warn(`[SKIP] Sem dados de planilha para: ${produto}`);
    continue;
  }

  // Montar SET com todos os campos divergentes
  const setClauses = [];
  const values = [];

  for (const [campo, dbCol] of Object.entries(CAMPO_MAP)) {
    const planVal = planilha[campo];
    if (planVal === undefined) continue;

    const normalized = normalizeValue(campo, planVal);
    
    // Só atualizar se a planilha tem valor (não vazio)
    if (planVal && planVal.trim() && !NAO_TEM.includes(planVal.trim().toUpperCase())) {
      setClauses.push(`\`${dbCol}\` = ?`);
      values.push(normalized);
    }
  }

  if (setClauses.length === 0) continue;

  values.push(id);
  const sql = `UPDATE products SET ${setClauses.join(', ')} WHERE id = ?`;

  try {
    const [result] = await conn.execute(sql, values);
    if (result.affectedRows > 0) {
      updated++;
    }
  } catch (e) {
    console.error(`[ERROR] ID ${id} (${produto}): ${e.message}`);
    errors++;
  }
}

console.log(`\n=== Resultado ===`);
console.log(`Produtos atualizados: ${updated}`);
console.log(`Erros: ${errors}`);

// Verificar Office Comfort especificamente
const [rows] = await conn.execute(
  `SELECT id, produto, moduloLed, driverOnoff220, driverOnoffBivolt, holder, otica FROM products WHERE familia = 'OFFICE COMFORT' ORDER BY produto`
);
console.log(`\n=== OFFICE COMFORT (${rows.length} produtos) ===`);
for (const r of rows) {
  console.log(`[${r.id}] ${r.produto}`);
  console.log(`  moduloLed: ${r.moduloLed}`);
  console.log(`  driver220: ${r.driverOnoff220}`);
  console.log(`  driverBivolt: ${r.driverOnoffBivolt}`);
  console.log(`  holder: ${r.holder}`);
  console.log(`  otica: ${r.otica}`);
}

await conn.end();
console.log('\nConcluído!');
