import { createConnection } from "mysql2/promise";

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  
  // Dentro da família BLAZE, identificar subfamílias pelo campo produto
  // BLAZE E, BLAZE S, BLAZE H P, MINI BLAZE P, MINI BLAZE S
  const [blazeE] = await conn.execute(`
    SELECT COUNT(*) as qtd FROM products WHERE familia = 'BLAZE' AND produto LIKE 'BLAZE E%'
  `);
  const [blazeS] = await conn.execute(`
    SELECT COUNT(*) as qtd FROM products WHERE familia = 'BLAZE' AND produto LIKE 'BLAZE S%'
  `);
  const [blazeOther] = await conn.execute(`
    SELECT COUNT(*) as qtd FROM products WHERE familia = 'BLAZE' AND produto NOT LIKE 'BLAZE E%' AND produto NOT LIKE 'BLAZE S%'
  `);
  const [miniP] = await conn.execute(`
    SELECT COUNT(*) as qtd FROM products WHERE familia = 'MINI BLAZE' AND produto LIKE 'MINI BLAZE P%'
  `);
  const [miniS] = await conn.execute(`
    SELECT COUNT(*) as qtd FROM products WHERE familia = 'MINI BLAZE' AND produto LIKE 'MINI BLAZE S%'
  `);
  const [miniOther] = await conn.execute(`
    SELECT COUNT(*) as qtd FROM products WHERE familia = 'MINI BLAZE' AND produto NOT LIKE 'MINI BLAZE P%' AND produto NOT LIKE 'MINI BLAZE S%'
  `);
  const [blazeH] = await conn.execute(`
    SELECT COUNT(*) as qtd FROM products WHERE familia = 'BLAZE H'
  `);
  
  console.log("=== Contagem por subfamília ===");
  console.log(`BLAZE E: ${(blazeE as any[])[0].qtd}`);
  console.log(`BLAZE S: ${(blazeS as any[])[0].qtd}`);
  console.log(`BLAZE (outros): ${(blazeOther as any[])[0].qtd}`);
  console.log(`BLAZE H: ${(blazeH as any[])[0].qtd}`);
  console.log(`MINI BLAZE P: ${(miniP as any[])[0].qtd}`);
  console.log(`MINI BLAZE S: ${(miniS as any[])[0].qtd}`);
  console.log(`MINI BLAZE (outros): ${(miniOther as any[])[0].qtd}`);
  
  // Verificar exemplos de "outros" BLAZE
  const [otherEx] = await conn.execute(`
    SELECT DISTINCT SUBSTRING_INDEX(produto, ' ', 3) as prefix, COUNT(*) as qtd
    FROM products WHERE familia = 'BLAZE' AND produto NOT LIKE 'BLAZE E%' AND produto NOT LIKE 'BLAZE S%'
    GROUP BY prefix LIMIT 10
  `);
  console.log("\nBLAZE outros prefixos:", JSON.stringify(otherEx));
  
  await conn.end();
}

main().catch(console.error);
