import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar todos os detalhes dos duplicados
const [dups] = await conn.execute(`
  SELECT id, tipo, modelo, codigo, custo, observacao, createdAt
  FROM components
  WHERE tipo = 'MODULO_LED' AND modelo IN (
    'FITA LED HOPELUMI 24V 10W/M [CCT]',
    'FITA LED HOPELUMI 24V 25W/M [CCT]',
    'FITA LED HOPELUMI 24V 5W/M [CCT]',
    'STRIPFLEX 562,5 X 10MM 36L [CCT]'
  )
  ORDER BY modelo, id
`);

console.log('\n=== DETALHES DOS DUPLICADOS ===');
for (const d of dups) {
  console.log(`  ID ${d.id} | ${d.modelo} | codigo: ${d.codigo} | custo: ${d.custo} | obs: ${d.observacao} | criado: ${d.createdAt}`);
}

// Verificar quantos produtos usam cada modelo (por texto)
const modelos = [...new Set(dups.map(d => d.modelo))];
console.log('\n=== PRODUTOS POR MODELO (texto) ===');
for (const m of modelos) {
  const [rows] = await conn.execute(
    'SELECT COUNT(*) as qtd FROM products WHERE moduloLed = ?', [m]
  );
  console.log(`  "${m}" → ${rows[0].qtd} produtos`);
}

// Verificar também todos os outros tipos duplicados (drivers, oticas, etc.)
console.log('\n=== TODOS OS DUPLICADOS (todos os tipos) ===');
const [allDups] = await conn.execute(`
  SELECT tipo, modelo, COUNT(*) as qtd, GROUP_CONCAT(id ORDER BY id) as ids,
         GROUP_CONCAT(codigo ORDER BY id) as codigos,
         GROUP_CONCAT(IFNULL(custo,'null') ORDER BY id) as custos
  FROM components
  GROUP BY tipo, modelo
  HAVING COUNT(*) > 1
  ORDER BY tipo, modelo
`);
for (const d of allDups) {
  console.log(`  [${d.tipo}] "${d.modelo}" — ${d.qtd}x | ids: ${d.ids} | codigos: ${d.codigos} | custos: ${d.custos}`);
}

await conn.end();
