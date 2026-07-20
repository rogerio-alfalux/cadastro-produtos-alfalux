import { createConnection } from "mysql2/promise";

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  
  const [rows] = await conn.execute(`
    SELECT familia, potencia, mkpPadraoOnoff220v, mkpMinimoOnoff220v, COUNT(*) as qtd
    FROM products
    WHERE familia IN ('BLAZE', 'BLAZE H', 'MINI BLAZE', 'HIT')
    GROUP BY familia, potencia, mkpPadraoOnoff220v, mkpMinimoOnoff220v
    ORDER BY familia, potencia
  `);
  
  console.log("=== Markups por família e potência ===");
  for (const r of rows as any[]) {
    console.log(`  ${r.familia.padEnd(12)} | ${(r.potencia || '18W').padEnd(6)} | Padrão: ${r.mkpPadraoOnoff220v} | Mínimo: ${r.mkpMinimoOnoff220v} | ${r.qtd} produtos`);
  }
  
  await conn.end();
}

main().catch(console.error);
