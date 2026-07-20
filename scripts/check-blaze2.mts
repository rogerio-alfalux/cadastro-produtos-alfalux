import { createConnection } from "mysql2/promise";

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  
  // Ver famílias BLAZE
  const [rows] = await conn.execute(`
    SELECT familia, COUNT(*) as qtd 
    FROM products 
    WHERE familia LIKE '%BLAZE%' 
    GROUP BY familia
    ORDER BY familia
  `);
  console.log("=== Famílias BLAZE no banco ===");
  console.log(JSON.stringify(rows, null, 2));
  
  // Ver exemplos de produtos por família (campo descricao ou produto)
  const [cols] = await conn.execute(`SHOW COLUMNS FROM products LIKE '%nom%'`);
  console.log("\nColunas com 'nom':", JSON.stringify(cols));
  
  const [cols2] = await conn.execute(`SHOW COLUMNS FROM products LIKE '%desc%'`);
  console.log("Colunas com 'desc':", JSON.stringify(cols2));
  
  // Pegar exemplos do campo produto ou descricao
  const [examples] = await conn.execute(`
    SELECT familia, produto, id
    FROM products 
    WHERE familia = 'BLAZE'
    LIMIT 10
  `);
  console.log("\n=== Exemplos BLAZE (campo produto) ===");
  for (const e of examples as any[]) {
    console.log(`  [${e.familia}] ${e.produto}`);
  }
  
  // Exemplos MINI BLAZE
  const [examples2] = await conn.execute(`
    SELECT familia, produto, id
    FROM products 
    WHERE familia = 'MINI BLAZE'
    LIMIT 10
  `);
  console.log("\n=== Exemplos MINI BLAZE ===");
  for (const e of examples2 as any[]) {
    console.log(`  [${e.familia}] ${e.produto}`);
  }
  
  // Exemplos BLAZE H
  const [examples3] = await conn.execute(`
    SELECT familia, produto, id
    FROM products 
    WHERE familia = 'BLAZE H'
    LIMIT 10
  `);
  console.log("\n=== Exemplos BLAZE H ===");
  for (const e of examples3 as any[]) {
    console.log(`  [${e.familia}] ${e.produto}`);
  }
  
  await conn.end();
}

main().catch(console.error);
