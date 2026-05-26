import mysql from 'mysql2/promise';
import fs from 'fs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não encontrada');
  process.exit(1);
}

const conn = await mysql.createConnection(url);

// 1. Verificar estado atual antes do update
const [before] = await conn.execute(
  `SELECT sku, familia, instalacao, precoVendaOnoff220, precoVendaOnoffBivolt, precoVendaDim110v, precoVendaDimDali
   FROM products
   WHERE UPPER(categoria) = 'PERFIS' AND UPPER(familia) = 'BLAZE' AND UPPER(instalacao) = 'EMBUTIR'
   LIMIT 3`
);
console.log('Estado ANTES BLAZE EMBUTIR:');
for (const r of before) {
  console.log(`  ${r.sku}: 220=${r.precoVendaOnoff220} biv=${r.precoVendaOnoffBivolt} dim110=${r.precoVendaDim110v} dali=${r.precoVendaDimDali}`);
}

// 2. Aplicar SQL
const sqlContent = fs.readFileSync('/home/ubuntu/update_precos.sql', 'utf8');
const statements = sqlContent.split('\n').filter(s => s.trim());
console.log(`\nExecutando ${statements.length} updates...`);

let ok = 0, errs = 0;
for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    ok++;
  } catch(e) {
    console.error('Erro:', e.message.substring(0, 100));
    errs++;
  }
}
console.log(`Concluído: ${ok} ok, ${errs} erros`);

// 3. Verificar resultado após update
const [after] = await conn.execute(
  `SELECT sku, familia, instalacao, precoVendaOnoff220, precoVendaOnoffBivolt, precoVendaDim110v, precoVendaDimDali
   FROM products
   WHERE UPPER(categoria) = 'PERFIS' AND UPPER(familia) = 'BLAZE' AND UPPER(instalacao) = 'EMBUTIR'
   LIMIT 5`
);
console.log('\nEstado APÓS BLAZE EMBUTIR:');
for (const r of after) {
  console.log(`  ${r.sku}: 220=${r.precoVendaOnoff220} biv=${r.precoVendaOnoffBivolt} dim110=${r.precoVendaDim110v} dali=${r.precoVendaDimDali}`);
}

// 4. Contagem geral
const [cnt] = await conn.execute(
  `SELECT COUNT(*) as total,
          SUM(CASE WHEN precoVendaOnoff220 IS NOT NULL THEN 1 ELSE 0 END) as com_preco_220,
          SUM(CASE WHEN precoVendaDimDali IS NOT NULL THEN 1 ELSE 0 END) as com_preco_dali
   FROM products WHERE UPPER(categoria) = 'PERFIS'`
);
console.log('\nContagem geral PERFIS:', JSON.stringify(cnt[0], null, 2));

await conn.end();
