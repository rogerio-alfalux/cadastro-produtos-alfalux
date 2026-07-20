import { createConnection } from "mysql2/promise";

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  
  const [rows] = await conn.execute(`
    SELECT id, produto, semDriver, moduloLampada,
      driverOnoff220, driverOnoffBivolt, driverDim110v, driverDimDali,
      driverDimTriac110v, driverDimTriac220v,
      driverDim110vNaoAplicavel, driverDimDaliNaoAplicavel,
      driverDimTriac110vNaoAplicavel, driverDimTriac220vNaoAplicavel,
      driverOnoffBivoltNaoAplicavel
    FROM products WHERE familia = 'IRIS'
  `);
  
  console.log("=== IRIS ===");
  for (const r of rows as any[]) {
    console.log(JSON.stringify(r, null, 2));
  }
  
  await conn.end();
}

main().catch(console.error);
