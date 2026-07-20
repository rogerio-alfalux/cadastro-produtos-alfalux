import { createConnection } from "mysql2/promise";

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  
  // Verificar quais campos de custo existem
  const [cols] = await conn.execute(`SHOW COLUMNS FROM products LIKE '%custo%'`);
  console.log("=== Campos de custo na tabela products ===");
  for (const c of cols as any[]) {
    console.log(`  ${c.Field} (${c.Type})`);
  }
  
  // Verificar valores de custo
  const [sample] = await conn.execute(`
    SELECT id, produto, familia, custoLuminaria, custoDriverOnoff220, custoDriverOnoffBivolt, custoDriverDimDali
    FROM products
    WHERE custoLuminaria IS NOT NULL AND custoLuminaria > 0
    LIMIT 5
  `);
  console.log("\n=== Exemplos com custoLuminaria preenchido ===");
  console.log(JSON.stringify(sample, null, 2));
  
  // Verificar campo custo (sem prefixo)
  const [sample2] = await conn.execute(`
    SELECT id, produto, familia, custoLuminaria
    FROM products
    LIMIT 5
  `);
  console.log("\n=== Primeiros 5 produtos (custoLuminaria) ===");
  console.log(JSON.stringify(sample2, null, 2));
  
  // Contar por status de custo
  const [stats] = await conn.execute(`
    SELECT 
      SUM(CASE WHEN custoLuminaria IS NOT NULL AND custoLuminaria > 0 THEN 1 ELSE 0 END) as com_custo,
      SUM(CASE WHEN custoLuminaria IS NULL OR custoLuminaria = 0 THEN 1 ELSE 0 END) as sem_custo,
      COUNT(*) as total
    FROM products
  `);
  console.log("\n=== Estatísticas ===");
  console.log(JSON.stringify(stats, null, 2));
  
  await conn.end();
}

main().catch(console.error);
