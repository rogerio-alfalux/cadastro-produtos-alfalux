import { z } from "zod";
import { eq, like, and, or, sql, asc } from "drizzle-orm";
import { getDb } from "../db";
import { revendaProducts } from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

// ─── Validation schema ────────────────────────────────────────────────────────

const revendaSchema = z.object({
  codigo: z.string().min(1, "CÓDIGO é obrigatório"),
  descricao: z.string().min(1, "DESCRIÇÃO é obrigatória"),
  referencia: z.string().nullish(),
  fornecedor: z.string().nullish(),
  observacoes: z.string().nullish(),
  fotoUrl: z.string().nullish(),
  fotoKey: z.string().nullish(),
  custo: z.string().nullish(),
  precoVenda: z.string().nullish(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const revendaRouter = router({
  // Listar com filtros e paginação
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        fornecedor: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const { search, fornecedor, limit, offset } = input;

      const conditions = [];

      if (search) {
        conditions.push(
          or(
            like(revendaProducts.descricao, `%${search}%`),
            like(revendaProducts.codigo, `%${search}%`),
            like(revendaProducts.referencia, `%${search}%`)
          )
        );
      }

      if (fornecedor) {
        conditions.push(eq(revendaProducts.fornecedor, fornecedor));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countRows] = await Promise.all([
        db
          .select()
          .from(revendaProducts)
          .where(where)
          .orderBy(asc(revendaProducts.codigo))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: sql<number>`COUNT(*)` })
          .from(revendaProducts)
          .where(where),
      ]);

      return { items, total: Number(countRows[0]?.total ?? 0) };
    }),

  // Listar fornecedores únicos para filtro
  listFornecedores: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .selectDistinct({ fornecedor: revendaProducts.fornecedor })
      .from(revendaProducts)
      .orderBy(asc(revendaProducts.fornecedor));
    return rows
      .map((r) => r.fornecedor)
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
        .from(revendaProducts)
        .where(eq(revendaProducts.id, input.id))
        .limit(1);
      return item ?? null;
    }),

  // Criar
  create: protectedProcedure
    .input(revendaSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      const [result] = await db.insert(revendaProducts).values({
        codigo: input.codigo.trim().toUpperCase(),
        descricao: input.descricao.trim().toUpperCase(),
        referencia: input.referencia?.trim() || null,
        fornecedor: input.fornecedor?.trim().toUpperCase() || null,
        observacoes: input.observacoes?.trim() || null,
        fotoUrl: input.fotoUrl || null,
        fotoKey: input.fotoKey || null,
        custo: input.custo || null,
        precoVenda: input.precoVenda || null,
      });
      return { id: (result as any).insertId };
    }),

  // Atualizar
  update: protectedProcedure
    .input(z.object({ id: z.number().int() }).merge(revendaSchema))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      const { id, ...data } = input;
      await db
        .update(revendaProducts)
        .set({
          codigo: data.codigo.trim().toUpperCase(),
          descricao: data.descricao.trim().toUpperCase(),
          referencia: data.referencia?.trim() || null,
          fornecedor: data.fornecedor?.trim().toUpperCase() || null,
          observacoes: data.observacoes?.trim() || null,
          fotoUrl: data.fotoUrl || null,
          fotoKey: data.fotoKey || null,
          custo: data.custo || null,
          precoVenda: data.precoVenda || null,
        })
        .where(eq(revendaProducts.id, id));
      return { success: true };
    }),

  // Excluir
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db
        .delete(revendaProducts)
        .where(eq(revendaProducts.id, input.id));
      return { success: true };
    }),
});
