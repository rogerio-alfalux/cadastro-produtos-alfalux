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
  
  // Ver exemplos de nomes por família
  const [examples] = await conn.execute(`
    SELECT familia, nome
    FROM products 
    WHERE familia LIKE '%BLAZE%' 
    GROUP BY familia, nome
    ORDER BY familia, nome
    LIMIT 40
  `);
  console.log("\n=== Exemplos de nomes ===");
  for (const e of examples as any[]) {
    console.log(`  [${e.familia}] ${e.nome}`);
  }
  
  // Verificar BLAZE H
  const [blazeH] = await conn.execute(`
    SELECT familia, COUNT(*) as qtd 
    FROM products 
    WHERE familia = 'BLAZE H'
    GROUP BY familia
  `);
  console.log("\n=== BLAZE H ===");
  console.log(JSON.stringify(blazeH, null, 2));
  
  await conn.end();
}

main().catch(console.error);
