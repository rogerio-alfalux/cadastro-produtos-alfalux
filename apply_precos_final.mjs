import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

// 1. Verificar famílias e módulos dos produtos PERFIS
const [rows] = await conn.execute(`
  SELECT familia, instalacao, moduloLed, COUNT(*) as cnt
  FROM products
  WHERE categoria = 'PERFIS'
  GROUP BY familia, instalacao, moduloLed
  ORDER BY familia, instalacao, moduloLed
`);

console.log('\n=== PRODUTOS PERFIS NO BANCO ===');
rows.forEach(r => console.log(`${r.familia} | ${r.instalacao} | "${r.moduloLed}" | ${r.cnt} produtos`));

// Mapeamento da planilha: [familia_banco, instalacao_banco, pot_w] -> {onoff220, dim}
// Potência extraída do início do campo modulo_led (ex: "18W STRIPFLEX..." -> 18)
// Para D1+D2: potência total = 2x módulo, mas o módulo no banco é o individual
// Regra: pot_modulo = potência do módulo individual
//   18W -> produto 18W (D1 simples) ou 36W total (D1+D2 com 2x18W)
//   26W -> produto 26W (D1 simples) ou 52W total (D1+D2 com 2x26W)
//   36W -> produto 36W (D1 simples) ou 72W total (D1+D2 com 2x36W)

// Mapeamento: {familia, instalacao_like, pot_modulo, configuracao} -> {onoff, dim_acrescimo}
// dim = onoff + 160 (stripflex/stripline)
const MAPA = [
  // Blaze E (embutir) - D1 simples
  { familia: 'BLAZE', instalacao: 'EMBUTIR', pot: 18, config: 'D1', onoff: 330 },
  { familia: 'BLAZE', instalacao: 'EMBUTIR', pot: 26, config: 'D1', onoff: 340 },
  { familia: 'BLAZE', instalacao: 'EMBUTIR', pot: 36, config: 'D1', onoff: 360 },

  // Easy Prime E (embutir) - D1 simples
  { familia: 'EASY PRIME', instalacao: 'EMBUTIR', pot: 18, config: 'D1', onoff: 310 },
  { familia: 'EASY PRIME', instalacao: 'EMBUTIR', pot: 26, config: 'D1', onoff: 320 },
  { familia: 'EASY PRIME', instalacao: 'EMBUTIR', pot: 36, config: 'D1', onoff: 340 },

  // Skyline E (embutir) - D1 simples
  { familia: 'SKYLINE', instalacao: 'EMBUTIR', pot: 18, config: 'D1', onoff: 270 },
  { familia: 'SKYLINE', instalacao: 'EMBUTIR', pot: 26, config: 'D1', onoff: 280 },
  { familia: 'SKYLINE', instalacao: 'EMBUTIR', pot: 36, config: 'D1', onoff: 300 },

  // Blaze H P D1 (pendente D1 simples) - família BLAZE H
  { familia: 'BLAZE H', instalacao: 'PENDENTE', pot: 18, config: 'D1', onoff: 410 },
  { familia: 'BLAZE H', instalacao: 'PENDENTE', pot: 26, config: 'D1', onoff: 420 },
  { familia: 'BLAZE H', instalacao: 'PENDENTE', pot: 36, config: 'D1', onoff: 440 },

  // Blaze H P D1+D2 (pendente D1+D2) - família BLAZE H, pot módulo = metade da total
  // 18W total -> módulo 9W? Não. A planilha diz 18W/26W/36W = potência POR BARRA
  // D1+D2 com 18W = 18W para baixo + 18W para cima = 36W total, mas preço é R$460
  // Então o módulo no banco para D1+D2 18W seria 18W também
  // Precisamos distinguir D1 de D1+D2 pela configuracaoPlanos
  // Como ainda não está definido, vamos usar os campos D1D2 separados
  { familia: 'BLAZE H', instalacao: 'PENDENTE', pot: 18, config: 'D1+D2', onoff: 460 },
  { familia: 'BLAZE H', instalacao: 'PENDENTE', pot: 26, config: 'D1+D2', onoff: 480 },
  { familia: 'BLAZE H', instalacao: 'PENDENTE', pot: 36, config: 'D1+D2', onoff: 520 },

  // Mini Blaze P (pendente e sobrepor)
  { familia: 'MINI BLAZE', instalacao: 'PENDENTE', pot: 18, config: 'D1', onoff: 310 },
  { familia: 'MINI BLAZE', instalacao: 'PENDENTE', pot: 26, config: 'D1', onoff: 320 },
  { familia: 'MINI BLAZE', instalacao: 'PENDENTE', pot: 36, config: 'D1', onoff: 340 },
  { familia: 'MINI BLAZE', instalacao: 'SOBREPOR', pot: 18, config: 'D1', onoff: 310 },
  { familia: 'MINI BLAZE', instalacao: 'SOBREPOR', pot: 26, config: 'D1', onoff: 320 },
  { familia: 'MINI BLAZE', instalacao: 'SOBREPOR', pot: 36, config: 'D1', onoff: 340 },

  // Easy H Plus D1 (pendente)
  { familia: 'EASY H PLUS', instalacao: 'PENDENTE', pot: 18, config: 'D1', onoff: 470 },
  { familia: 'EASY H PLUS', instalacao: 'PENDENTE', pot: 26, config: 'D1', onoff: 480 },
  { familia: 'EASY H PLUS', instalacao: 'PENDENTE', pot: 36, config: 'D1', onoff: 500 },

  // Easy H Plus D1+D2 (pendente)
  { familia: 'EASY H PLUS', instalacao: 'PENDENTE', pot: 18, config: 'D1+D2', onoff: 600 },
  { familia: 'EASY H PLUS', instalacao: 'PENDENTE', pot: 26, config: 'D1+D2', onoff: 620 },
  { familia: 'EASY H PLUS', instalacao: 'PENDENTE', pot: 36, config: 'D1+D2', onoff: 660 },

  // Hit P D1 (pendente)
  { familia: 'HIT', instalacao: 'PENDENTE', pot: 18, config: 'D1', onoff: 410 },
  { familia: 'HIT', instalacao: 'PENDENTE', pot: 26, config: 'D1', onoff: 420 },
  { familia: 'HIT', instalacao: 'PENDENTE', pot: 36, config: 'D1', onoff: 440 },

  // Hit P D1+D2 (pendente)
  { familia: 'HIT', instalacao: 'PENDENTE', pot: 18, config: 'D1+D2', onoff: 520 },
  { familia: 'HIT', instalacao: 'PENDENTE', pot: 26, config: 'D1+D2', onoff: 550 },
  { familia: 'HIT', instalacao: 'PENDENTE', pot: 36, config: 'D1+D2', onoff: 600 },

  // Blaze S D1 (sobrepor)
  { familia: 'BLAZE', instalacao: 'SOBREPOR', pot: 18, config: 'D1', onoff: 370 },
  { familia: 'BLAZE', instalacao: 'SOBREPOR', pot: 26, config: 'D1', onoff: 380 },
  { familia: 'BLAZE', instalacao: 'SOBREPOR', pot: 36, config: 'D1', onoff: 400 },
];

