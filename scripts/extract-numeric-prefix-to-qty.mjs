/**
 * Script: extract-numeric-prefix-to-qty.mjs
 *
 * Para todos os componentes com prefixo numérico no nome (ex: "15.5x Stripflex...", "2.1X TRACE..."):
 * 1. Extrai a quantidade do prefixo
 * 2. Renomeia o componente para o valor unitário (sem prefixo)
 * 3. Se já existe um componente com o nome unitário, usa esse como canônico
 * 4. Atualiza todos os produtos que usavam o componente prefixado:
 *    - Substitui o modelo pelo nome unitário
 *    - Atualiza o campo de quantidade correspondente
 * 5. Remove o componente prefixado (se foi substituído por canônico existente)
 *
 * Campos de produtos afetados:
 *   MODULO_LED  → moduloLed + qtdModuloLed
 *   OTICA       → otica + qtdOtica + oticaExtra (JSON)
 *   HOLDER      → holder + qtdHolder
 *   DISSIPADOR  → dissipador + qtdDissipador
 *   DRIVER_*    → driverOnoff220/Bivolt/Dim110v/DimDali + qtd* + *Extra (JSON)
 */

import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL não encontrada no ambiente');

function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || '4000'),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace('/', ''),
    ssl: { rejectUnauthorized: false },
  };
}

const conn = await mysql.createConnection(parseDbUrl(dbUrl));
console.log('✅ Conectado ao banco de dados');

// Regex para capturar prefixo numérico: "15.5x", "2.1X", "3X", "10x" etc.
// Aceita inteiros e decimais com . ou ,
const PREFIX_RE = /^(\d+(?:[.,]\d+)?)[xX]\s+(.+)$/;

function parsePrefix(model) {
  const m = model.trim().match(PREFIX_RE);
  if (!m) return null;
  const qty = parseFloat(m[1].replace(',', '.'));
  const name = m[2].trim();
  return { qty, name };
}

// Mapeamento tipo de componente → campos do produto
const TYPE_MAP = {
  MODULO_LED: {
    modelField: 'moduloLed',
    qtdField: 'qtdModuloLed',
    extraField: null,
  },
  OTICA: {
    modelField: 'otica',
    qtdField: 'qtdOtica',
    extraField: 'oticaExtra',
  },
  HOLDER: {
    modelField: 'holder',
    qtdField: 'qtdHolder',
    extraField: null,
  },
  DISSIPADOR: {
    modelField: 'dissipador',
    qtdField: 'qtdDissipador',
    extraField: null,
  },
  DRIVER_ONOFF_220: {
    modelField: 'driverOnoff220',
    qtdField: 'qtdDriverOnoff220',
    extraField: 'driverOnoff220Extra',
  },
  DRIVER_ONOFF_BIVOLT: {
    modelField: 'driverOnoffBivolt',
    qtdField: 'qtdDriverOnoffBivolt',
    extraField: 'driverOnoffBivoltExtra',
  },
  DRIVER_DIM_110V: {
    modelField: 'driverDim110v',
    qtdField: 'qtdDriverDim110v',
    extraField: 'driverDim110vExtra',
  },
  DRIVER_DIM_DALI: {
    modelField: 'driverDimDali',
    qtdField: 'qtdDriverDimDali',
    extraField: 'driverDimDaliExtra',
  },
};

// Verificar quais colunas existem na tabela products
const [cols] = await conn.execute('SHOW COLUMNS FROM products');
const colNames = new Set(cols.map(c => c.Field));

// Buscar todos os componentes
const [allComponents] = await conn.execute('SELECT id, modelo, tipo, codigo, custo FROM components ORDER BY tipo, modelo');

let totalUpdatedProducts = 0;
let totalRenamedComponents = 0;
let totalRemovedComponents = 0;

// Agrupar por tipo
const byType = {};
for (const comp of allComponents) {
  if (!byType[comp.tipo]) byType[comp.tipo] = [];
  byType[comp.tipo].push(comp);
}

