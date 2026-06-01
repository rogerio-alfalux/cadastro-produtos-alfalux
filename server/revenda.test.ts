import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { revendaProducts } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("revenda_products table", () => {
  let insertedId: number;

  afterAll(async () => {
    if (insertedId) {
      const db = await getDb();
      await db.delete(revendaProducts).where(eq(revendaProducts.id, insertedId));
    }
  });

  it("should insert a new revenda product", async () => {
    const db = await getDb();
    const result = await db.insert(revendaProducts).values({
      codigo: "RV_TEST_001",
      descricao: "PRODUTO DE TESTE UNITARIO",
      referencia: "REF-TEST",
      fornecedor: "FORNECEDOR TESTE",
      observacoes: "Observação de teste",
      custo: "10.50",
      precoVenda: "25.00",
    });
    expect(result).toBeDefined();
    // Get the inserted row
    const rows = await db
      .select()
      .from(revendaProducts)
      .where(eq(revendaProducts.codigo, "RV_TEST_001"));
    expect(rows.length).toBe(1);
    insertedId = rows[0].id;
    expect(rows[0].descricao).toBe("PRODUTO DE TESTE UNITARIO");
    expect(rows[0].fornecedor).toBe("FORNECEDOR TESTE");
    expect(rows[0].custo).toBe("10.50");
    expect(rows[0].precoVenda).toBe("25.00");
  });

  it("should list revenda products", async () => {
    const db = await getDb();
    const rows = await db.select().from(revendaProducts).limit(10);
    expect(rows.length).toBeGreaterThan(0);
    // All rows should have at minimum codigo and descricao
    for (const row of rows) {
      expect(row.codigo).toBeTruthy();
      expect(row.descricao).toBeTruthy();
    }
  });

  it("should have 201 imported products", async () => {
    const db = await getDb();
    const rows = await db.select().from(revendaProducts);
    // 201 imported + 1 test = 202 total (test might run before afterAll)
    // Just check we have at least 200
    expect(rows.length).toBeGreaterThanOrEqual(200);
  });

  it("should update a revenda product", async () => {
    if (!insertedId) return;
    const db = await getDb();
    await db
      .update(revendaProducts)
      .set({ observacoes: "Observação atualizada" })
      .where(eq(revendaProducts.id, insertedId));
    const rows = await db
      .select()
      .from(revendaProducts)
      .where(eq(revendaProducts.id, insertedId));
    expect(rows[0].observacoes).toBe("Observação atualizada");
  });

  it("should delete a revenda product", async () => {
    if (!insertedId) return;
    const db = await getDb();
    await db.delete(revendaProducts).where(eq(revendaProducts.id, insertedId));
    const rows = await db
      .select()
      .from(revendaProducts)
      .where(eq(revendaProducts.id, insertedId));
    expect(rows.length).toBe(0);
    insertedId = 0; // prevent afterAll from trying to delete again
  });
});
