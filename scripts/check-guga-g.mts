import { createConnection } from "mysql2/promise";

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);

  const [mods] = await conn.execute(
    "SELECT id, tipo, modelo, codigo FROM components WHERE tipo = 'MODULO_LED' AND modelo LIKE '%67MM%' ORDER BY modelo"
  );
  console.log("=== Módulos Ø67MM na tabela components ===");
  console.log(JSON.stringify(mods, null, 2));

  const [gugas] = await conn.execute(
    "SELECT id, produto, moduloLed2700k, moduloLed3000k, moduloLed4000k, moduloLed5000k, moduloLed2700kId, moduloLed3000kId, moduloLed4000kId FROM products WHERE familia = 'GUGA' AND produto LIKE '%GUGA G%' LIMIT 5"
  );
  console.log("\n=== GUGA G (amostra) ===");
  console.log(JSON.stringify(gugas, null, 2));

  const [cnt] = await conn.execute(
    "SELECT COUNT(*) as total FROM products WHERE familia = 'GUGA' AND produto LIKE '%GUGA G%'"
  );
  console.log("\nTotal GUGA G:", (cnt as any[])[0].total);

  await conn.end();
}

main().catch(console.error);
