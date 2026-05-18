import { z } from "zod";
import { asc, sql } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { products } from "../../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

const DRIVER_TYPES = [
  "DRIVER_ONOFF_220",
  "DRIVER_ONOFF_BIVOLT",
  "DRIVER_DIM_110V",
  "DRIVER_DIM_DALI",
] as const;
type DriverType = (typeof DRIVER_TYPES)[number];

const DRIVER_COL: Record<DriverType, string> = {
  DRIVER_ONOFF_220: "driverOnoff220",
  DRIVER_ONOFF_BIVOLT: "driverOnoffBivolt",
  DRIVER_DIM_110V: "driverDim110v",
  DRIVER_DIM_DALI: "driverDimDali",
};

const DRIVER_CUSTO_COL: Record<DriverType, string> = {
  DRIVER_ONOFF_220: "custoDriverOnoff220",
  DRIVER_ONOFF_BIVOLT: "custoDriverOnoffBivolt",
  DRIVER_DIM_110V: "custoDriverDim110v",
  DRIVER_DIM_DALI: "custoDriverDimDali",
};

const DRIVER_NAO_APLICAVEL_COL: Record<DriverType, string | null> = {
  DRIVER_ONOFF_220: null,
  DRIVER_ONOFF_BIVOLT: "driverOnoffBivoltNaoAplicavel",
  DRIVER_DIM_110V: "driverDim110vNaoAplicavel",
  DRIVER_DIM_DALI: "driverDimDaliNaoAplicavel",
};

// ─── Shared filter builder ────────────────────────────────────────────────────

