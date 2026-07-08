import { getDb } from '../server/db.js';
import { products } from '../drizzle/schema.js';
import { eq, and, sql } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// Pegar todos os SKUs dos perfis 18W para entender o padrão
const rows = await db.select({
  id: products.id,
  sku: products.sku,
}).from(products).where(
  and(
    eq(products.categoria, 'PERFIS'),
    eq(products.potencia, '18W')
  )
);

// Extrair o segmento de barras do SKU
// Padrão: LLE-2810.XXX.18F — o segundo segmento (XXX) contém o código de barras
// Ex: 1IN → 1 barra, 11I → 1.1 barras, 21I → 2.1 barras, 2IN → 2 barras, 51I → 5.1 barras
function extrairBarras(sku: string): number | null {
  // Pegar o segundo segmento do SKU (entre o primeiro e segundo ponto)
  const partes = sku.split('.');
  if (partes.length < 2) return null;
  const seg = partes[1]; // ex: "1IN", "11I", "21I", "2IN", "51I", "6IN"
  
  // Remover letras do final para pegar só o número
  const numStr = seg.replace(/[A-Z]+$/i, ''); // "1IN" → "1", "21I" → "21", "11I" → "11"
  const num = parseInt(numStr, 10);
  if (isNaN(num)) return null;
  
  // Converter: 1 → 1.0, 11 → 1.1, 21 → 2.1, 2 → 2.0, 51 → 5.1, 6 → 6.0
  if (num < 10) return num; // 1, 2, 3... → 1.0, 2.0, 3.0
  // Para 2 dígitos: primeiro dígito = barras inteiras, segundo = decimal
  const inteiro = Math.floor(num / 10);
  const decimal = num % 10;
  return inteiro + decimal / 10;
}

// Contar por faixa
const contagem = new Map<string, number>();
const exemplos = new Map<string, string[]>();

for (const r of rows) {
  const barras = extrairBarras(r.sku);
  if (barras === null) {
    const k = 'ERRO';
    contagem.set(k, (contagem.get(k) || 0) + 1);
    if (!exemplos.has(k)) exemplos.set(k, []);
    exemplos.get(k)!.push(r.sku);
    continue;
  }
  
  let faixa: string;
  if (barras <= 2) faixa = '≤2 (EQ00346/EQ00580)';
  else if (barras <= 5) faixa = '2.1-5 (EQ00347/EQ00581)';
  else faixa = '>5 até 8 (EQ00348/EQ00582)';
  
  contagem.set(faixa, (contagem.get(faixa) || 0) + 1);
  if (!exemplos.has(faixa)) exemplos.set(faixa, []);
  if (exemplos.get(faixa)!.length < 5) exemplos.get(faixa)!.push(`${r.sku} (${barras}b)`);
}

console.log('=== DISTRIBUIÇÃO POR FAIXA DE BARRAS (18W) ===');
for (const [faixa, count] of contagem.entries()) {
  console.log(`\n${faixa}: ${count} produtos`);
  console.log(`  Exemplos: ${exemplos.get(faixa)?.join(', ')}`);
}

// Mostrar todos os valores únicos de barras
const valoresUnicos = new Set<number>();
for (const r of rows) {
  const b = extrairBarras(r.sku);
  if (b !== null) valoresUnicos.add(b);
}
console.log('\n=== VALORES ÚNICOS DE BARRAS ===');
console.log([...valoresUnicos].sort((a,b) => a-b).join(', '));
