import mysql from 'mysql2/promise';
import fs from 'fs';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: '/home/ubuntu/cadastro-produtos-alfalux/.env' });

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('DATABASE_URL não encontrada!');
  process.exit(1);
}

// Parsear a URL do banco
const url = new URL(DB_URL);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log('Conectado ao banco de dados.');

// Ler os SQLs
const sqlContent = fs.readFileSync('/home/ubuntu/sqls_custos_luminarias.sql', 'utf8');
const sqls = sqlContent
  .split('\n')
  .filter(line => line.trim().startsWith('UPDATE'))
  .map(line => line.trim());

console.log(`Total de UPDATEs a executar: ${sqls.length}`);

let success = 0;
let errors = 0;
let affected = 0;
let notFound = 0;

for (let i = 0; i < sqls.length; i++) {
  const sql = sqls[i];
  try {
    const [result] = await connection.execute(sql);
    const rows = result.affectedRows || 0;
    affected += rows;
    if (rows === 0) {
      notFound++;
      // Log apenas os primeiros 10 não encontrados para diagnóstico
      if (notFound <= 10) {
        console.log(`  [NÃO ENCONTRADO] ${sql.substring(0, 120)}`);
      }
    }
    success++;
  } catch (err) {
    errors++;
    console.error(`  [ERRO] ${sql.substring(0, 100)}: ${err.message}`);
  }
  
  if ((i + 1) % 100 === 0) {
    console.log(`  Progresso: ${i + 1}/${sqls.length} (${affected} linhas afetadas, ${notFound} não encontrados)`);
  }
}

await connection.end();

console.log('\n=== RESULTADO FINAL ===');
console.log(`UPDATEs executados: ${success}`);
console.log(`Erros: ${errors}`);
console.log(`Linhas afetadas no banco: ${affected}`);
console.log(`Produtos não encontrados (0 linhas afetadas): ${notFound}`);
