import { getDb } from "../server/db.ts";
import { products } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";

const driverClearFields = {
  driverOnoff220: "",
  qtdDriverOnoff220: 1,
  driverOnoff220NaoAplicavel: false,
  custoDriverOnoff220: null,
  driverOnoffBivolt: "",
  qtdDriverOnoffBivolt: 1,
  driverOnoffBivoltNaoAplicavel: false,
  custoDriverOnoffBivolt: null,
  driverDim110v: "",
  qtdDriverDim110v: 1,
  driverDim110vNaoAplicavel: false,
  custoDriverDim110v: null,
  driverDimDali: "",
  qtdDriverDimDali: 1,
  driverDimDaliNaoAplicavel: false,
  custoDriverDimDali: null,
  driverDimTriac110v: "",
  qtdDriverDimTriac110v: 1,
  driverDimTriac110vNaoAplicavel: false,
  custoDriverDimTriac110v: null,
  driverDimTriac220v: "",
  qtdDriverDimTriac220v: 1,
  driverDimTriac220vNaoAplicavel: false,
  custoDriverDimTriac220v: null,
  correnteDriver: "",
  driverOnoff220Extra: null,
  driverOnoffBivoltExtra: null,
  driverDim110vExtra: null,
  driverDimDaliExtra: null,
  driverDimTriac110vExtra: null,
  driverDimTriac220vExtra: null,
  mkpPadraoDriverOnoff220v: null,
  mkpPadraoDriverOnoffBivolt: null,
  mkpPadraoDriverDim110v: null,
  mkpPadraoDriverDimDali: null,
  mkpPadraoDriverDimTriac110v: null,
  mkpPadraoDriverDimTriac220v: null,
};

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");

  // Buscar todos os produtos com semDriver=true ou moduloLampada=true
  const allProducts = await db.select({
    id: products.id,
    sku: products.sku,
    semDriver: products.semDriver,
    moduloLampada: products.moduloLampada,
    driverOnoff220: products.driverOnoff220,
    driverOnoffBivolt: products.driverOnoffBivolt,
    driverDimDali: products.driverDimDali,
  }).from(products);

  const toClean = allProducts.filter(p => p.semDriver || p.moduloLampada);
  console.log(`Total com semDriver/moduloLampada: ${toClean.length}`);

  if (toClean.length === 0) {
    console.log("Nenhum produto precisa de limpeza.");
    process.exit(0);
  }

  // Mostrar quantos têm drivers preenchidos
  const withDrivers = toClean.filter(p =>
    (p.driverOnoff220 && p.driverOnoff220 !== "" && p.driverOnoff220 !== "NÃO APLICÁVEL") ||
    (p.driverOnoffBivolt && p.driverOnoffBivolt !== "" && p.driverOnoffBivolt !== "NÃO APLICÁVEL") ||
    (p.driverDimDali && p.driverDimDali !== "" && p.driverDimDali !== "NÃO APLICÁVEL")
  );
  console.log(`Com drivers preenchidos (serão limpos): ${withDrivers.length}`);

  let updated = 0;
  for (const p of toClean) {
    await db.update(products)
      .set(driverClearFields as any)
      .where(eq(products.id, p.id));
    updated++;
    if (updated % 100 === 0) console.log(`  ${updated}/${toClean.length}...`);
  }

  console.log(`\n✅ ${updated} produtos atualizados — drivers limpos.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