for (const [tipo, components] of Object.entries(byType)) {
  const mapping = TYPE_MAP[tipo];
  if (!mapping) continue;

  // Encontrar componentes com prefixo numérico
  const prefixed = components.filter(c => parsePrefix(c.modelo));
  if (prefixed.length === 0) continue;

  console.log(`\n[${tipo}] — ${prefixed.length} componente(s) com prefixo numérico:`);

  for (const comp of prefixed) {
    const parsed = parsePrefix(comp.modelo);
    if (!parsed) continue;

    const { qty, name } = parsed;
    console.log(`  "${comp.modelo}" → nome unitário: "${name}", qty: ${qty}`);

    // Verificar se já existe um componente com o nome unitário (mesmo tipo)
    const canonical = components.find(c => c.id !== comp.id && c.modelo.trim().toLowerCase() === name.toLowerCase());

    let targetModel;
    if (canonical) {
      console.log(`    → Canônico existente encontrado: id=${canonical.id} "${canonical.modelo}"`);
      targetModel = canonical.modelo; // usar o nome exato do canônico
    } else {
      // Renomear o próprio componente para o nome unitário
      await conn.execute('UPDATE components SET modelo = ? WHERE id = ?', [name, comp.id]);
      console.log(`    → Componente id=${comp.id} renomeado para "${name}"`);
      totalRenamedComponents++;
      targetModel = name;
    }

    // Atualizar produtos que usam o modelo prefixado no campo principal
    const { modelField, qtdField, extraField } = mapping;

    if (colNames.has(modelField) && colNames.has(qtdField)) {
      const [rows] = await conn.execute(
        `SELECT id, \`${modelField}\`, \`${qtdField}\` FROM products WHERE \`${modelField}\` = ?`,
        [comp.modelo]
      );

      for (const row of rows) {
        const currentQty = row[qtdField] || 1;
        const newQty = Math.round(qty * currentQty * 100) / 100; // multiplicar quantidades
        await conn.execute(
          `UPDATE products SET \`${modelField}\` = ?, \`${qtdField}\` = ? WHERE id = ?`,
          [targetModel, newQty, row.id]
        );
        totalUpdatedProducts++;
        console.log(`    → Produto id=${row.id}: modelo="${targetModel}", qty=${newQty}`);
      }
    }

    // Atualizar campos extras (JSON arrays)
    if (extraField && colNames.has(extraField)) {
      const [extraRows] = await conn.execute(
        `SELECT id, \`${extraField}\` FROM products WHERE \`${extraField}\` IS NOT NULL AND \`${extraField}\` != '[]' AND \`${extraField}\` != 'null'`
      );

      for (const row of extraRows) {
        let extras;
        try {
          extras = JSON.parse(row[extraField]);
        } catch { continue; }
        if (!Array.isArray(extras)) continue;

        let changed = false;
        const updated = extras.map(e => {
          if (e.modelo === comp.modelo) {
            changed = true;
            const newQty = Math.round((e.qtd || 1) * qty * 100) / 100;
            return { ...e, modelo: targetModel, qtd: newQty };
          }
          return e;
        });

        if (changed) {
          await conn.execute(
            `UPDATE products SET \`${extraField}\` = ? WHERE id = ?`,
            [JSON.stringify(updated), row.id]
          );
          totalUpdatedProducts++;
          console.log(`    → Produto id=${row.id} extra atualizado`);
        }
      }
    }

    // Se havia canônico existente, remover o componente prefixado
    if (canonical) {
      await conn.execute('DELETE FROM components WHERE id = ?', [comp.id]);
      console.log(`    → Componente id=${comp.id} removido (substituído por canônico id=${canonical.id})`);
      totalRemovedComponents++;
    }
  }
}

await conn.end();

console.log(`\n========================================`);
console.log(`✅ Migração concluída:`);
console.log(`   ${totalRenamedComponents} componentes renomeados (prefixo removido)`);
console.log(`   ${totalRemovedComponents} componentes removidos (substituídos por canônico)`);
console.log(`   ${totalUpdatedProducts} atualizações em produtos`);
