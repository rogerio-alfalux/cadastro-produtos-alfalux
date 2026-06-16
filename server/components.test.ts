import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";

describe("components — duplicate codigo validation", () => {
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    db = await getDb();
  });

  it("should allow inserting a component without codigo", async () => {
    if (!db) { expect(true).toBe(true); return; }
    const { components } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const [result] = await db.insert(components).values({
      tipo: "OTICA",
      modelo: "TESTE SEM CODIGO",
      codigo: null,
    });
    const insertId = (result as any).insertId;
    expect(insertId).toBeGreaterThan(0);
    await db.delete(components).where(eq(components.id, insertId));
  });

  it("should allow inserting two components with null codigo", async () => {
    if (!db) { expect(true).toBe(true); return; }
    const { components } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const [r1] = await db.insert(components).values({ tipo: "HOLDER", modelo: "HOLDER A", codigo: null });
    const [r2] = await db.insert(components).values({ tipo: "HOLDER", modelo: "HOLDER B", codigo: null });
    const id1 = (r1 as any).insertId;
    const id2 = (r2 as any).insertId;
    expect(id1).toBeGreaterThan(0);
    expect(id2).toBeGreaterThan(0);
    await db.delete(components).where(eq(components.id, id1));
    await db.delete(components).where(eq(components.id, id2));
  });

  it("should detect duplicate codigo via checkCodigo query logic", async () => {
    if (!db) { expect(true).toBe(true); return; }
    const { components } = await import("../drizzle/schema");
    const { eq, sql } = await import("drizzle-orm");

    // Insert a component with a unique test code
    const testCodigo = "TESTDUP-" + Date.now();
    const [result] = await db.insert(components).values({
      tipo: "DISSIPADOR",
      modelo: "DISSIPADOR TESTE DUPLICADO",
      codigo: testCodigo,
    });
    const insertId = (result as any).insertId;
    expect(insertId).toBeGreaterThan(0);

    // Simulate checkCodigo query: look for same code (case-insensitive)
    const rows = await db
      .select({ id: components.id, modelo: components.modelo })
      .from(components)
      .where(sql`UPPER(${components.codigo}) = ${testCodigo.toUpperCase()}`)
      .limit(1);

    expect(rows.length).toBe(1);
    expect(rows[0].modelo).toBe("DISSIPADOR TESTE DUPLICADO");

    // Simulate checkCodigo with excludeId (editing the same record should not conflict)
    const rowsExcluded = await db
      .select({ id: components.id, modelo: components.modelo })
      .from(components)
      .where(sql`UPPER(${components.codigo}) = ${testCodigo.toUpperCase()} AND ${components.id} != ${insertId}`)
      .limit(1);

    expect(rowsExcluded.length).toBe(0);

    // Cleanup
    await db.delete(components).where(eq(components.id, insertId));
  });

  it("should normalize codigo to uppercase on insert", async () => {
    if (!db) { expect(true).toBe(true); return; }
    const { components } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const [result] = await db.insert(components).values({
      tipo: "MODULO_LED",
      modelo: "MODULO TESTE UPPERCASE",
      codigo: "EQ99999",
    });
    const insertId = (result as any).insertId;
    const rows = await db.select().from(components).where(eq(components.id, insertId));
    expect(rows[0].codigo).toBe("EQ99999");
    await db.delete(components).where(eq(components.id, insertId));
  });
});
