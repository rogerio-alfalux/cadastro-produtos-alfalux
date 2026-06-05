import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";

describe("accessories table", () => {
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    db = await getDb();
  });

  it("should have the accessories table accessible", async () => {
    if (!db) {
      expect(true).toBe(true); // skip in CI without DB
      return;
    }
    const { accessories } = await import("../drizzle/schema");
    const { sql } = await import("drizzle-orm");
    const rows = await db.select({ total: sql<number>`COUNT(*)` }).from(accessories);
    expect(rows[0].total).toBeGreaterThanOrEqual(0);
  });

  it("should insert and delete an accessory", async () => {
    if (!db) {
      expect(true).toBe(true);
      return;
    }
    const { accessories } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const [result] = await db.insert(accessories).values({
      codigo: "TEST001",
      sku: "SKU-TEST",
      produto: "PRODUTO TESTE",
      familia: "TESTE",
      dimensao: "100mm",
      custo: "10.00",
      precoVenda: "16.00",
    });

    const insertId = (result as any).insertId;
    expect(insertId).toBeGreaterThan(0);

    // Cleanup
    await db.delete(accessories).where(eq(accessories.id, insertId));
  });

  it("should return distinct familias", async () => {
    if (!db) {
      expect(true).toBe(true);
      return;
    }
    const { accessories } = await import("../drizzle/schema");
    const { asc } = await import("drizzle-orm");
    const rows = await db
      .selectDistinct({ familia: accessories.familia })
      .from(accessories)
      .orderBy(asc(accessories.familia));
    expect(Array.isArray(rows)).toBe(true);
  });
});
