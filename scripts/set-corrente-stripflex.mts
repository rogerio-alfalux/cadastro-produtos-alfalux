import { getDb } from "../server/db.ts";
import { products } from "../drizzle/schema.ts";
import { eq, like, or, and } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");

  // Buscar produtos 18W e 36W-SF que usam Stripflex como módulo LED
  // Stripflex aparece nos campos moduloLed2700/3000/4000/5000 como "STRIPFLEX"
  // potencia = "18W" ou "36W-SF"
  const allProducts = await db.select({
    id: products.id,
    sku: products.sku,
    potencia: products.potencia,
    moduloLed3000: products.moduloLed3000,
    moduloLed4000: products.moduloLed4000,
    moduloLed5000: products.moduloLed5000,
    moduloLed2700: products.moduloLed2700,
    correnteDriver: products.correnteDriver,
  }).from(products);

  // Filtrar: potencia 18W ou 36W-SF E tem algum módulo LED com STRIPFLEX
  const toUpdate = allProducts.filter(p => {
    const isStripflex18or36sf = p.potencia === "18W" || p.potencia === "36W-SF";
    if (!isStripflex18or36sf) return false;
    
    const hasStripflex = 
      (p.moduloLed2700 && p.moduloLed2700.toUpperCase().includes("STRIPFLEX")) ||
      (p.moduloLed3000 && p.moduloLed3000.toUpperCase().includes("STRIPFLEX")) ||
      (p.moduloLed4000 && p.moduloLed4000.toUpperCase().includes("STRIPFLEX")) ||
      (p.moduloLed5000 && p.moduloLed5000.toUpperCase().includes("STRIPFLEX"));
    
    return hasStripflex;
  });

  console.log(`Total produtos 18W/36W-SF com Stripflex: ${toUpdate.length}`);
  
  // Mostrar distribuição por potência
  const por18w = toUpdate.filter(p => p.potencia === "18W").length;
  const por36wsf = toUpdate.filter(p => p.potencia === "36W-SF").length;
  console.log(`  18W: ${por18w}`);
  console.log(`  36W-SF: ${por36wsf}`);

  if (toUpdate.length === 0) {
    console.log("Nenhum produto encontrado.");
    process.exit(0);
  }

  let updated = 0;
  for (const p of toUpdate) {
    await db.update(products)
      .set({ correnteDriver: "Programar em 350mA" })
      .where(eq(products.id, p.id));
    updated++;
    if (updated % 200 === 0) console.log(`  ${updated}/${toUpdate.length}...`);
  }

  console.log(`\n✅ ${updated} produtos atualizados com "Programar em 350mA".`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
