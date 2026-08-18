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

// Map component type → product column name(s)
// For types with multiple columns, use an array
const TYPE_TO_COLUMN: Record<string, string | string[]> = {
  DRIVER_ONOFF_220: "driverOnoff220",
  DRIVER_ONOFF_BIVOLT: "driverOnoffBivolt",
  DRIVER_DIM_110V: "driverDim110v",
  DRIVER_DIM_DALI: "driverDimDali",
  DRIVER_DIM_TRIAC_110V: "driverDimTriac110v",
  DRIVER_DIM_TRIAC_220V: "driverDimTriac220v",
  OTICA: "otica",
  HOLDER: "holder",
  DISSIPADOR: "dissipador",
  // MODULO_LED pode estar em qualquer coluna de CCT ou no campo principal
  MODULO_LED: ["moduloLed", "moduloLed2700", "moduloLed3000", "moduloLed3500", "moduloLed4000", "moduloLed5000", "moduloLedRgbw"],
};

// Map component type → product custo column name(s)
const TYPE_TO_CUSTO_COLUMN: Record<string, string | string[]> = {
  DRIVER_ONOFF_220: "custoDriverOnoff220",
  DRIVER_ONOFF_BIVOLT: "custoDriverOnoffBivolt",
  DRIVER_DIM_110V: "custoDriverDim110v",
  DRIVER_DIM_DALI: "custoDriverDimDali",
  DRIVER_DIM_TRIAC_110V: "custoDriverDimTriac110v",
  DRIVER_DIM_TRIAC_220V: "custoDriverDimTriac220v",
};

// Propagate component changes (modelo rename and/or custoDriver update) to all products
async function propagateComponentToProducts(
  db: Awaited<ReturnType<typeof getDb>>,
  tipo: string,
  oldModelo: string,
  novoModelo: string | undefined,
  novoCusto: number | null | undefined  // undefined = no change
) {
  if (!db) return;
  const cols = TYPE_TO_COLUMN[tipo];
  if (!cols) return;

  const colList = Array.isArray(cols) ? cols : [cols];

  for (const col of colList) {
    const productField = products[col as keyof typeof products] as any;
    if (!productField) continue;

    const updatePayload: Record<string, any> = {};

    // Rename modelo in product text field
    if (novoModelo !== undefined && novoModelo !== oldModelo) {
      updatePayload[col] = novoModelo;
    }

    // Update custo (drivers only)
    const custoCol = TYPE_TO_CUSTO_COLUMN[tipo];
    if (novoCusto !== undefined && custoCol && !Array.isArray(custoCol)) {
      updatePayload[custoCol as string] = novoCusto;
    }

    if (Object.keys(updatePayload).length > 0) {
      await db.update(products)
        .set(updatePayload as any)
        .where(eq(productField, oldModelo));
    }

    // Update extras JSON field (drivers and otica have extras)
    const extraCol = col + "Extra";
    const extraField = products[extraCol as keyof typeof products] as any;
    if (!extraField) continue;

    const allWithExtra = await db
      .select({ id: products.id, extra: extraField })
      .from(products)
      .where(sql`${extraField} IS NOT NULL AND ${extraField} != ''`);

    for (const row of allWithExtra) {
      if (!row.extra) continue;
      try {
        const extras = JSON.parse(row.extra as string) as Array<{ modelo: string; qtd: number; custo: any }>;
        let changed = false;
        const fixed = extras.map(e => {
          if (e.modelo === oldModelo) {
            changed = true;
            return {
              ...e,
              ...(novoModelo !== undefined && novoModelo !== oldModelo ? { modelo: novoModelo } : {}),
              ...(novoCusto !== undefined ? { custo: novoCusto } : {}),
            };
          }
          return e;
        });
        if (changed) {
          await db.update(products).set({ [extraCol]: JSON.stringify(fixed) } as any).where(eq(products.id, row.id));
        }
      } catch {}
    }
  }
}

// Legacy alias kept for backwards compat
async function propagateCustoToProducts(
  db: Awaited<ReturnType<typeof getDb>>,
  tipo: string,
  modelo: string,
  novoCusto: number | null
) {
  return propagateComponentToProducts(db, tipo, modelo, undefined, novoCusto);
}

