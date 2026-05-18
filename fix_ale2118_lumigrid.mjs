import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const updates = [
  // ALE-2118.2 18W (ID 192)
  {
    id: 192,
    moduloLed: '2X STRIPFLEX 562,5 X 10MM 36L [CCT]',
    driverOnoff220: 'PHILIPS XITANIUM 19W 350MA (EQ00346)',
    driverOnoffBivolt: 'LIFUD 20W LF-FMR020YS0350U(S) 350MA (EQ00580)',
    driverOnoffBivoltNaoAplicavel: false,
    holder: '', holderNaoAplicavel: true,
    otica: '', oticaNaoAplicavel: true,
    dissipador: '', dissipadorNaoAplicavel: true,
    sku: 'LLE-2118.250.04M',
  },
  // ALE-2118.3 26W (ID 194)
  {
    id: 194,
    moduloLed: '3X STRIPFLEX 562,5 X 10MM 36L [CCT]',
    driverOnoff220: 'PHILIPS XITANIUM 44W 350MA (EQ00347)',
    driverOnoffBivolt: 'LIFUD 40W LF-FMR040YS0350U(S) 350MA (EQ00581)',
    driverOnoffBivoltNaoAplicavel: false,
    holder: '', holderNaoAplicavel: true,
    otica: '', oticaNaoAplicavel: true,
    dissipador: '', dissipadorNaoAplicavel: true,
    sku: 'LLE-2118.350.04M',
  },
  // ALE-2118.4 36W (ID 196)
  {
    id: 196,
    moduloLed: '4X STRIPFLEX 562,5 X 10MM 36L [CCT]',
    driverOnoff220: 'PHILIPS XITANIUM 44W 350MA (EQ00347)',
    driverOnoffBivolt: 'LIFUD 40W LF-FMR040YS0350U(S) 350MA (EQ00581)',
    driverOnoffBivoltNaoAplicavel: false,
    holder: '', holderNaoAplicavel: true,
    otica: '', oticaNaoAplicavel: true,
    dissipador: '', dissipadorNaoAplicavel: true,
    sku: 'LLE-2118.450.08F',
  },
  // LUMIGRID E 36W (ID 163)
  {
    id: 163,
    moduloLed: '',
    driverOnoff220: '1X LIFUD 40W 1000MA BIVOLT (LF-GIF040YCII1000U) (EQ00496)',
    driverOnoffBivolt: '1X LIFUD 40W 1000MA BIVOLT (LF-GIF040YCII1000U) (EQ00496)',
    driverOnoffBivoltNaoAplicavel: false,
    holder: '', holderNaoAplicavel: true,
    otica: '', oticaNaoAplicavel: true,
    dissipador: '', dissipadorNaoAplicavel: true,
    sku: 'NÃO APLICÁVEL',
  },
  // LUMIGRID S 36W (ID 164)
  {
    id: 164,
    moduloLed: '',
    driverOnoff220: '1X LIFUD 40W 1000MA BIVOLT (LF-GIF040YCII1000U) (EQ00496)',
    driverOnoffBivolt: '1X LIFUD 40W 1000MA BIVOLT (LF-GIF040YCII1000U) (EQ00496)',
    driverOnoffBivoltNaoAplicavel: false,
    holder: '', holderNaoAplicavel: true,
    otica: '', oticaNaoAplicavel: true,
    dissipador: '', dissipadorNaoAplicavel: true,
    sku: 'LLS-3454.620.65F',
  },
];

for (const u of updates) {
  const { id, ...fields } = u;
  const setClauses = Object.keys(fields).map(k => `\`${k}\` = ?`).join(', ');
  const values = [...Object.values(fields), id];
  const [result] = await conn.execute(
    `UPDATE products SET ${setClauses} WHERE id = ?`,
    values
  );
  console.log(`ID ${id}: ${result.affectedRows} linha(s) afetada(s)`);
}

// Verificar resultado
const [rows] = await conn.execute(
  `SELECT id, produto, familia, sku, moduloLed, driverOnoff220, driverOnoffBivolt, holderNaoAplicavel, oticaNaoAplicavel FROM products WHERE id IN (192, 194, 196, 163, 164) ORDER BY familia, produto`
);
console.log('\n=== Verificação final ===');
for (const r of rows) {
  console.log(`[${r.id}] ${r.produto} (${r.familia})`);
  console.log(`  SKU: ${r.sku}`);
  console.log(`  moduloLed: ${r.moduloLed}`);
  console.log(`  driver220: ${r.driverOnoff220}`);
  console.log(`  driverBivolt: ${r.driverOnoffBivolt}`);
  console.log(`  holderNaoAplicavel: ${r.holderNaoAplicavel} | oticaNaoAplicavel: ${r.oticaNaoAplicavel}`);
}

await conn.end();
console.log('\nConcluído!');
