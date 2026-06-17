import { z } from "zod";
import { eq, like, and, asc, sql, inArray } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { components, products } from "../../drizzle/schema";

const COMPONENT_TYPES = [
  "DRIVER_ONOFF_220",
  "DRIVER_ONOFF_BIVOLT",
  "DRIVER_DIM_110V",
  "DRIVER_DIM_DALI",
  "DRIVER_DIM_TRIAC_110V",
  "DRIVER_DIM_TRIAC_220V",
  "OTICA",
  "HOLDER",
  "DISSIPADOR",
  "MODULO_LED",
] as const;

// Map component type → product column name
const TYPE_TO_COLUMN: Record<string, string> = {
  DRIVER_ONOFF_220: "driverOnoff220",
  DRIVER_ONOFF_BIVOLT: "driverOnoffBivolt",
  DRIVER_DIM_110V: "driverDim110v",
  DRIVER_DIM_DALI: "driverDimDali",
  OTICA: "otica",
  HOLDER: "holder",
  DISSIPADOR: "dissipador",
  MODULO_LED: "moduloLed",
};

export const componentsRouter = router({
  // ─── List all components (optionally filtered by type/search) ────────────
  list: publicProcedure
    .input(
      z.object({
        tipo: z.enum(COMPONENT_TYPES).optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.tipo) conditions.push(eq(components.tipo, input.tipo));
      if (input?.search?.trim()) conditions.push(like(components.modelo, `%${input.search.trim()}%`));
      const rows =
        conditions.length > 0
          ? await db.select().from(components).where(and(...conditions)).orderBy(asc(components.tipo), asc(components.modelo))
          : await db.select().from(components).orderBy(asc(components.tipo), asc(components.modelo));
      return rows;
    }),

  // ─── Create a component ──────────────────────────────────────────────────
  create: publicProcedure
    .input(
      z.object({
        tipo: z.enum(COMPONENT_TYPES),
        modelo: z.string().min(1, "Modelo é obrigatório"),
        codigo: z.string().optional(),
        observacao: z.string().optional(),
        custo: z.string().optional(),
        fotoUrl: z.string().optional(),
        fotoKey: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Bloquear código duplicado
      if (input.codigo?.trim()) {
        const codigoNorm = input.codigo.trim().toUpperCase();
        const existing = await db
          .select({ id: components.id, modelo: components.modelo })
          .from(components)
          .where(sql`UPPER(${components.codigo}) = ${codigoNorm}`)
          .limit(1);
        if (existing.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Código "${codigoNorm}" já está em uso pelo componente: ${existing[0].modelo}`,
          });
        }
      }
      const [result] = await db.insert(components).values({
        tipo: input.tipo,
        modelo: input.modelo.trim(),
        codigo: input.codigo?.trim() ? input.codigo.trim().toUpperCase() : null,
        observacao: input.observacao?.trim() || null,
        custo: (input.custo && input.custo.trim() !== '') ? input.custo.trim().replace(',', '.') : null,
        fotoUrl: input.fotoUrl || null,
        fotoKey: input.fotoKey || null,
      });
      return { id: (result as any).insertId };
    }),

  // ─── Update a component ──────────────────────────────────────────────────
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        modelo: z.string().min(1).optional(),
        codigo: z.string().optional(),
        observacao: z.string().optional(),
        custo: z.string().optional(),
        fotoUrl: z.string().optional(),
        fotoKey: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...data } = input;
      // Bloquear código duplicado (excluindo o próprio registro)
      if (data.codigo?.trim()) {
        const codigoNorm = data.codigo.trim().toUpperCase();
        const existing = await db
          .select({ id: components.id, modelo: components.modelo })
          .from(components)
          .where(sql`UPPER(${components.codigo}) = ${codigoNorm} AND ${components.id} != ${id}`)
          .limit(1);
        if (existing.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Código "${codigoNorm}" já está em uso pelo componente: ${existing[0].modelo}`,
          });
        }
      }
      await db.update(components).set({
        modelo: data.modelo?.trim(),
        codigo: data.codigo?.trim() ? data.codigo.trim().toUpperCase() : null,
        observacao: data.observacao?.trim() || null,
        custo: (data.custo && data.custo.trim() !== '') ? data.custo.trim().replace(',', '.') : null,
        ...(data.fotoUrl !== undefined ? { fotoUrl: data.fotoUrl || null } : {}),
        ...(data.fotoKey !== undefined ? { fotoKey: data.fotoKey || null } : {}),
      }).where(eq(components.id, id));
      return { success: true };
    }),

  // ─── Check if a code is already in use (real-time validation) ───────────
  checkCodigo: publicProcedure
    .input(
      z.object({
        codigo: z.string().min(1),
        excludeId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { exists: false, modelo: null };
      const codigoNorm = input.codigo.trim().toUpperCase();
      const rows = input.excludeId
        ? await db
            .select({ id: components.id, modelo: components.modelo })
            .from(components)
            .where(sql`UPPER(${components.codigo}) = ${codigoNorm} AND ${components.id} != ${input.excludeId}`)
            .limit(1)
        : await db
            .select({ id: components.id, modelo: components.modelo })
            .from(components)
            .where(sql`UPPER(${components.codigo}) = ${codigoNorm}`)
            .limit(1);
      return rows.length > 0
        ? { exists: true, modelo: rows[0].modelo }
        : { exists: false, modelo: null };
    }),

  // ─── Delete a component ──────────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(components).where(eq(components.id, input.id));
      return { success: true };
    }),
  // ─── Delete many components at once ──────────────────────────────────────
  deleteMany: publicProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(components).where(inArray(components.id, input.ids));
      return { deleted: input.ids.length };
    }),

  // ─── Count products using a component value (for confirmation dialog) ────
  countUsage: publicProcedure
    .input(
      z.object({
        tipo: z.enum(COMPONENT_TYPES),
        modelo: z.string(),
        familia: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { count: 0 };
      const col = TYPE_TO_COLUMN[input.tipo];
      if (!col) return { count: 0 };

      const result = await db.execute(
        input.familia?.trim()
          ? sql`SELECT COUNT(*) as cnt FROM products WHERE ${sql.raw(`\`${col}\``)} = ${input.modelo} AND familia = ${input.familia}`
          : sql`SELECT COUNT(*) as cnt FROM products WHERE ${sql.raw(`\`${col}\``)} = ${input.modelo}`
      );
      const cnt = (result[0] as any)?.[0]?.cnt ?? 0;
      return { count: Number(cnt) };
    }),

  // ─── Bulk replace component value across all matching products ───────────
  bulkReplace: publicProcedure
    .input(
      z.object({
        tipo: z.enum(COMPONENT_TYPES),
        modeloAntigo: z.string().min(1),
        modeloNovo: z.string().min(1),
        familia: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const col = TYPE_TO_COLUMN[input.tipo];
      if (!col) throw new Error("Tipo de componente inválido");

      const result = await db.execute(
        input.familia?.trim()
          ? sql`UPDATE products SET ${sql.raw(`\`${col}\``)} = ${input.modeloNovo} WHERE ${sql.raw(`\`${col}\``)} = ${input.modeloAntigo} AND familia = ${input.familia}`
          : sql`UPDATE products SET ${sql.raw(`\`${col}\``)} = ${input.modeloNovo} WHERE ${sql.raw(`\`${col}\``)} = ${input.modeloAntigo}`
      );

      const affectedRows = (result[0] as any)?.affectedRows ?? 0;
      return { updated: Number(affectedRows) };
    }),

  // ─── Search components by tipo + query string (autocomplete) ───────────────
  searchByTipo: publicProcedure
    .input(z.object({
      tipo: z.enum(COMPONENT_TYPES),
      query: z.string().default(""),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const q = input.query.trim();
      const rows = q
        ? await db
            .select({ modelo: components.modelo })
            .from(components)
            .where(and(eq(components.tipo, input.tipo), like(components.modelo, `%${q}%`)))
            .orderBy(asc(components.modelo))
            .limit(30)
        : await db
            .select({ modelo: components.modelo })
            .from(components)
            .where(eq(components.tipo, input.tipo))
            .orderBy(asc(components.modelo))
            .limit(30);
      return rows.map((r) => r.modelo).filter(Boolean);
    }),

  // ─── List products using a specific component ────────────────────────────
  getProductsUsing: publicProcedure
    .input(
      z.object({
        tipo: z.enum(COMPONENT_TYPES),
        modelo: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const col = TYPE_TO_COLUMN[input.tipo];
      if (!col) return [];

      const rows = await db.execute(
        sql`SELECT id, produto, sku, familia, categoria FROM products WHERE ${sql.raw(`\`${col}\``)} = ${input.modelo} ORDER BY familia ASC, produto ASC`
      );
      const data = (rows[0] as unknown as any[]) ?? [];
      return data.map((r: any) => ({
        id: r.id as number,
        produto: r.produto as string,
        sku: r.sku as string,
        familia: r.familia as string,
        categoria: r.categoria as string,
      }));
    }),

  // ─── List distinct families (for filter dropdown) ────────────────────────
  families: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .selectDistinct({ familia: products.familia })
      .from(products)
      .orderBy(asc(products.familia));
    return rows.map((r: { familia: string }) => r.familia).filter(Boolean);
  }),
});
