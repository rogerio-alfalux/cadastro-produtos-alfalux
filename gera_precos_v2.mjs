/**
 * Gera e aplica SQL de UPDATE em massa para precoVenda* dos produtos PERFIS.
 *
 * Regras:
 * - ON/OFF 220V = ON/OFF Bivolt = valor da planilha (quando driver disponível)
 * - DIM 1-10V = DIM DALI = valor + R$160 (barra STRIPFLEX ou STRIPLINE)
 * - Produtos com fita (BAGEO) são ignorados nesta rodada
 * - Produtos sem mapeamento ficam sem preço (NULL)
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ── 1. Mapeamento planilha → família + instalação + tipo → preços por potência ─
// Chave: (familia, instalacao, tipo_barra)
// tipo_barra: 'barra' | 'barra_d1' | 'barra_d2'
const PRICE_MAP = {
  // Blaze E (embutir, barra)
  'BLAZE|EMBUTIR|barra':           {18: 330, 26: 340, 36: 360},
  // Easy Prime E (embutir, barra)
  'EASY PRIME|EMBUTIR|barra':      {18: 310, 26: 320, 36: 340},
  // Skyline E (embutir, barra)
  'SKYLINE|EMBUTIR|barra':         {18: 270, 26: 280, 36: 300},
  // Blaze P D1 (pendente, barra simples)
  'BLAZE|PENDENTE|barra_d1':       {18: 410, 26: 420, 36: 440},
  // Blaze H P D1+D2 (pendente, barra dupla)
  'BLAZE H|PENDENTE|barra_d2':     {36: 460, 52: 480, 72: 520},
  // Mini Blaze P e S (pendente/sobrepor, barra)
  'MINI BLAZE|PENDENTE|barra':     {18: 310, 26: 320, 36: 340},
  'MINI BLAZE|SOBREPOR|barra':     {18: 310, 26: 320, 36: 340},
  // Easy H Plus D1 (pendente, barra simples)
  'EASY H PLUS|PENDENTE|barra_d1': {18: 470, 26: 480, 36: 500},
  // Easy H Plus D1+D2 (pendente, barra dupla)
  'EASY H PLUS|PENDENTE|barra_d2': {36: 600, 52: 620, 72: 660},
  // Hit P D1 (pendente, barra simples)
  'HIT|PENDENTE|barra_d1':         {18: 410, 26: 420, 36: 440},
  // Hit P D1+D2 (pendente, barra dupla)
  'HIT|PENDENTE|barra_d2':         {36: 520, 52: 550, 72: 600},
  // Blaze S D1 (sobrepor, barra)
  'BLAZE|SOBREPOR|barra':          {18: 370, 26: 380, 36: 400},
  // Blaze arandela (mesmo preço do sobrepor)
  'BLAZE|ARANDELA|barra':          {18: 370, 26: 380, 36: 400},
};

const DIM_ACRESCIMO = 160; // R$ para barra (stripflex/stripline)

// ── 2. Buscar todos os produtos PERFIS do banco ───────────────────────────────
const [rows] = await conn.execute(
  `SELECT id, sku, familia, instalacao, produto, moduloLed,
          driverOnoff220, driverOnoffBivolt, driverOnoffBivoltNaoAplicavel,
          driverDim110v, driverDim110vNaoAplicavel,
          driverDimDali, driverDimDaliNaoAplicavel
   FROM products
   WHERE UPPER(categoria) = 'PERFIS'`
);
console.log(`Total PERFIS no banco: ${rows.length}`);

// ── 3. Helpers ────────────────────────────────────────────────────────────────
function parseModulo(moduloLed) {
  const s = (moduloLed || '').toUpperCase();
  const m = s.match(/^(\d+)W/);
  const pot = m ? parseInt(m[1]) : 0;
  const tipo = s.includes('STRIPFLEX') ? 'stripflex'
             : s.includes('STRIPLINE') ? 'stripline'
             : s.includes('FITA')      ? 'fita'
             : 'outro';
  return { pot, tipo };
}

function isValidDriver(val) {
  return val && val.trim() !== '' && val.toUpperCase() !== 'NÃO APLICÁVEL';
}

function isD2(produtoNome, familia) {
  const n = (produtoNome || '').toUpperCase();
  if (familia.toUpperCase() === 'BLAZE H') return true;
  return n.includes('D1+D2') || n.includes('D1 + D2');
}

// ── 4. Gerar updates ──────────────────────────────────────────────────────────
const updates = [];
const skippedFita = [];
const skippedSemPreco = [];

for (const p of rows) {
  const fam  = (p.familia   || '').toUpperCase();
  const inst = (p.instalacao || '').toUpperCase();
  const { pot, tipo } = parseModulo(p.moduloLed);

  // Ignorar fita por ora
  if (tipo === 'fita') { skippedFita.push(p.sku); continue; }

  // Determinar tipo de barra
  let tipoBarra = 'barra';
  if (tipo === 'stripflex' || tipo === 'stripline') {
    if (isD2(p.produto, fam)) {
      tipoBarra = 'barra_d2';
    } else if (['BLAZE', 'HIT', 'EASY H PLUS'].includes(fam) && inst === 'PENDENTE') {
      tipoBarra = 'barra_d1';
    }
  }

  const key = `${fam}|${inst}|${tipoBarra}`;
  let precos = PRICE_MAP[key];

  // Fallback para 'barra' simples
  if (!precos) {
    const key2 = `${fam}|${inst}|barra`;
    precos = PRICE_MAP[key2];
  }

  if (!precos) { skippedSemPreco.push({sku: p.sku, fam, inst, tipoBarra, pot}); continue; }

  // Potência: exata ou mínima disponível
  const base = precos[pot] ?? precos[Math.min(...Object.keys(precos).map(Number))];

  // Disponibilidade dos drivers
  const has220    = isValidDriver(p.driverOnoff220);
  const hasBivolt = !p.driverOnoffBivoltNaoAplicavel && isValidDriver(p.driverOnoffBivolt);
  const hasDim110 = !p.driverDim110vNaoAplicavel && isValidDriver(p.driverDim110v);
  const hasDali   = !p.driverDimDaliNaoAplicavel && isValidDriver(p.driverDimDali);

  updates.push({
    id:           p.id,
    sku:          p.sku,
    fam, inst, pot, tipoBarra,
    preco220:     has220    ? base                : null,
    precoBivolt:  hasBivolt ? base                : null,
    precoDim110:  hasDim110 ? base + DIM_ACRESCIMO : null,
    precoDali:    hasDali   ? base + DIM_ACRESCIMO : null,
  });
}

console.log(`A atualizar: ${updates.length} | Fita (ignorados): ${skippedFita.length} | Sem mapeamento: ${skippedSemPreco.length}`);

// ── 5. Aplicar updates ────────────────────────────────────────────────────────
let ok = 0, errs = 0;
for (const u of updates) {
  const v220   = u.preco220   !== null ? u.preco220   : 'NULL';
  const vBiv   = u.precoBivolt !== null ? u.precoBivolt : 'NULL';
  const vDim   = u.precoDim110 !== null ? u.precoDim110 : 'NULL';
  const vDali  = u.precoDali   !== null ? u.precoDali   : 'NULL';
  try {
    await conn.execute(
      `UPDATE products SET precoVendaOnoff220=?, precoVendaOnoffBivolt=?, precoVendaDim110v=?, precoVendaDimDali=? WHERE id=?`,
      [u.preco220, u.precoBivolt, u.precoDim110, u.precoDali, u.id]
    );
    ok++;
  } catch(e) {
    console.error('Erro:', e.message, u.sku);
    errs++;
  }
}
console.log(`Updates: ${ok} ok, ${errs} erros`);

// ── 6. Verificar resultado ────────────────────────────────────────────────────
const [sample] = await conn.execute(
  `SELECT sku, familia, instalacao, precoVendaOnoff220, precoVendaOnoffBivolt, precoVendaDim110v, precoVendaDimDali
   FROM products
   WHERE UPPER(categoria) = 'PERFIS' AND UPPER(familia) = 'BLAZE' AND UPPER(instalacao) = 'EMBUTIR'
   LIMIT 5`
);
console.log('\nAmostra BLAZE EMBUTIR após update:');
for (const r of sample) {
  console.log(`  ${r.sku}: 220=${r.precoVendaOnoff220} biv=${r.precoVendaOnoffBivolt} dim110=${r.precoVendaDim110v} dali=${r.precoVendaDimDali}`);
}

const [cnt] = await conn.execute(
  `SELECT
     SUM(CASE WHEN precoVendaOnoff220 IS NOT NULL THEN 1 ELSE 0 END) as com_220,
     SUM(CASE WHEN precoVendaDimDali IS NOT NULL THEN 1 ELSE 0 END) as com_dali,
     COUNT(*) as total
   FROM products WHERE UPPER(categoria) = 'PERFIS'`
);
console.log('\nContagem geral PERFIS:', JSON.stringify(cnt[0]));

await conn.end();
