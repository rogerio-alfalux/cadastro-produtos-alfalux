import { z } from "zod";
import { eq, like, and, or, sql, asc } from "drizzle-orm";
import { getDb } from "../db";
import { accessories } from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

// ─── Validation schema ────────────────────────────────────────────────────────

const accessorySchema = z.object({
  codigo: z.string().optional().default(""),
  sku: z.string().optional().default(""),
  produto: z.string().optional().default(""),
  familia: z.string().optional().default(""),
  dimensao: z.string().optional().default(""),
  fotoUrl: z.string().nullish(),
  fotoKey: z.string().nullish(),
  custo: z.string().nullish(),
  precoVenda: z.string().nullish(),
  observacoes: z.string().nullish(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const accessoriesRouter = router({
  // Listar com filtros e paginação
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        familia: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const { search, familia, limit, offset } = input;

      const conditions = [];

      if (search) {
        conditions.push(
          or(
            like(accessories.produto, `%${search}%`),
            like(accessories.codigo, `%${search}%`),
            like(accessories.sku, `%${search}%`),
            like(accessories.familia, `%${search}%`)
          )
        );
      }

      if (familia) {
        conditions.push(eq(accessories.familia, familia));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countRows] = await Promise.all([
        db
          .select()
          .from(accessories)
          .where(where)
          .orderBy(asc(accessories.codigo))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: sql<number>`COUNT(*)` })
          .from(accessories)
          .where(where),
      ]);

      return { items, total: Number(countRows[0]?.total ?? 0) };
    }),

  // Listar famílias únicas para filtro
  listFamilias: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .selectDistinct({ familia: accessories.familia })
      .from(accessories)
      .orderBy(asc(accessories.familia));
    return rows
      .map((r) => r.familia)
      .filter((f): f is string => !!f && f.trim() !== "");
  }),

  // Buscar por ID
  getById: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [item] = await db
        .select()
        .from(accessories)
        .where(eq(accessories.id, input.id))
        .limit(1);
      return item ?? null;
    }),

  // Criar
  create: protectedProcedure
    .input(accessorySchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      const [result] = await db.insert(accessories).values({
        codigo: input.codigo?.trim().toUpperCase() || null,
        sku: input.sku?.trim().toUpperCase() || null,
        produto: input.produto?.trim().toUpperCase() || null,
        familia: input.familia?.trim().toUpperCase() || null,
        dimensao: input.dimensao?.trim().toUpperCase() || null,
        fotoUrl: input.fotoUrl || null,
        fotoKey: input.fotoKey || null,
        custo: input.custo || null,
        precoVenda: input.precoVenda || null,
        observacoes: input.observacoes || null,
      });
      return { id: (result as any).insertId };
    }),

  // Atualizar
  update: protectedProcedure
    .input(z.object({ id: z.number().int() }).merge(accessorySchema))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      const { id, ...data } = input;
      await db
        .update(accessories)
        .set({
          codigo: data.codigo?.trim().toUpperCase() || null,
          sku: data.sku?.trim().toUpperCase() || null,
          produto: data.produto?.trim().toUpperCase() || null,
          familia: data.familia?.trim().toUpperCase() || null,
          dimensao: data.dimensao?.trim().toUpperCase() || null,
          fotoUrl: data.fotoUrl || null,
          fotoKey: data.fotoKey || null,
          custo: data.custo || null,
          precoVenda: data.precoVenda || null,
          observacoes: data.observacoes || null,
        })
        .where(eq(accessories.id, id));
      return { success: true };
    }),

  // Excluir
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db
        .delete(accessories)
        .where(eq(accessories.id, input.id));
      return { success: true };
    }),
});