// Para cada entrada do mapa, atualizar os produtos correspondentes
// A potência é extraída do início do campo modulo_led
// Campos a atualizar:
//   config D1  -> preco_venda_onoff220, preco_venda_onoff_bivolt (= onoff), preco_venda_dim110v, preco_venda_dim_dali (= onoff + 160)
//   config D1+D2 -> preco_venda_onoff220_d1d2, preco_venda_onoff_bivolt_d1d2, preco_venda_dim110v_d1d2, preco_venda_dim_dali_d1d2

let totalUpdated = 0;
const updates = [];

for (const m of MAPA) {
  const dim = m.onoff + 160;
  
  let setClause, whereExtra = '';
  
  if (m.config === 'D1') {
    setClause = `
      precoVendaOnoff220 = ${m.onoff},
      precoVendaOnoffBivolt = ${m.onoff},
      precoVendaDim110v = CASE WHEN driverDim110v IS NOT NULL AND driverDim110v != '' AND driverDim110v != 'NÃO APLICÁVEL' THEN ${dim} ELSE precoVendaDim110v END,
      precoVendaDimDali = CASE WHEN driverDimDali IS NOT NULL AND driverDimDali != '' AND driverDimDali != 'NÃO APLICÁVEL' THEN ${dim} ELSE precoVendaDimDali END
    `;
  } else {
    // D1+D2
    setClause = `
      precoVendaOnoff220D1D2 = ${m.onoff},
      precoVendaOnoffBivoltD1D2 = ${m.onoff},
      precoVendaDim110vD1D2 = CASE WHEN driverDim110v IS NOT NULL AND driverDim110v != '' AND driverDim110v != 'NÃO APLICÁVEL' THEN ${dim} ELSE precoVendaDim110vD1D2 END,
      precoVendaDimDaliD1D2 = CASE WHEN driverDimDali IS NOT NULL AND driverDimDali != '' AND driverDimDali != 'NÃO APLICÁVEL' THEN ${dim} ELSE precoVendaDimDaliD1D2 END
    `;
  }

  const sql = `
    UPDATE products
    SET ${setClause}
    WHERE categoria = 'PERFIS'
      AND familia = ?
      AND instalacao = ?
      AND CAST(REGEXP_SUBSTR(moduloLed, '^[0-9]+') AS UNSIGNED) = ?
  `;

  const [result] = await conn.execute(sql, [m.familia, m.instalacao, m.pot]);
  totalUpdated += result.affectedRows;
  updates.push({ ...m, affected: result.affectedRows });
  console.log(`${m.familia} | ${m.instalacao} | ${m.pot}W | ${m.config} | R$${m.onoff}/R$${dim} -> ${result.affectedRows} produtos`);
}

console.log(`\n=== TOTAL: ${totalUpdated} produtos atualizados ===`);

await conn.end();
