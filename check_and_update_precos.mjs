import { db } from './server/db.ts';
import { products } from './drizzle/schema.ts';
import { eq, and, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import fs from 'fs';

// Verificar estado atual
const sample = await db.select({
  sku: products.sku,
  familia: products.familia,
  instalacao: products.instalacao,
  precoVendaOnoff220: products.precoVendaOnoff220,
  precoVendaOnoffBivolt: products.precoVendaOnoffBivolt,
  precoVendaDim110v: products.precoVendaDim110v,
  precoVendaDimDali: products.precoVendaDimDali,
}).from(products)
  .where(sql`UPPER(categoria) = 'PERFIS' AND UPPER(familia) = 'BLAZE' AND UPPER(instalacao) = 'EMBUTIR'`)
  .limit(3);

console.log('Amostra BLAZE EMBUTIR:');
console.log(JSON.stringify(sample, null, 2));
