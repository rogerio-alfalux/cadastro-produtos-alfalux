/**
 * Script de deduplicação de drivers por código EQ
 *
 * Lógica:
 * 1. Busca todos os drivers (tipo = 'driver') com código EQ no modelo
 * 2. Agrupa por código EQ
 * 3. Para cada grupo com mais de 1 driver, escolhe o canônico (critério: maior id ou o que tem código preenchido)
 * 4. Atualiza todos os produtos que usavam os duplicados para usar o modelo canônico
 * 5. Remove os drivers duplicados da tabela components
 *
 * Campos de driver nos produtos:
 *   driverOnoff220, driverOnoffBivolt, driverDim110v, driverDimDali
 *   + os campos Extra (JSON arrays)
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');

// Ler DATABASE_URL do .env
let DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  try {
    const env = readFileSync(envPath, 'utf8');
    const match = env.match(/DATABASE_URL=["']?([^\n"']+)/);
    if (match) DATABASE_URL = match[1].trim();
  } catch {}
}
if (!DATABASE_URL) {
  console.error('DATABASE_URL não encontrada');
  process.exit(1);
}

// Parsear URL para conexão mysql2
function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || '4000'),
    user: u.username,
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    ssl: { rejectUnauthorized: false },
  };
}

/** Extrai código EQ do nome do driver */
function extractEq(model) {
  if (!model) return null;
  const m = model.match(/\b(EQ\d{4,})\b/i);
  return m ? m[1].toUpperCase() : null;
}

const DRIVER_FIELDS = ['driverOnoff220', 'driverOnoffBivolt', 'driverDim110v', 'driverDimDali'];
const DRIVER_EXTRA_FIELDS = ['driverOnoff220Extra', 'driverOnoffBivoltExtra', 'driverDim110vExtra', 'driverDimDaliExtra'];

async function main() {
  const conn = await mysql.createConnection(parseDbUrl(DATABASE_URL));
  console.log('Conectado ao banco.\n');

  try {
    // 1. Buscar todos os drivers com EQ no modelo
    // Tipos de driver na tabela components
    const DRIVER_TYPES = ['DRIVER_ONOFF_220', 'DRIVER_ONOFF_BIVOLT', 'DRIVER_DIM_110V', 'DRIVER_DIM_DALI'];
    const placeholders = DRIVER_TYPES.map(() => '?').join(',');
    const [drivers] = await conn.execute(
      `SELECT id, tipo, modelo, codigo FROM components WHERE tipo IN (${placeholders})`,
      DRIVER_TYPES
    );

    // Agrupar por EQ
    const byEq = {};
    for (const d of drivers) {
      const eq = extractEq(d.modelo) || (d.codigo ? d.codigo.toUpperCase() : null);
      if (!eq) continue;
      if (!byEq[eq]) byEq[eq] = [];
      byEq[eq].push(d);
    }

    // Filtrar apenas grupos com duplicatas
    const duplicateGroups = Object.entries(byEq).filter(([, group]) => group.length > 1);
    console.log(`Grupos com EQ duplicado: ${duplicateGroups.length}`);

    if (duplicateGroups.length === 0) {
      console.log('Nenhuma duplicata encontrada.');
      await conn.end();
      return;
    }

    // Para cada grupo, mostrar e definir canônico
    // Critério: preferir o que tem código EQ preenchido na coluna `codigo`, depois o de maior id
    const migrations = []; // { eq, canonical, duplicates: [modelo, ...] }

    for (const [eq, group] of duplicateGroups) {
      // Canônico: primeiro o que tem codigo preenchido, depois o de maior id
      const withCode = group.filter(d => d.codigo && d.codigo.trim());
      const canonical = withCode.length > 0
        ? withCode.sort((a, b) => b.id - a.id)[0]
        : group.sort((a, b) => b.id - a.id)[0];

      const duplicates = group.filter(d => d.id !== canonical.id);

      console.log(`\nEQ: ${eq}`);
      console.log(`  Canônico (id=${canonical.id}): "${canonical.modelo}"`);
      duplicates.forEach(d => console.log(`  Duplicata (id=${d.id}): "${d.modelo}"`));

      migrations.push({ eq, canonical, duplicates });
    }

    console.log('\n--- Iniciando migração de produtos ---\n');

    // 2. Para cada grupo de duplicatas, atualizar produtos
    let totalProductsUpdated = 0;
    let totalFieldsUpdated = 0;

    for (const { eq, canonical, duplicates } of migrations) {
      const duplicateModelos = duplicates.map(d => d.modelo);

      // Buscar todos os produtos que usam algum dos modelos duplicados
      // Verificar campos simples e campos Extra (JSON)
      const [products] = await conn.execute(
        `SELECT id, driverOnoff220, driverOnoffBivolt, driverDim110v, driverDimDali,
                driverOnoff220Extra, driverOnoffBivoltExtra, driverDim110vExtra, driverDimDaliExtra
         FROM products`
      );

      for (const product of products) {
        let changed = false;
        const updates = {};

        // Verificar campos simples
        for (const field of DRIVER_FIELDS) {
          const val = product[field];
          if (val && duplicateModelos.includes(val)) {
            updates[field] = canonical.modelo;
            changed = true;
            totalFieldsUpdated++;
            console.log(`  Produto id=${product.id}: ${field} "${val}" → "${canonical.modelo}"`);
          }
        }

        // Verificar campos Extra (JSON arrays)
        for (const field of DRIVER_EXTRA_FIELDS) {
          const raw = product[field];
          if (!raw) continue;
          let extras;
          try { extras = JSON.parse(raw); } catch { continue; }
          if (!Array.isArray(extras)) continue;

          let extraChanged = false;
          const newExtras = extras.map(e => {
            if (e.modelo && duplicateModelos.includes(e.modelo)) {
              extraChanged = true;
              totalFieldsUpdated++;
              console.log(`  Produto id=${product.id}: ${field}[].modelo "${e.modelo}" → "${canonical.modelo}"`);
              return { ...e, modelo: canonical.modelo };
            }
            return e;
          });

          if (extraChanged) {
            updates[field] = JSON.stringify(newExtras);
            changed = true;
          }
        }

        if (changed) {
          const setClauses = Object.keys(updates).map(k => `\`${k}\` = ?`).join(', ');
          const values = [...Object.values(updates), product.id];
          await conn.execute(`UPDATE products SET ${setClauses} WHERE id = ?`, values);
          totalProductsUpdated++;
        }
      }
    }

    console.log(`\n✅ Produtos atualizados: ${totalProductsUpdated}`);
    console.log(`✅ Campos atualizados: ${totalFieldsUpdated}`);

    // 3. Remover drivers duplicados da tabela components
    console.log('\n--- Removendo drivers duplicados ---\n');
    let totalRemoved = 0;

    for (const { eq, canonical, duplicates } of migrations) {
      for (const dup of duplicates) {
        await conn.execute('DELETE FROM components WHERE id = ?', [dup.id]);
        console.log(`  Removido: id=${dup.id} "${dup.modelo}" (EQ: ${eq}, canônico: "${canonical.modelo}")`);
        totalRemoved++;
      }
    }

    console.log(`\n✅ Drivers duplicados removidos: ${totalRemoved}`);
    console.log('\n🎉 Deduplicação concluída com sucesso!');

  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
