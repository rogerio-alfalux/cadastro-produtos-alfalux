import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { componentsRouter } from "./routers/components";
import { bulkOpsRouter } from "./routers/bulkOps";
import {
  bulkInsertProducts,
  countProducts,
  createProduct,
  deleteProduct,
  getFieldSuggestions,
  getProductById,
  listProducts,
  updateProduct,
} from "./db";

// ─── Validation schema ────────────────────────────────────────────────────────

const productSchema = z.object({
  categoria: z.string().optional(),
  instalacao: z.string().min(1, "INSTALAÇÃO é obrigatório"),
  familia: z.string().min(1, "FAMÍLIA é obrigatório"),
  sku: z.string().min(1, "SKU é obrigatório"),
  produto: z.string().min(1, "PRODUTO é obrigatório"),
  moduloLed: z.string().min(1, "MÓDULO LED é obrigatório"),
  // Ótica: obrigatório a menos que NaoAplicavel=true
  otica: z.string().optional().default(""),
  oticaNaoAplicavel: z.boolean().default(false),
  // Holder: obrigatório a menos que NaoAplicavel=true
  holder: z.string().optional().default(""),
  holderNaoAplicavel: z.boolean().default(false),
  // Dissipador: obrigatório a menos que NaoAplicavel=true
  dissipador: z.string().optional().default(""),
  dissipadorNaoAplicavel: z.boolean().default(false),
  driverOnoff220: z.string().min(1, "ON/OFF DRIVER 220Vac é obrigatório"),
  driverOnoffBivolt: z.string().optional().default(""),
  driverOnoffBivoltNaoAplicavel: z.boolean().default(false),
  driverDim110v: z.string().nullish(),
  driverDim110vNaoAplicavel: z.boolean().default(false),
  driverDimDali: z.string().nullish(),
  driverDimDaliNaoAplicavel: z.boolean().default(false),
  temperaturasCor: z.string().default('["2700","3000","4000","5000"]'),
  fotoUrl: z.string().nullish(),
  fotoKey: z.string().nullish(),
  custoLuminaria: z.string().nullish(),
  custoDriverOnoff220: z.string().nullish(),
  custoDriverOnoffBivolt: z.string().nullish(),
  custoDriverDim110v: z.string().nullish(),
  custoDriverDimDali: z.string().nullish(),
}).superRefine((data, ctx) => {
  // Validar Ótica: obrigatório se não for NaoAplicavel
  if (!data.oticaNaoAplicavel && (!data.otica || data.otica.trim() === "")) {
    ctx.addIssue({ code: "custom", path: ["otica"], message: "ÓTICA é obrigatório" });
  }
  // Validar Holder: obrigatório se não for NaoAplicavel
  if (!data.holderNaoAplicavel && (!data.holder || data.holder.trim() === "")) {
    ctx.addIssue({ code: "custom", path: ["holder"], message: "HOLDER é obrigatório" });
  }
  // Validar Dissipador: obrigatório se não for NaoAplicavel
  if (!data.dissipadorNaoAplicavel && (!data.dissipador || data.dissipador.trim() === "")) {
    ctx.addIssue({ code: "custom", path: ["dissipador"], message: "DISSIPADOR é obrigatório" });
  }
  // Validar ON/OFF BIVOLT: obrigatório se não for NaoAplicavel
  if (!data.driverOnoffBivoltNaoAplicavel && (!data.driverOnoffBivolt || data.driverOnoffBivolt.trim() === "")) {
    ctx.addIssue({ code: "custom", path: ["driverOnoffBivolt"], message: "ON/OFF DRIVER BIVOLT é obrigatório" });
  }
});

