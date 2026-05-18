import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Mapeamento família → foto (todos os produtos da família recebem a mesma foto)
const FOTO_FAMILIA = {
  'ALE-2140':   '/manus-storage/ALE-2140_a5c7257c.jpg',
  'ALE-2420':   '/manus-storage/ALE-2420_5e830256.jpg',
  'ALE-2142':   '/manus-storage/ALE-2142_e18d7f04.jpg',
  'ALE-2430':   '/manus-storage/ALE-2430_d1bd2a16.jpg',
  'ALS-3750':   '/manus-storage/ALS-3750_02704719.png',
  'ALS-3420':   '/manus-storage/ALS-3420_b988c157.jpg',
  'BOX LED E':  '/manus-storage/BOXLEDE_373a05ac.png',
  'BOX LED S':  '/manus-storage/BOXLEDS_ce3b6dd6.png',
  'ALE-2750':   '/manus-storage/ALE-2750_23d3c9e0.png',
  'ALE-2462':   '/manus-storage/ALE-2462_98e0cf0a.png',
  'ALS-3462':   '/manus-storage/ALS-3462_d388fedb.png',
  'ORBIT E':    '/manus-storage/ORBITE_0da6aa43.png',
  'ORBIT S':    '/manus-storage/ORBITS_494a5982.png',
  'ORBIT P':    '/manus-storage/ORBITP_439568c5.png',
  'PRISMA':     '/manus-storage/PRISMA_f482458d.jpg',
  // ALE-2103 genérico (36W sem RTG)
  'ALE-2103':   '/manus-storage/ALE-2103_de9dd9f2.jpg',
  // ALE-2118 genérico (fallback)
  'ALE-2118':   '/manus-storage/ALE-2118.2_0c8a6630.jpg',
};

// Mapeamento por produto específico (sobrescreve família)
const FOTO_PRODUTO = {
  // ALE-2103
  'ALE-2103 18W':     '/manus-storage/ALE-2103_de9dd9f2.jpg',
  'ALE-2103 26W':     '/manus-storage/ALE-2103_de9dd9f2.jpg',
  'ALE-2103 36W':     '/manus-storage/ALE-2103_de9dd9f2.jpg',
  'ALE-2103 RTG 18W': '/manus-storage/ALE-2103RTG_7c28fc22.jpg',
  'ALE-2103 RTG 26W': '/manus-storage/ALE-2103RTG_7c28fc22.jpg',
  'ALE-2103 RTG 36W': '/manus-storage/ALE-2103RTG_7c28fc22.jpg',
  // ALE-2118
  'ALE-2118.2 18W':   '/manus-storage/ALE-2118.2_0c8a6630.jpg',
  'ALE-2118.2 36W':   '/manus-storage/ALE-2118.2_0c8a6630.jpg',
  'ALE-2118.3 26W':   '/manus-storage/ALE-2118.3_0e546e36.jpg',
  'ALE-2118.3 36W':   '/manus-storage/ALE-2118.3_0e546e36.jpg',
  'ALE-2118.4 36W':   '/manus-storage/ALE-2118.4_261c2e18.jpg',
  // OFFICE COMFORT
  'OFFICE COMFORT 2X3 32W (618 X 618MM)':  '/manus-storage/OFFICECOMFORT2x332W(618x618mm)_0750d47b.png',
  'OFFICE COMFORT 2X3 32W (618 X 155MM)':  '/manus-storage/OFFICECOMFORT2x332W(618x155mm)_9e250f13.png',
  'OFFICE COMFORT 1X6 32W (1243 X 155MM)': '/manus-storage/OFFICECOMFORT1x632W(1243x155mm)_f99e93ef.png',
};

// Buscar todos os painéis
const [rows] = await conn.execute(
  "SELECT id, produto, familia, fotoUrl FROM products WHERE categoria = 'PAINÉIS' ORDER BY familia, produto"
);

console.log(`Total painéis: ${rows.length}`);

let updated = 0;
let noMap = [];

for (const row of rows) {
  const prodUpper = (row.produto || '').toUpperCase().trim();
  const familia = (row.familia || '').trim();

  // Tentar mapeamento por produto específico
  let fotoUrl = null;
  for (const [key, url] of Object.entries(FOTO_PRODUTO)) {
    if (key.toUpperCase() === prodUpper) {
      fotoUrl = url;
      break;
    }
  }

  // Fallback: mapeamento por família
  if (!fotoUrl) {
    fotoUrl = FOTO_FAMILIA[familia] || null;
  }

  if (!fotoUrl) {
    noMap.push(`${familia} / ${row.produto}`);
    continue;
  }

  if (row.fotoUrl === fotoUrl) continue; // já está correto

  const [result] = await conn.execute(
    'UPDATE products SET fotoUrl = ? WHERE id = ?',
    [fotoUrl, row.id]
  );
  if (result.affectedRows > 0) {
    updated++;
    console.log(`✓ [${row.id}] ${row.produto} → ${fotoUrl}`);
  }
}

console.log(`\n=== Resultado ===`);
console.log(`Atualizados: ${updated}`);
console.log(`Sem mapeamento: ${noMap.length}`);
if (noMap.length > 0) {
  console.log('Produtos sem foto:');
  noMap.forEach(n => console.log(`  - ${n}`));
}

await conn.end();
