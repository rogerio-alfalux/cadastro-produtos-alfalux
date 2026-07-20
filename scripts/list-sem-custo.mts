import { createConnection } from "mysql2/promise";

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  
  // Produtos sem custo de luminária (custoLuminaria NULL ou 0)
  const [summary] = await conn.execute(`
    SELECT familia, potencia, COUNT(*) as qtd
    FROM products
    WHERE (custoLuminaria IS NULL OR custoLuminaria = 0)
    GROUP BY familia, potencia
    ORDER BY familia, potencia
  `);
  
  console.log("=== Produtos SEM CUSTO DE LUMINÁRIA (por família/potência) ===");
  let total = 0;
  for (const r of summary as any[]) {
    console.log(`  ${r.familia.padEnd(20)} | ${(r.potencia || '-').padEnd(6)} | ${r.qtd} produtos`);
    total += Number(r.qtd);
  }
  console.log(`\n  TOTAL SEM CUSTO: ${total} produtos`);
  
  // Total geral para contexto
  const [totalAll] = await conn.execute(`SELECT COUNT(*) as total FROM products`);
  console.log(`  TOTAL GERAL: ${(totalAll as any[])[0].total} produtos`);
  
  // Produtos COM custo para comparação
  const [comCusto] = await conn.execute(`
    SELECT COUNT(*) as qtd FROM products WHERE custoLuminaria IS NOT NULL AND custoLuminaria > 0
  `);
  console.log(`  COM CUSTO: ${(comCusto as any[])[0].qtd} produtos`);
  
  await conn.end();
}

main().catch(console.error);
