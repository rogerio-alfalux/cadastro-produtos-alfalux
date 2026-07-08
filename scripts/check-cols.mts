import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const [cols] = await conn.query<any[]>("DESCRIBE products");
  const relevant = (cols as any[]).filter((c: any) => 
    c.Field.toLowerCase().includes("custo") || 
    c.Field.toLowerCase().includes("driver") || 
    c.Field.toLowerCase().includes("corrente") ||
    c.Field.toLowerCase().includes("modulo")
  );
  relevant.forEach((c: any) => console.log(c.Field));
  await conn.end();
}
main().catch(console.error);
