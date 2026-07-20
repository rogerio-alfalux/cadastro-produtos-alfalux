import { createConnection } from "mysql2/promise";

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  
  // custoLuminaria está vazio em todos. Verificar custoCorpo
  const [stats] = await conn.execute(`
    SELECT 
      SUM(CASE WHEN custoCorpoOnoff220v IS NOT NULL AND custoCorpoOnoff220v > 0 THEN 1 ELSE 0 END) as com_custoCorpo,
      SUM(CASE WHEN (custoCorpoOnoff220v IS NULL OR custoCorpoOnoff220v = 0) THEN 1 ELSE 0 END) as sem_custoCorpo,
      SUM(CASE WHEN custoDriverOnoff220 IS NOT NULL AND custoDriverOnoff220 > 0 THEN 1 ELSE 0 END) as com_custoDriver,
      COUNT(*) as total
    FROM products
  `);
  console.log("=== Estatísticas de custo ===");
  console.log(JSON.stringify(stats, null, 2));
  
  // Exemplos com custoCorpo preenchido
  const [sample] = await conn.execute(`
    SELECT familia, produto, potencia, custoCorpoOnoff220v, custoDriverOnoff220
    FROM products
    WHERE custoCorpoOnoff220v IS NOT NULL AND custoCorpoOnoff220v > 0
    LIMIT 5
  `);
  console.log("\n=== Exemplos com custoCorpo preenchido ===");
  console.log(JSON.stringify(sample, null, 2));
  
  // Resumo por família - sem custo corpo
  const [semCusto] = await conn.execute(`
    SELECT familia, COUNT(*) as qtd
    FROM products
    WHERE (custoCorpoOnoff220v IS NULL OR custoCorpoOnoff220v = 0)
      AND semDriver = 0
      AND moduloLampada = 0
    GROUP BY familia
    ORDER BY familia
  `);
  console.log("\n=== Famílias SEM custoCorpo (excluindo semDriver e moduloLampada) ===");
  let total = 0;
  for (const r of semCusto as any[]) {
    console.log(`  ${r.familia.padEnd(20)} | ${r.qtd} produtos`);
    total += Number(r.qtd);
  }
  console.log(`\n  Total sem custo corpo: ${total}`);
  
  await conn.end();
}

main().catch(console.error);
