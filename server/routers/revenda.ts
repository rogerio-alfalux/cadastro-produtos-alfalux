import { z } from "zod";
import { eq, like, and, or, sql, asc } from "drizzle-orm";
import { getDb } from "../db";
import { revendaProducts } from "../../drizzle/schema";
import { costProcedure, entityAdminProcedure, protectedProcedure, router } from "../_core/trpc";
import { can } from "../../shared/permissions";

// ─── Validation schema ────────────────────────────────────────────────────────

const revendaSchema = z.object({
  codigo: z.string().min(1, "CÓDIGO é obrigatório"),
  descricao: z.string().min(1, "DESCRIÇÃO é obrigatória"),
  referencia: z.string().nullish(),
  fornecedor: z.string().nullish(),
  familia: z.string().nullish(),
  observacoes: z.string().nullish(),
  fotoUrl: z.string().nullish(),
  fotoKey: z.string().nullish(),
  custo: z.string().nullish(),
  precoVenda: z.string().nullish(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const revendaRouter = router({
  // Listar com filtros e paginação
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        fornecedor: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
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

      const visibleItems = can(ctx.user.role, "viewCosts", ctx.user.permissionOverrides) || can(ctx.user.role, "editCosts", ctx.user.permissionOverrides)
        ? items
        : items.map((item) => ({ ...item, custo: null, precoVenda: null }));
      return { items: visibleItems, total: Number(countRows[0]?.total ?? 0) };
    }),

  // Listar fornecedores únicos para filtro
  listFornecedores: protectedProcedure.query(async () => {
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
  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const [item] = await db
        .select()
        .from(revendaProducts)
        .where(eq(revendaProducts.id, input.id))
        .limit(1);
      if (!item) return null;
      return can(ctx.user.role, "viewCosts", ctx.user.permissionOverrides) || can(ctx.user.role, "editCosts", ctx.user.permissionOverrides)
        ? item
        : { ...item, custo: null, precoVenda: null };
    }),

  // Criar
  create: entityAdminProcedure
    .input(revendaSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      const [result] = await db.insert(revendaProducts).values({
        codigo: input.codigo.trim().toUpperCase(),
        descricao: input.descricao.trim().toUpperCase(),
        referencia: input.referencia?.trim() || null,
        fornecedor: input.fornecedor?.trim().toUpperCase() || null,
        familia: input.familia?.trim().toUpperCase() || null,
        observacoes: input.observacoes?.trim() || null,
        fotoUrl: input.fotoUrl || null,
        fotoKey: input.fotoKey || null,
        custo: input.custo || null,
        precoVenda: input.precoVenda || null,
      });
      return { id: (result as any).insertId };
    }),

  // Atualizar
  update: entityAdminProcedure
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
          familia: data.familia?.trim().toUpperCase() || null,
          observacoes: data.observacoes?.trim() || null,
          fotoUrl: data.fotoUrl || null,
          fotoKey: data.fotoKey || null,
          custo: data.custo || null,
          precoVenda: data.precoVenda || null,
        })
        .where(eq(revendaProducts.id, id));
      return { success: true };
    }),

  // Próximo código disponível
  nextCode: entityAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { codigo: "RV00001" };
    const rows = await db
      .select({ codigo: revendaProducts.codigo })
      .from(revendaProducts)
      .orderBy(sql`CAST(SUBSTRING(codigo, 3) AS UNSIGNED) DESC`)
      .limit(1);
    if (!rows.length) return { codigo: "RV00001" };
    const last = rows[0].codigo;
    const match = last.match(/^RV(\d+)$/);
    if (!match) return { codigo: "RV00001" };
    const next = parseInt(match[1], 10) + 1;
    return { codigo: `RV${String(next).padStart(5, "0")}` };
  }),

  // Excluir
  delete: entityAdminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db
        .delete(revendaProducts)
        .where(eq(revendaProducts.id, input.id));
      return { success: true };
    }),

  updateCosts: costProcedure
    .input(z.object({
      id: z.number().int(),
      custo: z.string().nullish(),
      precoVenda: z.string().nullish(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.update(revendaProducts).set({
        custo: input.custo?.trim() || null,
        precoVenda: input.precoVenda?.trim() || null,
      }).where(eq(revendaProducts.id, input.id));
      return { success: true };
    }),
});