const bulkProductSchema = z.object({
  categoria: z.string().optional().default(""),
  instalacao: z.string().default(""),
  familia: z.string().default(""),
  sku: z.string().default(""),
  produto: z.string().default(""),
  moduloLed: z.string().default(""),
  otica: z.string().default(""),
  oticaNaoAplicavel: z.boolean().default(false),
  holder: z.string().default(""),
  holderNaoAplicavel: z.boolean().default(false),
  dissipador: z.string().default(""),
  dissipadorNaoAplicavel: z.boolean().default(false),
  driverOnoff220: z.string().default(""),
  driverOnoffBivolt: z.string().optional().default(""),
  driverOnoffBivoltNaoAplicavel: z.boolean().default(false),
  driverDim110v: z.string().optional(),
  driverDim110vNaoAplicavel: z.boolean().default(false),
  driverDimDali: z.string().optional(),
  driverDimDaliNaoAplicavel: z.boolean().default(false),
  temperaturasCor: z.string().default('["2700","3000","4000","5000"]'),
  fotoUrl: z.string().optional(),
  fotoKey: z.string().optional(),
  custoLuminaria: z.string().optional(),
  custoDriverOnoff220: z.string().optional(),
  custoDriverOnoffBivolt: z.string().optional(),
  custoDriverDim110v: z.string().optional(),
  custoDriverDimDali: z.string().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  components: componentsRouter,
  bulkOps: bulkOpsRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  products: router({
    list: publicProcedure
      .input(
        z.object({
          search: z.string().optional(),
          categoria: z.string().optional(),
          instalacao: z.string().optional(),
          familia: z.string().optional(),
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0),
        })
      )
      .query(async ({ input }) => {
        return await listProducts(input);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await getProductById(input.id);
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
        return product;
      }),

    create: publicProcedure
      .input(productSchema)
      .mutation(async ({ input }) => {
        const data = {
          ...input,
          familia: input.familia.toUpperCase(),
          sku: input.sku.toUpperCase(),
          produto: input.produto.toUpperCase(),
          moduloLed: input.moduloLed.toUpperCase(),
          otica: input.oticaNaoAplicavel ? "NÃO APLICÁVEL" : input.otica.toUpperCase(),
          holder: input.holderNaoAplicavel ? "NÃO APLICÁVEL" : input.holder.toUpperCase(),
          dissipador: input.dissipadorNaoAplicavel ? "NÃO APLICÁVEL" : input.dissipador.toUpperCase(),
          driverOnoff220: input.driverOnoff220.toUpperCase(),
          driverOnoffBivolt: input.driverOnoffBivolt.toUpperCase(),
          driverDim110v: input.driverDim110v?.toUpperCase() || null,
          driverDimDali: input.driverDimDali?.toUpperCase() || null,
          temperaturasCor: input.temperaturasCor || '["2700","3000","4000","5000"]',
          custoLuminaria: input.custoLuminaria || null,
          custoDriverOnoff220: input.custoDriverOnoff220 || null,
          custoDriverOnoffBivolt: input.custoDriverOnoffBivolt || null,
          custoDriverDim110v: input.custoDriverDim110v || null,
          custoDriverDimDali: input.custoDriverDimDali || null,
          fotoUrl: input.fotoUrl || null,
          fotoKey: input.fotoKey || null,
        };
        await createProduct(data);
        return { success: true };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: productSchema.partial() }))
      .mutation(async ({ input }) => {
        const existing = await getProductById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });

        const d = input.data;
        const update: Record<string, unknown> = {};

        if (d.categoria !== undefined) update.categoria = d.categoria;
        if (d.instalacao !== undefined) update.instalacao = d.instalacao;
        if (d.familia !== undefined) update.familia = d.familia.toUpperCase();
        if (d.sku !== undefined) update.sku = d.sku.toUpperCase();
        if (d.produto !== undefined) update.produto = d.produto.toUpperCase();
        if (d.moduloLed !== undefined) update.moduloLed = d.moduloLed.toUpperCase();
        if (d.otica !== undefined) update.otica = d.oticaNaoAplicavel ? "NÃO APLICÁVEL" : d.otica.toUpperCase();
        if (d.oticaNaoAplicavel !== undefined) update.oticaNaoAplicavel = d.oticaNaoAplicavel;
        if (d.holder !== undefined) update.holder = d.holderNaoAplicavel ? "NÃO APLICÁVEL" : d.holder.toUpperCase();
        if (d.holderNaoAplicavel !== undefined) update.holderNaoAplicavel = d.holderNaoAplicavel;
        if (d.dissipador !== undefined) update.dissipador = d.dissipadorNaoAplicavel ? "NÃO APLICÁVEL" : d.dissipador.toUpperCase();
        if (d.dissipadorNaoAplicavel !== undefined) update.dissipadorNaoAplicavel = d.dissipadorNaoAplicavel;
        if (d.driverOnoff220 !== undefined) update.driverOnoff220 = d.driverOnoff220.toUpperCase();
        if (d.driverOnoffBivolt !== undefined) update.driverOnoffBivolt = d.driverOnoffBivolt.toUpperCase();
        if (d.driverOnoffBivoltNaoAplicavel !== undefined) update.driverOnoffBivoltNaoAplicavel = d.driverOnoffBivoltNaoAplicavel;
        // DIM 1-10V: só atualiza se o campo foi explicitamente enviado pelo frontend
        // Nunca sobrescreve com false se o produto já tinha o campo não configurado
        if (d.driverDim110vNaoAplicavel !== undefined) update.driverDim110vNaoAplicavel = d.driverDim110vNaoAplicavel;
        if (d.driverDim110v !== undefined) update.driverDim110v = d.driverDim110v?.toUpperCase() || null;
        // DIM DALI: idem
        if (d.driverDimDaliNaoAplicavel !== undefined) update.driverDimDaliNaoAplicavel = d.driverDimDaliNaoAplicavel;
        if (d.driverDimDali !== undefined) update.driverDimDali = d.driverDimDali?.toUpperCase() || null;
        if (d.temperaturasCor !== undefined) update.temperaturasCor = d.temperaturasCor;
        if (d.fotoUrl !== undefined) update.fotoUrl = d.fotoUrl || null;
        if (d.fotoKey !== undefined) update.fotoKey = d.fotoKey || null;
        if (d.custoLuminaria !== undefined) update.custoLuminaria = d.custoLuminaria || null;
        if (d.custoDriverOnoff220 !== undefined) update.custoDriverOnoff220 = d.custoDriverOnoff220 || null;
        if (d.custoDriverOnoffBivolt !== undefined) update.custoDriverOnoffBivolt = d.custoDriverOnoffBivolt || null;
        if (d.custoDriverDim110v !== undefined) update.custoDriverDim110v = d.custoDriverDim110v || null;
        if (d.custoDriverDimDali !== undefined) update.custoDriverDimDali = d.custoDriverDimDali || null;

        await updateProduct(input.id, update as any);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteProduct(input.id);
        return { success: true };
      }),

    bulkCreate: publicProcedure
      .input(z.array(bulkProductSchema))
      .mutation(async ({ input }) => {
        const items = input.map((p) => ({
          ...p,
          familia: p.familia.toUpperCase(),
          sku: p.sku.toUpperCase(),
          produto: p.produto.toUpperCase(),
          moduloLed: p.moduloLed.toUpperCase(),
          otica: p.oticaNaoAplicavel || p.otica.toUpperCase() === "NÃO APLICÁVEL" ? "NÃO APLICÁVEL" : p.otica.toUpperCase(),
          holder: p.holderNaoAplicavel || p.holder.toUpperCase() === "NÃO APLICÁVEL" ? "NÃO APLICÁVEL" : p.holder.toUpperCase(),
          dissipador: p.dissipadorNaoAplicavel || p.dissipador.toUpperCase() === "NÃO APLICÁVEL" ? "NÃO APLICÁVEL" : p.dissipador.toUpperCase(),
          driverOnoff220: p.driverOnoff220.toUpperCase(),
          driverOnoffBivolt: p.driverOnoffBivolt.toUpperCase(),
          driverDim110v: p.driverDim110v?.toUpperCase() || null,
          driverDimDali: p.driverDimDali?.toUpperCase() || null,
          temperaturasCor: p.temperaturasCor || '["2700","3000","4000","5000"]',
          custoLuminaria: p.custoLuminaria || null,
          custoDriverOnoff220: p.custoDriverOnoff220 || null,
          custoDriverOnoffBivolt: p.custoDriverOnoffBivolt || null,
          custoDriverDim110v: p.custoDriverDim110v || null,
          custoDriverDimDali: p.custoDriverDimDali || null,
          fotoUrl: null,
          fotoKey: null,
        }));
        const { inserted, skipped } = await bulkInsertProducts(items as any);
        return { success: true, inserted, skipped };
      }),

    count: publicProcedure.query(async () => {
      return { count: await countProducts() };
    }),

    getAll: publicProcedure.query(async () => {
      const result = await listProducts({ limit: 2000, offset: 0 });
      return result.items;
    }),

    // Autocomplete suggestions for free-text fields
    suggestions: publicProcedure
      .input(
        z.object({
          field: z.enum([
            "familia", "produto", "moduloLed", "otica", "holder", "dissipador",
            "driverOnoff220", "driverOnoffBivolt", "driverDim110v", "driverDimDali",
          ]),
          query: z.string().min(1).max(100),
        })
      )
      .query(async ({ input }) => {
        return await getFieldSuggestions(input.field, input.query);
      }),
  }),
});

export type AppRouter = typeof appRouter;
