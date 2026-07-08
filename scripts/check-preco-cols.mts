import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const [cols] = await conn.query<any[]>("DESCRIBE products");
  const precoCols = (cols as any[]).filter((c: any) => 
    c.Field.toLowerCase().includes("preco") || 
    c.Field.toLowerCase().includes("custo")
  );
  console.log("Colunas de preço e custo no banco:");
  precoCols.forEach((c: any) => console.log(`  ${c.Field}`));
  await conn.end();
}
main().catch(console.error);