export const componentsRouter = router({
  // ─── List all components (optionally filtered by type/search) ────────────
  list: publicProcedure
    .input(
      z.object({
        tipo: z.enum(COMPONENT_TYPES).optional(),
        search: z.string().optional(),
        apenasInativos: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.tipo) conditions.push(eq(components.tipo, input.tipo));
      if (input?.search?.trim()) conditions.push(like(components.modelo, `%${input.search.trim()}%`));
      if (input?.apenasInativos) conditions.push(eq(components.ativo, false));
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
        custoDriver: z.string().optional(),
        mkpPadraoDriver: z.string().optional(),
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
        ...(input.custoDriver && input.custoDriver.trim() !== '' ? { custoDriver: input.custoDriver.trim().replace(',', '.') } : {}),
        ...(input.mkpPadraoDriver && input.mkpPadraoDriver.trim() !== '' ? { mkpPadraoDriver: input.mkpPadraoDriver.trim().replace(',', '.') } : {}),
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
        custoDriver: z.string().optional(),
        mkpPadraoDriver: z.string().optional(),
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
      const newCustoDriver = data.custoDriver !== undefined
        ? ((data.custoDriver && data.custoDriver.trim() !== '') ? data.custoDriver.trim().replace(',', '.') : null)
        : undefined;

      // Fetch ORIGINAL state BEFORE update (needed for propagation)
      const modeloChanged = data.modelo !== undefined;
      const custoChanged = newCustoDriver !== undefined;
      let oldTipo = '';
      let oldModelo = '';
      if (modeloChanged || custoChanged) {
        const before = await db.select({ tipo: components.tipo, modelo: components.modelo })
          .from(components).where(eq(components.id, id)).limit(1);
        if (before.length > 0) {
          oldTipo = before[0].tipo;
          oldModelo = before[0].modelo ?? '';
        }
      }

      await db.update(components).set({
        modelo: data.modelo?.trim(),
        codigo: data.codigo?.trim() ? data.codigo.trim().toUpperCase() : null,
        observacao: data.observacao?.trim() || null,
        custo: (data.custo && data.custo.trim() !== '') ? data.custo.trim().replace(',', '.') : null,
        ...(newCustoDriver !== undefined ? { custoDriver: newCustoDriver } : {}),
        ...(data.mkpPadraoDriver !== undefined ? { mkpPadraoDriver: (data.mkpPadraoDriver && data.mkpPadraoDriver.trim() !== '') ? data.mkpPadraoDriver.trim().replace(',', '.') : null } : {}),
        ...(data.fotoUrl !== undefined ? { fotoUrl: data.fotoUrl || null } : {}),
        ...(data.fotoKey !== undefined ? { fotoKey: data.fotoKey || null } : {}),
      }).where(eq(components.id, id));

      // Propagate modelo rename and/or custoDriver change to all products
      if ((modeloChanged || custoChanged) && oldModelo) {
        const novoModelo = modeloChanged ? (data.modelo?.trim() ?? oldModelo) : oldModelo;
        const novoCusto = custoChanged
          ? (newCustoDriver !== null ? parseFloat(newCustoDriver as string) : null)
          : undefined;
        await propagateComponentToProducts(db, oldTipo, oldModelo, novoModelo, novoCusto);
      }

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

  // ─── Toggle ativo status ───────────────────────────────────────────────────
  toggleAtivo: publicProcedure
    .input(z.object({ id: z.number(), ativo: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(components).set({ ativo: input.ativo }).where(eq(components.id, input.id));
      return { success: true, id: input.id, ativo: input.ativo };
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
      const colDef = TYPE_TO_COLUMN[input.tipo];
      if (!colDef) return [];

      const cols = Array.isArray(colDef) ? colDef : [colDef];
      // Build WHERE clause using Drizzle sql template with OR conditions
      const conditions = cols.map(c => sql`${sql.raw(`\`${c}\``)} = ${input.modelo}`);
      const whereClause = conditions.reduce((acc, cond, i) =>
        i === 0 ? cond : sql`${acc} OR ${cond}`
      );

      const rows = await db.execute(
        sql`SELECT id, produto, sku, familia, categoria FROM products WHERE (${whereClause}) ORDER BY familia ASC, produto ASC`
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

  // ─── Preview bulk replace: show affected products ────────────────────────
  previewReplace: publicProcedure
    .input(
      z.object({
        tipo: z.enum(COMPONENT_TYPES),
        modeloAtual: z.string().min(1),
        familia: z.string().optional(), // optional family filter
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { total: 0, produtos: [] };
      const colDef = TYPE_TO_COLUMN[input.tipo];
      if (!colDef) return { total: 0, produtos: [] };
      const cols = Array.isArray(colDef) ? colDef : [colDef];

      const conditions = cols.map(c => sql`${sql.raw(`\`${c}\``)} = ${input.modeloAtual}`);
      const whereClause = conditions.reduce((acc, cond, i) =>
        i === 0 ? cond : sql`${acc} OR ${cond}`
      );

      const familiaFilter = input.familia?.trim() ? sql` AND familia = ${input.familia.trim()}` : sql``;

      const rows = await db.execute(
        sql`SELECT id, produto, sku, familia, categoria FROM products WHERE (${whereClause})${familiaFilter} ORDER BY familia ASC, produto ASC`
      );
      const data = (rows[0] as unknown as any[]) ?? [];
      const produtos = data.map((r: any) => ({
        id: r.id as number,
        produto: r.produto as string,
        sku: r.sku as string,
        familia: r.familia as string,
        categoria: r.categoria as string,
      }));
      return { total: produtos.length, produtos };
    }),

  // ─── Execute bulk replace ─────────────────────────────────────────────────
  executeReplace: publicProcedure
    .input(
      z.object({
        tipo: z.enum(COMPONENT_TYPES),
        modeloAtual: z.string().min(1),
        modeloNovo: z.string().min(1),
        familia: z.string().optional(),
        productIds: z.array(z.number()).optional(), // se fornecido, substitui apenas nesses IDs
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Fetch new component's custoDriver (if it's a driver type)
      const newComp = await db
        .select({ custoDriver: components.custoDriver })
        .from(components)
        .where(and(eq(components.tipo, input.tipo), eq(components.modelo, input.modeloNovo)))
        .limit(1);
      const novoCusto = newComp.length > 0 && newComp[0].custoDriver
        ? parseFloat(newComp[0].custoDriver as string)
        : null;

      const colDef = TYPE_TO_COLUMN[input.tipo];
      if (!colDef) throw new Error("Tipo inválido");
      const cols = Array.isArray(colDef) ? colDef : [colDef];
      const custoColDef = TYPE_TO_CUSTO_COLUMN[input.tipo];

      const familiaFilter = input.familia?.trim() ? sql` AND familia = ${input.familia.trim()}` : sql``;
      let totalUpdated = 0;

      for (const col of cols) {
        const updateSet: Record<string, any> = { [col]: input.modeloNovo };
        if (custoColDef && !Array.isArray(custoColDef) && newComp.length > 0) {
          updateSet[custoColDef as string] = novoCusto;
        }

        const productField = products[col as keyof typeof products] as any;
        if (!productField) continue;

        // Build WHERE: col = modeloAtual [AND familia = X]
        const baseWhere = eq(productField, input.modeloAtual);
        let whereClause: any = baseWhere;
        if (input.familia?.trim()) {
          whereClause = and(whereClause, eq(products.familia, input.familia.trim()));
        }
        if (input.productIds && input.productIds.length > 0) {
          whereClause = and(whereClause, inArray(products.id, input.productIds));
        }

        const result = await db.update(products)
          .set(updateSet as any)
          .where(whereClause);
        totalUpdated += (result[0] as any)?.affectedRows ?? 0;

        // Update extras JSON
        const extraCol = col + "Extra";
        const extraField = products[extraCol as keyof typeof products] as any;
        if (!extraField) continue;

        const extraCondition = familiaFilter
          ? sql`${extraField} IS NOT NULL AND ${extraField} != ''${familiaFilter}`
          : sql`${extraField} IS NOT NULL AND ${extraField} != ''`;

        const allWithExtra = await db
          .select({ id: products.id, extra: extraField })
          .from(products)
          .where(
            input.productIds && input.productIds.length > 0
              ? and(extraCondition, inArray(products.id, input.productIds))
              : extraCondition
          );

        for (const row of allWithExtra) {
          if (!row.extra) continue;
          try {
            const extras = JSON.parse(row.extra as string) as Array<{ modelo: string; qtd: number; custo: any }>;
            let changed = false;
            const fixed = extras.map(e => {
              if (e.modelo === input.modeloAtual) {
                changed = true;
                return { ...e, modelo: input.modeloNovo, ...(newComp.length > 0 ? { custo: novoCusto } : {}) };
              }
              return e;
            });
            if (changed) {
              await db.update(products).set({ [extraCol]: JSON.stringify(fixed) } as any).where(eq(products.id, row.id));
            }
          } catch {}
        }
      }

      return { success: true, totalUpdated };
    }),
});
