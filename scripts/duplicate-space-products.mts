/**
 * Duplica todos os produtos SPACE (instalação PENDENTE) criando versões
 * com instalação SOBREPOR e EMBUTIR.
 *
 * Regras de SKU:
 * - PENDENTE: mantém o SKU original (ex: LDS-6078.100.08F)
 * - SOBREPOR: mesmo SKU do PENDENTE (LDS permanece LDS)
 * - EMBUTIR:  troca LDS → LDE (ex: LDE-6078.100.08F)
 *
 * Regras de nome do produto:
 * - PENDENTE: mantém o nome original (ex: "SPACE P R LED 90W Ø1000MM")
 * - SOBREPOR: substitui " P " → " S " no nome
 * - EMBUTIR:  substitui " P " → " E " no nome
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

function skuParaSobrepor(sku: string): string {
  // SKU de sobrepor é igual ao de pendente (LDS permanece LDS)
  return sku;
}

function skuParaEmbutir(sku: string): string {
  // Troca prefixo LDS → LDE
  return sku.replace(/^LDS-/, "LDE-");
}

function nomeParaSobrepor(nome: string): string {
  // Substitui " P " por " S " no nome
  return nome.replace(/ P /g, " S ");
}

function nomeParaEmbutir(nome: string): string {
  // Substitui " P " por " E " no nome
  return nome.replace(/ P /g, " E ");
}

async function main() {
  const conn = await createConnection(DATABASE_URL);

  // Buscar todos os produtos SPACE com instalação PENDENTE
  const [rows] = await conn.execute(
    `SELECT * FROM products WHERE (familia LIKE '%SPACE%' OR produto LIKE '%SPACE%') AND instalacao = 'PENDENTE' ORDER BY produto, sku`
  ) as any[];

  console.log(`\n📋 Produtos SPACE (PENDENTE) encontrados: ${rows.length}\n`);
  for (const row of rows) {
    console.log(`  [${row.id}] ${row.sku} — ${row.produto}`);
  }

  if (rows.length === 0) {
    console.log("\n⚠️  Nenhum produto SPACE com instalação PENDENTE encontrado.");
    await conn.end();
    return;
  }

  // Calcular novos SKUs
  const newSkus: string[] = [];
  for (const row of rows) {
    newSkus.push(skuParaSobrepor(row.sku));
    newSkus.push(skuParaEmbutir(row.sku));
  }

  // Verificar quais já existem (para não duplicar)
  // Para SOBREPOR: mesmo SKU mas instalação SOBREPOR
  // Para EMBUTIR: SKU com LDE
  const [existingSobrepor] = await conn.execute(
    `SELECT sku FROM products WHERE (familia LIKE '%SPACE%' OR produto LIKE '%SPACE%') AND instalacao = 'SOBREPOR'`
  ) as any[];
  const [existingEmbutir] = await conn.execute(
    `SELECT sku FROM products WHERE (familia LIKE '%SPACE%' OR produto LIKE '%SPACE%') AND instalacao = 'EMBUTIR'`
  ) as any[];

  const existingSkusSobrepor = new Set(existingSobrepor.map((r: any) => r.sku));
  const existingSkusEmbutir  = new Set(existingEmbutir.map((r: any) => r.sku));

  console.log(`\n🔄 Criando versões SOBREPOR e EMBUTIR...\n`);

  // Obter todas as colunas da tabela (exceto id e createdAt)
  const [cols] = await conn.execute(`SHOW COLUMNS FROM products`) as any[];
  const columnNames: string[] = (cols as any[])
    .map((c: any) => c.Field)
    .filter((c: string) => c !== "id" && c !== "createdAt");

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    // ── SOBREPOR ──────────────────────────────────────────────
    const skuSobrepor  = skuParaSobrepor(row.sku);
    const nomeSobrepor = nomeParaSobrepor(row.produto);

    if (existingSkusSobrepor.has(skuSobrepor)) {
      console.log(`  ⏭️  [SKIP SOBREPOR] ${skuSobrepor} — já existe`);
      skipped++;
    } else {
      const valuesSobrepor = columnNames.map((col) => {
        if (col === "sku")        return skuSobrepor;
        if (col === "produto")    return nomeSobrepor;
        if (col === "instalacao") return "SOBREPOR";
        return row[col] ?? null;
      });
      const placeholders = columnNames.map(() => "?").join(", ");
      const colsStr = columnNames.map((c) => `\`${c}\``).join(", ");
      await conn.execute(`INSERT INTO products (${colsStr}) VALUES (${placeholders})`, valuesSobrepor);
      console.log(`  ✓ [SOBREPOR] ${skuSobrepor} — ${nomeSobrepor}`);
      created++;
    }

    // ── EMBUTIR ───────────────────────────────────────────────
    const skuEmbutir  = skuParaEmbutir(row.sku);
    const nomeEmbutir = nomeParaEmbutir(row.produto);

    if (existingSkusEmbutir.has(skuEmbutir)) {
      console.log(`  ⏭️  [SKIP EMBUTIR] ${skuEmbutir} — já existe`);
      skipped++;
    } else {
      const valuesEmbutir = columnNames.map((col) => {
        if (col === "sku")        return skuEmbutir;
        if (col === "produto")    return nomeEmbutir;
        if (col === "instalacao") return "EMBUTIR";
        return row[col] ?? null;
      });
      const placeholders = columnNames.map(() => "?").join(", ");
      const colsStr = columnNames.map((c) => `\`${c}\``).join(", ");
      await conn.execute(`INSERT INTO products (${colsStr}) VALUES (${placeholders})`, valuesEmbutir);
      console.log(`  ✓ [EMBUTIR] ${skuEmbutir} — ${nomeEmbutir}`);
      created++;
    }
  }

  console.log(`\n✅ Concluído: ${created} produtos criados, ${skipped} ignorados (já existiam)`);
  await conn.end();
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
