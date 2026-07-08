import { getDb } from '../server/db.js';
import { products } from '../drizzle/schema.js';
import { eq, and, like } from 'drizzle-orm';

const db = await getDb();
if (!db) { console.error('DB not available'); process.exit(1); }

// Regras:
// 18W  → "programar em 350mA"
// 26W  → "programar em 500mA"
// 36W-SF (Stripflex dupla) → "programar em 350mA"
// 36W-SL (Stripline) → "programar em 250mA"

const updates: { potencia: string; corrente: string }[] = [
  { potencia: '18W',   corrente: 'programar em 350mA' },
  { potencia: '26W',   corrente: 'programar em 500mA' },
  { potencia: '36W-SF', corrente: 'programar em 350mA' },
  { potencia: '36W-SL', corrente: 'programar em 250mA' },
];

let totalAtualizado = 0;

for (const { potencia, corrente } of updates) {
  // Apenas perfis (categoria = 'PERFIS')
  const result = await db.update(products)
    .set({ correnteDriver: corrente })
    .where(
      and(
        eq(products.categoria, 'PERFIS'),
        eq(products.potencia, potencia as any)
      )
    );

  const affected = (result as any)[0]?.affectedRows ?? 0;
  console.log(`${potencia} → "${corrente}" — ${affected} produtos atualizados`);
  totalAtualizado += affected;
}

console.log(`\nTotal: ${totalAtualizado} produtos atualizados`);
