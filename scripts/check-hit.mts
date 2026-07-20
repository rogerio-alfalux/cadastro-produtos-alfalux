import { createConnection } from "mysql2/promise";

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  const [rows] = await conn.execute(
    `SELECT mkpPadraoOnoff220v, mkpMinimoOnoff220v, COUNT(*) as qtd 
     FROM products WHERE familia = 'HIT' 
     GROUP BY mkpPadraoOnoff220v, mkpMinimoOnoff220v`
  );
  console.log(JSON.stringify(rows, null, 2));
  await conn.end();
}

main().catch(console.error);