function buildWhere(filters: {
  familia?: string;
  categoria?: string;
  moduloLedContem?: string;
  driverAtual?: string;
  driverCol?: string;
}): string {
  const clauses: string[] = ["1=1"];
  if (filters.familia?.trim()) clauses.push(`familia = '${filters.familia.replace(/'/g, "''")}'`);
  if (filters.categoria?.trim()) clauses.push(`categoria = '${filters.categoria.replace(/'/g, "''")}'`);
  if (filters.moduloLedContem?.trim()) clauses.push(`moduloLed LIKE '%${filters.moduloLedContem.replace(/'/g, "''")}%'`);
  if (filters.driverAtual?.trim() && filters.driverCol) {
    clauses.push(`\`${filters.driverCol}\` = '${filters.driverAtual.replace(/'/g, "''")}'`);
  }
  return clauses.join(" AND ");
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const bulkOpsRouter = router({


  // ─── Autocomplete for moduloLed field ────────────────────────────────────────
  moduloLedSuggestions: publicProcedure
    .input(z.object({ query: z.string().default(""), categoria: z.string().optional(), familia: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const q = input.query.trim();
      if (!q) return [];
      const extra: string[] = [];
      if (input.categoria?.trim()) extra.push(`categoria = '${input.categoria.replace(/'/g, "''")}'`);
      if (input.familia?.trim()) extra.push(`familia = '${input.familia.replace(/'/g, "''")}'`);
      const extraSql = extra.length ? ` AND ${extra.join(" AND ")}` : "";
      const result = await db.execute(
        sql`SELECT DISTINCT moduloLed as val FROM products WHERE moduloLed LIKE ${`%${q}%`}${sql.raw(extraSql)} AND moduloLed IS NOT NULL AND moduloLed != '' ORDER BY val ASC LIMIT 30`
      );
      return ((result[0] as unknown as any[]) ?? []).map((r: any) => r.val).filter(Boolean);
    }),

  // ─── List distinct families ────────────────────────────────────────────────
  families: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .selectDistinct({ familia: products.familia })
      .from(products)
      .orderBy(asc(products.familia));
    return rows.map((r: { familia: string }) => r.familia).filter(Boolean);
  }),

  // ─── List distinct families filtered by category ───────────────────────────
  familiesByCategory: publicProcedure
    .input(z.object({ categoria: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (!input.categoria?.trim()) {
        const rows = await db
          .selectDistinct({ familia: products.familia })
          .from(products)
          .orderBy(asc(products.familia));
        return rows.map((r: { familia: string }) => r.familia).filter(Boolean);
      }
      const result = await db.execute(
        sql`SELECT DISTINCT familia FROM products WHERE categoria = ${input.categoria} AND familia IS NOT NULL AND familia != '' ORDER BY familia ASC`
      );
      return ((result[0] as unknown as any[]) ?? []).map((r: any) => r.familia).filter(Boolean);
    }),

  // ─── List distinct driver values filtered by query string (autocomplete) ────
  driverValuesByQuery: publicProcedure
    .input(z.object({ tipo: z.enum(DRIVER_TYPES), query: z.string().default("") }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const col = DRIVER_COL[input.tipo];
      const q = input.query.trim();
      if (!q) {
        const result = await db.execute(
          sql`SELECT DISTINCT ${sql.raw(`\`${col}\``)} as val FROM products WHERE ${sql.raw(`\`${col}\``)} IS NOT NULL AND ${sql.raw(`\`${col}\``)} != '' ORDER BY val ASC LIMIT 30`
        );
        return ((result[0] as unknown as any[]) ?? []).map((r: any) => r.val).filter(Boolean);
      }
      const result = await db.execute(
        sql`SELECT DISTINCT ${sql.raw(`\`${col}\``)} as val FROM products WHERE ${sql.raw(`\`${col}\``)} LIKE ${`%${q}%`} ORDER BY val ASC LIMIT 30`
      );
      return ((result[0] as unknown as any[]) ?? []).map((r: any) => r.val).filter(Boolean);
    }),

  // ─── List distinct categories ──────────────────────────────────────────────
  categories: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const result = await db.execute(sql`SELECT DISTINCT categoria FROM products WHERE categoria IS NOT NULL AND categoria != '' ORDER BY categoria ASC`);
      return ((result[0] as unknown as any[]) ?? []).map((r: any) => r.categoria).filter(Boolean);
  }),

  // ─── List distinct driver values for a given type (for dropdown) ───────────
  driverValues: publicProcedure
    .input(z.object({ tipo: z.enum(DRIVER_TYPES) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const col = DRIVER_COL[input.tipo];
      const result = await db.execute(
        sql`SELECT DISTINCT ${sql.raw(`\`${col}\``)} as val FROM products WHERE ${sql.raw(`\`${col}\``)} IS NOT NULL AND ${sql.raw(`\`${col}\``)} != '' ORDER BY val ASC`
      );
      return ((result[0] as unknown as any[]) ?? []).map((r: any) => r.val).filter(Boolean);
    }),

  // ─── Preview: count products affected by cost update (luminária) ───────────
  previewCostLuminaria: publicProcedure
    .input(z.object({
      familia: z.string().optional(),
      categoria: z.string().optional(),
      moduloLedContem: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { count: 0, produtos: [] };
      const where = buildWhere(input);
      const countResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM products WHERE ${sql.raw(where)}`);
      const count = Number((countResult[0] as any)?.[0]?.cnt ?? 0);
      const listResult = await db.execute(sql`SELECT id, produto, familia, sku, custoLuminaria FROM products WHERE ${sql.raw(where)} ORDER BY familia, produto LIMIT 20`);
      return { count, produtos: (listResult[0] as unknown as any[]) ?? [] };
    }),

  // ─── Apply: update custo da luminária em massa ─────────────────────────────
  applyCostLuminaria: publicProcedure
    .input(z.object({
      familia: z.string().optional(),
      categoria: z.string().optional(),
      moduloLedContem: z.string().optional(),
      novoCusto: z.string().min(1, "Novo custo é obrigatório"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const where = buildWhere({ familia: input.familia, categoria: input.categoria, moduloLedContem: input.moduloLedContem });
      const result = await db.execute(
        sql`UPDATE products SET custoLuminaria = ${input.novoCusto} WHERE ${sql.raw(where)}`
      );
      return { updated: Number((result[0] as any)?.affectedRows ?? 0) };
    }),

  // ─── Preview: count products affected by driver cost update ───────────────
  previewCostDriver: publicProcedure
    .input(z.object({
      tipo: z.enum(DRIVER_TYPES),
      familia: z.string().optional(),
      categoria: z.string().optional(),
      moduloLedContem: z.string().optional(),
      driverAtual: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { count: 0, produtos: [] };
      const col = DRIVER_COL[input.tipo];
      const where = buildWhere({ familia: input.familia, categoria: input.categoria, moduloLedContem: input.moduloLedContem, driverAtual: input.driverAtual, driverCol: col });
      const whereWithDriver = where + ` AND \`${col}\` IS NOT NULL AND \`${col}\` != ''`;
      const countResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM products WHERE ${sql.raw(whereWithDriver)}`);
      const count = Number((countResult[0] as any)?.[0]?.cnt ?? 0);
      const custCol = DRIVER_CUSTO_COL[input.tipo];
      const listResult = await db.execute(sql`SELECT id, produto, familia, sku, ${sql.raw(`\`${col}\``)} as driver, ${sql.raw(`\`${custCol}\``)} as custoAtual FROM products WHERE ${sql.raw(whereWithDriver)} ORDER BY familia, produto LIMIT 20`);
      return { count, produtos: (listResult[0] as unknown as any[]) ?? [] };
    }),

  // ─── Apply: update custo de driver em massa ────────────────────────────────
  applyCostDriver: publicProcedure
    .input(z.object({
      tipo: z.enum(DRIVER_TYPES),
      familia: z.string().optional(),
      categoria: z.string().optional(),
      moduloLedContem: z.string().optional(),
      driverAtual: z.string().optional(),
      novoCusto: z.string().min(1, "Novo custo é obrigatório"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const col = DRIVER_COL[input.tipo];
      const custCol = DRIVER_CUSTO_COL[input.tipo];
      const where = buildWhere({ familia: input.familia, categoria: input.categoria, moduloLedContem: input.moduloLedContem, driverAtual: input.driverAtual, driverCol: col });
      const whereWithDriver = where + ` AND \`${col}\` IS NOT NULL AND \`${col}\` != ''`;
      const result = await db.execute(
        sql`UPDATE products SET ${sql.raw(`\`${custCol}\``)} = ${input.novoCusto} WHERE ${sql.raw(whereWithDriver)}`
      );
      return { updated: Number((result[0] as any)?.affectedRows ?? 0) };
    }),

  // ─── Preview: count products affected by driver set/remove ────────────────
  previewDriver: publicProcedure
    .input(z.object({
      tipo: z.enum(DRIVER_TYPES),
      acao: z.enum(["INSERIR", "REMOVER"]),
      familia: z.string().optional(),
      categoria: z.string().optional(),
      moduloLedContem: z.string().optional(),
      driverAtual: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { count: 0, produtos: [] };
      const col = DRIVER_COL[input.tipo];
      const naoApCol = DRIVER_NAO_APLICAVEL_COL[input.tipo];

      let extraClause = "";
      if (input.acao === "REMOVER") {
        // Only affect products that have the driver
        extraClause = ` AND \`${col}\` IS NOT NULL AND \`${col}\` != ''`;
      } else {
        // INSERIR: affect products that don't have the driver yet (or are empty)
        // NOTE: do NOT filter by naoAplicavel — the user explicitly wants to insert
        extraClause = ` AND (\`${col}\` IS NULL OR \`${col}\` = '')`;
      }

      const where = buildWhere({ familia: input.familia, categoria: input.categoria, moduloLedContem: input.moduloLedContem, driverAtual: input.driverAtual, driverCol: input.acao === "REMOVER" ? col : undefined });
      const fullWhere = where + extraClause;

      const countResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM products WHERE ${sql.raw(fullWhere)}`);
      const count = Number((countResult[0] as any)?.[0]?.cnt ?? 0);
      const listResult = await db.execute(sql`SELECT id, produto, familia, sku, ${sql.raw(`\`${col}\``)} as driverAtual FROM products WHERE ${sql.raw(fullWhere)} ORDER BY familia, produto LIMIT 20`);
      return { count, produtos: (listResult[0] as unknown as any[]) ?? [] };
    }),

  // ─── Apply: inserir ou remover driver em massa ─────────────────────────────
  applyDriver: publicProcedure
    .input(z.object({
      tipo: z.enum(DRIVER_TYPES),
      acao: z.enum(["INSERIR", "REMOVER"]),
      familia: z.string().optional(),
      categoria: z.string().optional(),
      moduloLedContem: z.string().optional(),
      driverAtual: z.string().optional(),
      novoDriver: z.string().optional(),
      novoCusto: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const col = DRIVER_COL[input.tipo];
      const custCol = DRIVER_CUSTO_COL[input.tipo];
      const naoApCol = DRIVER_NAO_APLICAVEL_COL[input.tipo];

      if (input.acao === "INSERIR" && !input.novoDriver?.trim()) {
        throw new Error("Modelo do driver é obrigatório para inserção");
      }

      let extraClause = "";
      if (input.acao === "REMOVER") {
        extraClause = ` AND \`${col}\` IS NOT NULL AND \`${col}\` != ''`;
      } else {
        // INSERIR: do NOT filter by naoAplicavel — user explicitly wants to insert
        extraClause = ` AND (\`${col}\` IS NULL OR \`${col}\` = '')`;
      }

      const where = buildWhere({ familia: input.familia, categoria: input.categoria, moduloLedContem: input.moduloLedContem, driverAtual: input.driverAtual, driverCol: input.acao === "REMOVER" ? col : undefined });
      const fullWhere = where + extraClause;

      let setClause = "";
      if (input.acao === "REMOVER") {
        setClause = `\`${col}\` = NULL, \`${custCol}\` = NULL`;
        if (naoApCol) setClause += `, \`${naoApCol}\` = 0`;
      } else {
        setClause = `\`${col}\` = '${(input.novoDriver ?? "").replace(/'/g, "''")}'`;
        if (input.novoCusto?.trim()) {
          setClause += `, \`${custCol}\` = '${input.novoCusto.replace(/'/g, "''")}'`;
        }
      }

      const result = await db.execute(
        sql`UPDATE products SET ${sql.raw(setClause)} WHERE ${sql.raw(fullWhere)}`
      );
      return { updated: Number((result[0] as any)?.affectedRows ?? 0) };
    }),
});
