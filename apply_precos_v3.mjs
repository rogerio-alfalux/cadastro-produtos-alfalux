/**
 * Aplica preços de venda em massa para produtos PERFIS.
 *
 * Lógica de mapeamento:
 * - Chave = (familia_banco, instalacao_banco, potencia_total_W)
 * - Para D1 simples: potencia_total = potencia_modulo
 * - Para D1+D2 (BLAZE H, EASY H PLUS D1+D2, HIT D1+D2): potencia_total = 2 × potencia_modulo
 * - ON/OFF 220V = ON/OFF Bivolt = preço da planilha
 * - DIM 1-10V = DIM DALI = preço + R$160 (barra stripflex/stripline)
 * - Fita (BAGEO): ignorado nesta rodada
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ── Tabela de preços da planilha ─────────────────────────────────────────────
// Chave: "FAMILIA|INSTALACAO|POT_TOTAL_W" → preço ON/OFF por metro
// Para D1+D2: pot_total = 2 × pot_modulo
const PRECO = {
  // Blaze E (embutir, D1 simples)
  'BLAZE|EMBUTIR|18':           330,
  'BLAZE|EMBUTIR|26':           340,
  'BLAZE|EMBUTIR|36':           360,

  // Easy Prime E (embutir, D1 simples)
  'EASY PRIME|EMBUTIR|18':      310,
  'EASY PRIME|EMBUTIR|26':      320,
  'EASY PRIME|EMBUTIR|36':      340,

  // Skyline E (embutir, D1 simples)
  'SKYLINE|EMBUTIR|18':         270,
  'SKYLINE|EMBUTIR|26':         280,
  'SKYLINE|EMBUTIR|36':         300,

  // Blaze P D1 (pendente, D1 simples) — família BLAZE, não BLAZE H
  'BLAZE|PENDENTE|18':          410,
  'BLAZE|PENDENTE|26':          420,
  'BLAZE|PENDENTE|36':          440,

  // Blaze P D1+D2 (pendente, família BLAZE H) — pot_total = 2×módulo
  // 2×18=36, 2×26=52, 2×36=72
  'BLAZE H|PENDENTE|36':        460,   // módulo 18W × 2
  'BLAZE H|PENDENTE|52':        480,   // módulo 26W × 2
  'BLAZE H|PENDENTE|72':        520,   // módulo 36W × 2

  // Mini Blaze P (pendente e sobrepor, D1 simples)
  'MINI BLAZE|PENDENTE|18':     310,
  'MINI BLAZE|PENDENTE|26':     320,
  'MINI BLAZE|PENDENTE|36':     340,
  'MINI BLAZE|SOBREPOR|18':     310,
  'MINI BLAZE|SOBREPOR|26':     320,
  'MINI BLAZE|SOBREPOR|36':     340,

  // Easy H Plus D1 (pendente, D1 simples) — família EASY H PLUS
  // Distinguimos D1 vs D1+D2 pela potência: se pot_total = pot_modulo → D1
  // Mas no banco todos têm moduloLed=36W e família EASY H PLUS...
  // Usaremos o nome do produto para distinguir (contém "D1+D2" ou não)
  // → tratado separadamente abaixo

  // Hit P D1 (pendente, D1 simples) — família HIT
  'HIT|PENDENTE|18':            410,
  'HIT|PENDENTE|26':            420,
  'HIT|PENDENTE|36':            440,

  // Hit P D1+D2 (pendente, família HIT, pot_total = 2×módulo)
  // 2×18=36, 2×26=52, 2×36=72
  // Problema: HIT D1 e HIT D1+D2 têm mesma família e instalação
  // → distinguir pelo nome do produto (contém "D1+D2" ou não)

  // Blaze S D1 (sobrepor, D1 simples)
  'BLAZE|SOBREPOR|18':          370,
  'BLAZE|SOBREPOR|26':          380,
  'BLAZE|SOBREPOR|36':          400,

  // Blaze arandela (mesmo preço do sobrepor)
  'BLAZE|ARANDELA|18':          370,
  'BLAZE|ARANDELA|26':          380,
  'BLAZE|ARANDELA|36':          400,
};

// Preços para D1+D2 onde família não distingue (HIT e EASY H PLUS)
const PRECO_D2 = {
  // Easy H Plus D1+D2: pot_total = 2×módulo
  'EASY H PLUS|PENDENTE|36':    600,   // módulo 18W × 2
  'EASY H PLUS|PENDENTE|52':    620,   // módulo 26W × 2
  'EASY H PLUS|PENDENTE|72':    660,   // módulo 36W × 2

  // Easy H Plus D1 (simples)
  'EASY H PLUS|PENDENTE|18_D1': 470,
  'EASY H PLUS|PENDENTE|26_D1': 480,
  'EASY H PLUS|PENDENTE|36_D1': 500,

  // Hit P D1+D2: pot_total = 2×módulo
  'HIT|PENDENTE|36_D2':         520,   // módulo 18W × 2
  'HIT|PENDENTE|52_D2':         550,   // módulo 26W × 2
  'HIT|PENDENTE|72_D2':         600,   // módulo 36W × 2
};

const DIM_ACRESCIMO = 160;

// ── Helpers ──────────────────────────────────────────────────────────────────
function parsePot(moduloLed) {
  const m = (moduloLed || '').match(/^(\d+)W/);
  return m ? parseInt(m[1]) : 0;
}

function isFita(moduloLed) {
  return (moduloLed || '').toUpperCase().includes('FITA');
}

function isD2(produtoNome) {
  const n = (produtoNome || '').toUpperCase();
  return n.includes('D1+D2') || n.includes('D1 + D2');
}

function isValidDriver(val) {
  const v = (val || '').trim().toUpperCase();
  return v !== '' && v !== 'NÃO APLICÁVEL' && v !== 'NAO APLICAVEL';
}

// ── Buscar produtos PERFIS ────────────────────────────────────────────────────
const [rows] = await conn.execute(
  `SELECT id, sku, familia, instalacao, produto, moduloLed, qtdModuloLed,
          driverOnoff220, driverOnoffBivolt, driverOnoffBivoltNaoAplicavel,
          driverDim110v, driverDim110vNaoAplicavel,
          driverDimDali, driverDimDaliNaoAplicavel
   FROM products
   WHERE UPPER(categoria) = 'PERFIS'`
);
console.log(`Total PERFIS: ${rows.length}`);

// ── Calcular e aplicar ────────────────────────────────────────────────────────
let ok = 0, skippedFita = 0, skippedSemPreco = 0;
const semPreco = [];

for (const p of rows) {
  const fam  = (p.familia    || '').toUpperCase().trim();
  const inst = (p.instalacao || '').toUpperCase().trim();
  const nome = (p.produto    || '').toUpperCase();

  if (isFita(p.moduloLed)) { skippedFita++; continue; }

  const potModulo = parsePot(p.moduloLed);
  const d2 = isD2(nome);

  // Calcular potência total
  let potTotal = potModulo;
  if (d2 || fam === 'BLAZE H') {
    potTotal = potModulo * 2;
  }

  // Buscar preço base
  let base = null;

  if (fam === 'EASY H PLUS' && inst === 'PENDENTE') {
    // Distinguir D1 vs D1+D2 pelo nome
    if (d2) {
      base = PRECO_D2[`EASY H PLUS|PENDENTE|${potTotal}`] ?? null;
    } else {
      base = PRECO_D2[`EASY H PLUS|PENDENTE|${potTotal}_D1`] ?? null;
    }
  } else if (fam === 'HIT' && inst === 'PENDENTE' && d2) {
    base = PRECO_D2[`HIT|PENDENTE|${potTotal}_D2`] ?? null;
  } else {
    base = PRECO[`${fam}|${inst}|${potTotal}`] ?? null;
  }

  if (base === null) {
    skippedSemPreco++;
    semPreco.push({ sku: p.sku, fam, inst, nome: p.produto, potModulo, potTotal, d2 });
    // Zerar preços para não deixar valores antigos errados
    await conn.execute(
      `UPDATE products SET precoVendaOnoff220=NULL, precoVendaOnoffBivolt=NULL, precoVendaDim110v=NULL, precoVendaDimDali=NULL WHERE id=?`,
      [p.id]
    );
    continue;
  }

  const has220    = isValidDriver(p.driverOnoff220);
  const hasBivolt = !p.driverOnoffBivoltNaoAplicavel && isValidDriver(p.driverOnoffBivolt);
  const hasDim110 = !p.driverDim110vNaoAplicavel && isValidDriver(p.driverDim110v);
  const hasDali   = !p.driverDimDaliNaoAplicavel && isValidDriver(p.driverDimDali);

  await conn.execute(
    `UPDATE products SET precoVendaOnoff220=?, precoVendaOnoffBivolt=?, precoVendaDim110v=?, precoVendaDimDali=? WHERE id=?`,
    [
      has220    ? base                 : null,
      hasBivolt ? base                 : null,
      hasDim110 ? base + DIM_ACRESCIMO : null,
      hasDali   ? base + DIM_ACRESCIMO : null,
      p.id
    ]
  );
  ok++;
}

console.log(`\nAtualizados: ${ok} | Fita (ignorados): ${skippedFita} | Sem mapeamento: ${skippedSemPreco}`);

if (semPreco.length > 0) {
  console.log('\n--- Sem mapeamento (primeiros 20) ---');
  for (const x of semPreco.slice(0, 20)) {
    console.log(`  ${x.sku} | ${x.fam} | ${x.inst} | pot=${x.potTotal}W | d2=${x.d2} | "${x.nome}"`);
  }
  // Resumo por família
  const porFam = {};
  for (const x of semPreco) {
    const k = `${x.fam}|${x.inst}`;
    porFam[k] = (porFam[k] || 0) + 1;
  }
  console.log('\nResumo sem mapeamento:');
  for (const [k, n] of Object.entries(porFam).sort()) console.log(`  ${k}: ${n}`);
}

// ── Verificação final ─────────────────────────────────────────────────────────
const [sample] = await conn.execute(
  `SELECT sku, familia, instalacao, produto, precoVendaOnoff220, precoVendaOnoffBivolt, precoVendaDim110v, precoVendaDimDali
   FROM products
   WHERE UPPER(categoria) = 'PERFIS'
     AND precoVendaOnoff220 IS NOT NULL
   ORDER BY familia, instalacao
   LIMIT 15`
);
console.log('\n--- Amostra com preço ---');
for (const r of sample) {
  console.log(`  ${r.sku} | ${r.familia} | ${r.instalacao} | 220=${r.precoVendaOnoff220} biv=${r.precoVendaOnoffBivolt} dim110=${r.precoVendaDim110v} dali=${r.precoVendaDimDali}`);
}

const [cnt] = await conn.execute(
  `SELECT
     SUM(CASE WHEN precoVendaOnoff220 IS NOT NULL THEN 1 ELSE 0 END) as com_220,
     SUM(CASE WHEN precoVendaDimDali IS NOT NULL THEN 1 ELSE 0 END) as com_dali,
     COUNT(*) as total
   FROM products WHERE UPPER(categoria) = 'PERFIS'`
);
console.log('\nContagem:', JSON.stringify(cnt[0]));

await conn.end();
