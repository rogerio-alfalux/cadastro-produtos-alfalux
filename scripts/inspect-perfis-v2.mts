import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { products } from "../drizzle/schema.js";
import { eq, inArray, like, or } from "drizzle-orm";
import * as dotenv from "dotenv";
dotenv.config();

const FAMILIAS_PERFIS = ["BLAZE","BLAZE H","EASY H PLUS","EASY PRIME","FLOW","HIT","MINI BLAZE","SKYLINE","SMART MINI","SOFT"];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);

  // Buscar todos os produtos das famílias de perfis
  const rows = await db.select({
    id: products.id,
    familia: products.familia,
    produto: products.produto,
    sku: products.sku,
    categoria: products.categoria,
    instalacao: products.instalacao,
    potencia: products.potencia,
  }).from(products).where(
    inArray(products.familia, FAMILIAS_PERFIS)
  ).orderBy(products.familia, products.produto);

  // Identificar customizados (categoria CUSTOMIZADOS)
  const customizados = rows.filter(r => r.categoria === "CUSTOMIZADOS");
  const normais = rows.filter(r => r.categoria !== "CUSTOMIZADOS");

  // Identificar barras quebradas (SKU contém 45M ou 38I)
  const barrasQuebradas = normais.filter(r => r.sku && (r.sku.includes("45M") || r.sku.includes("38I")));
  const barrasInteiras = normais.filter(r => !r.sku || (!r.sku.includes("45M") && !r.sku.includes("38I")));

  console.log(`\n=== RESUMO ===`);
  console.log(`Total de produtos nas famílias de perfis: ${rows.length}`);
  console.log(`Customizados (não serão duplicados): ${customizados.length}`);
  console.log(`Normais (serão duplicados): ${normais.length}`);
  console.log(`  - Com barras inteiras (entram em 36W-SL): ${barrasInteiras.length}`);
  console.log(`  - Com barras quebradas (não entram em 36W-SL): ${barrasQuebradas.length}`);

  console.log(`\n=== EXEMPLOS DE BARRAS QUEBRADAS (primeiros 10) ===`);
  barrasQuebradas.slice(0, 10).forEach(r => console.log(`  ${r.familia} | ${r.produto} | SKU: ${r.sku}`));

  console.log(`\n=== EXEMPLOS DE BARRAS INTEIRAS (primeiros 10) ===`);
  barrasInteiras.slice(0, 10).forEach(r => console.log(`  ${r.familia} | ${r.produto} | SKU: ${r.sku}`));

  console.log(`\n=== PRODUTOS COM POTÊNCIA JÁ DEFINIDA ===`);
  const comPotencia = rows.filter(r => r.potencia !== null);
  console.log(`Produtos com campo potencia preenchido: ${comPotencia.length}`);

  console.log(`\n=== ESTIMATIVA DE NOVOS PRODUTOS ===`);
  console.log(`18W (renomear existentes): ${normais.length}`);
  console.log(`26W (duplicar normais): ${normais.length}`);
  console.log(`36W-SF (duplicar normais): ${normais.length}`);
  console.log(`36W-SL (duplicar apenas barras inteiras): ${barrasInteiras.length}`);
  console.log(`TOTAL NOVOS: ${normais.length * 2 + barrasInteiras.length} (mais os ${normais.length} renomeados)`);

  await conn.end();
}

main().catch(console.error);
