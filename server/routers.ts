import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { componentsRouter } from "./routers/components";
import { bulkOpsRouter } from "./routers/bulkOps";
import { revendaRouter } from "./routers/revenda";
import { accessoriesRouter } from "./routers/accessories";
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
  sku: z.string().optional().default(""),
  produto: z.string().min(1, "PRODUTO é obrigatório"),
  moduloLed: z.string().optional().default(""),
  qtdModuloLed: z.number().min(0.01).default(1),
  // Módulo LED por CCT
  moduloLed2700: z.string().nullish(),
  moduloLed3000: z.string().nullish(),
  moduloLed4000: z.string().nullish(),
  moduloLed5000: z.string().nullish(),
  qtdModuloLed2700: z.number().min(0.01).nullish(),
  qtdModuloLed3000: z.number().min(0.01).nullish(),
  qtdModuloLed4000: z.number().min(0.01).nullish(),
  qtdModuloLed5000: z.number().min(0.01).nullish(),
  // Ótica: obrigatório a menos que NaoAplicavel=true
  otica: z.string().optional().default(""),
  qtdOtica: z.number().int().min(1).default(1),
  oticaNaoAplicavel: z.boolean().default(false),
  // Holder: obrigatório a menos que NaoAplicavel=true
  holder: z.string().optional().default(""),
  qtdHolder: z.number().int().min(1).default(1),
  holderNaoAplicavel: z.boolean().default(false),
  // Dissipador: obrigatório a menos que NaoAplicavel=true
  dissipador: z.string().optional().default(""),
  qtdDissipador: z.number().int().min(1).default(1),
  dissipadorNaoAplicavel: z.boolean().default(false),
  semDriver: z.boolean().default(false),
  driverOnoff220: z.string().optional().default(""),
  qtdDriverOnoff220: z.number().int().min(1).default(1),
  driverOnoffBivolt: z.string().optional().default(""),
  qtdDriverOnoffBivolt: z.number().int().min(1).default(1),
  driverOnoffBivoltNaoAplicavel: z.boolean().default(false),
  driverDim110v: z.string().nullish(),
  qtdDriverDim110v: z.number().int().min(1).default(1),
  driverDim110vNaoAplicavel: z.boolean().default(false),
  driverDimDali: z.string().nullish(),
  qtdDriverDimDali: z.number().int().min(1).default(1),
  driverDimDaliNaoAplicavel: z.boolean().default(false),
  driverDimTriac110v: z.string().nullish(),
  qtdDriverDimTriac110v: z.number().int().min(1).default(1),
  driverDimTriac110vNaoAplicavel: z.boolean().default(false),
  driverDimTriac220v: z.string().nullish(),
  qtdDriverDimTriac220v: z.number().int().min(1).default(1),
  driverDimTriac220vNaoAplicavel: z.boolean().default(false),
  temperaturasCor: z.string().default('["2700","3000","4000","5000"]'),
  fotoUrl: z.string().nullish(),
  fotoKey: z.string().nullish(),
  custoLuminaria: z.string().nullish(),
  custoDriverOnoff220: z.string().nullish(),
  custoDriverOnoffBivolt: z.string().nullish(),
  custoDriverDim110v: z.string().nullish(),
  custoDriverDimDali: z.string().nullish(),
  custoDriverDimTriac110v: z.string().nullish(),
  custoDriverDimTriac220v: z.string().nullish(),
  // Drivers extras (JSON string de array [{modelo, qtd, custo}])
  driverOnoff220Extra: z.string().nullish(),
  driverOnoffBivoltExtra: z.string().nullish(),
  driverDim110vExtra: z.string().nullish(),
  driverDimDaliExtra: z.string().nullish(),
  driverDimTriac110vExtra: z.string().nullish(),
  driverDimTriac220vExtra: z.string().nullish(),
  // Óticas extras (JSON string de array [{modelo, qtd}])
  oticaExtra: z.string().nullish(),
  // Preço de venda por tipo de driver (null = não informado)
  precoVendaOnoff220: z.string().nullish(),
  precoVendaOnoffBivolt: z.string().nullish(),
  precoVendaDim110v: z.string().nullish(),
  precoVendaDimDali: z.string().nullish(),
  // Preço de venda D1/D1+D2 (perfis com dois planos de iluminação)
  precoVendaOnoff220D1:      z.string().nullish(),
  precoVendaOnoff220D1D2:    z.string().nullish(),
  precoVendaOnoffBivoltD1:   z.string().nullish(),
  precoVendaOnoffBivoltD1D2: z.string().nullish(),
  precoVendaDim110vD1:       z.string().nullish(),
  precoVendaDim110vD1D2:     z.string().nullish(),
  precoVendaDimDaliD1:       z.string().nullish(),
  precoVendaDimDaliD1D2:     z.string().nullish(),
  configuracaoPlanos:         z.enum(["D1", "D2", "D1+D2"]).nullish(),
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
  qtdModuloLed: z.number().min(0.01).default(1),
  // Módulo LED por CCT
  moduloLed2700: z.string().optional(),
  moduloLed3000: z.string().optional(),
  moduloLed4000: z.string().optional(),
  moduloLed5000: z.string().optional(),
  qtdModuloLed2700: z.number().min(0.01).optional(),
  qtdModuloLed3000: z.number().min(0.01).optional(),
  qtdModuloLed4000: z.number().min(0.01).optional(),
  qtdModuloLed5000: z.number().min(0.01).optional(),
  otica: z.string().default(""),
  qtdOtica: z.number().int().min(1).default(1),
  oticaNaoAplicavel: z.boolean().default(false),
  holder: z.string().default(""),
  qtdHolder: z.number().int().min(1).default(1),
  holderNaoAplicavel: z.boolean().default(false),
  dissipador: z.string().default(""),
  qtdDissipador: z.number().int().min(1).default(1),
  dissipadorNaoAplicavel: z.boolean().default(false),
  semDriver: z.boolean().default(false),
  driverOnoff220: z.string().default(""),
  qtdDriverOnoff220: z.number().int().min(1).default(1),
  driverOnoffBivolt: z.string().optional().default(""),
  qtdDriverOnoffBivolt: z.number().int().min(1).default(1),
  driverOnoffBivoltNaoAplicavel: z.boolean().default(false),
  driverDim110v: z.string().optional(),
  qtdDriverDim110v: z.number().int().min(1).default(1),
  driverDim110vNaoAplicavel: z.boolean().default(false),
  driverDimDali: z.string().optional(),
  qtdDriverDimDali: z.number().int().min(1).default(1),
  driverDimDaliNaoAplicavel: z.boolean().default(false),
  driverDimTriac110v: z.string().optional(),
  qtdDriverDimTriac110v: z.number().int().min(1).default(1),
  driverDimTriac110vNaoAplicavel: z.boolean().default(false),
  driverDimTriac220v: z.string().optional(),
  qtdDriverDimTriac220v: z.number().int().min(1).default(1),
  driverDimTriac220vNaoAplicavel: z.boolean().default(false),
  temperaturasCor: z.string().default('["2700","3000","4000","5000"]'),
  fotoUrl: z.string().optional(),
  fotoKey: z.string().optional(),
  custoLuminaria: z.string().optional(),
  custoDriverOnoff220: z.string().optional(),
  custoDriverOnoffBivolt: z.string().optional(),
  custoDriverDim110v: z.string().optional(),
  custoDriverDimDali: z.string().optional(),
  custoDriverDimTriac110v: z.string().optional(),
  custoDriverDimTriac220v: z.string().optional(),
  driverOnoff220Extra: z.string().optional(),
  driverOnoffBivoltExtra: z.string().optional(),
  driverDim110vExtra: z.string().optional(),
  driverDimDaliExtra: z.string().optional(),
  driverDimTriac110vExtra: z.string().optional(),
  driverDimTriac220vExtra: z.string().optional(),
  oticaExtra: z.string().optional(),
  // Preço de venda por tipo de driver
  precoVendaOnoff220: z.string().optional(),
  precoVendaOnoffBivolt: z.string().optional(),
  precoVendaDim110v: z.string().optional(),
  precoVendaDimDali: z.string().optional(),
  // Preço de venda D1/D1+D2
  precoVendaOnoff220D1:      z.string().optional(),
  precoVendaOnoff220D1D2:    z.string().optional(),
  precoVendaOnoffBivoltD1:   z.string().optional(),
  precoVendaOnoffBivoltD1D2: z.string().optional(),
  precoVendaDim110vD1:       z.string().optional(),
  precoVendaDim110vD1D2:     z.string().optional(),
  precoVendaDimDaliD1:       z.string().optional(),
  precoVendaDimDaliD1D2:     z.string().optional(),
  configuracaoPlanos:         z.enum(["D1", "D2", "D1+D2"]).optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  components: componentsRouter,
  bulkOps: bulkOpsRouter,
  revenda: revendaRouter,
  accessories: accessoriesRouter,
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
          qtdModuloLed: String(input.qtdModuloLed ?? 1),
          moduloLed2700: input.moduloLed2700?.toUpperCase() || null,
          moduloLed3000: input.moduloLed3000?.toUpperCase() || null,
          moduloLed4000: input.moduloLed4000?.toUpperCase() || null,
          moduloLed5000: input.moduloLed5000?.toUpperCase() || null,
          qtdModuloLed2700: input.qtdModuloLed2700 ? String(input.qtdModuloLed2700) : null,
          qtdModuloLed3000: input.qtdModuloLed3000 ? String(input.qtdModuloLed3000) : null,
          qtdModuloLed4000: input.qtdModuloLed4000 ? String(input.qtdModuloLed4000) : null,
          qtdModuloLed5000: input.qtdModuloLed5000 ? String(input.qtdModuloLed5000) : null,
          otica: input.oticaNaoAplicavel ? "NÃO APLICÁVEL" : input.otica.toUpperCase(),
          qtdOtica: input.qtdOtica ?? 1,
          holder: input.holderNaoAplicavel ? "NÃO APLICÁVEL" : input.holder.toUpperCase(),
          qtdHolder: input.qtdHolder ?? 1,
          dissipador: input.dissipadorNaoAplicavel ? "NÃO APLICÁVEL" : input.dissipador.toUpperCase(),
          qtdDissipador: input.qtdDissipador ?? 1,
          semDriver: input.semDriver ?? false,
          driverOnoff220: input.semDriver ? "" : input.driverOnoff220.toUpperCase(),
          qtdDriverOnoff220: input.qtdDriverOnoff220 ?? 1,
          driverOnoffBivolt: input.driverOnoffBivolt.toUpperCase(),
          qtdDriverOnoffBivolt: input.qtdDriverOnoffBivolt ?? 1,
          driverDim110v: input.driverDim110v?.toUpperCase() || null,
          driverDim110vNaoAplicavel: !input.driverDim110v || input.driverDim110vNaoAplicavel === true,
          qtdDriverDim110v: input.qtdDriverDim110v ?? 1,
          driverDimDali: input.driverDimDali?.toUpperCase() || null,
          driverDimDaliNaoAplicavel: !input.driverDimDali || input.driverDimDaliNaoAplicavel === true,
          qtdDriverDimDali: input.qtdDriverDimDali ?? 1,
          driverDimTriac110v: input.driverDimTriac110v?.toUpperCase() || null,
          driverDimTriac110vNaoAplicavel: !input.driverDimTriac110v || input.driverDimTriac110vNaoAplicavel === true,
          qtdDriverDimTriac110v: input.qtdDriverDimTriac110v ?? 1,
          driverDimTriac220v: input.driverDimTriac220v?.toUpperCase() || null,
          driverDimTriac220vNaoAplicavel: !input.driverDimTriac220v || input.driverDimTriac220vNaoAplicavel === true,
          qtdDriverDimTriac220v: input.qtdDriverDimTriac220v ?? 1,
          temperaturasCor: input.temperaturasCor || '["2700","3000","4000","5000"]',
          custoLuminaria: input.custoLuminaria || null,
          custoDriverOnoff220: input.custoDriverOnoff220 || null,
          custoDriverOnoffBivolt: input.custoDriverOnoffBivolt || null,
          custoDriverDim110v: input.custoDriverDim110v || null,
          custoDriverDimDali: input.custoDriverDimDali || null,
          custoDriverDimTriac110v: input.custoDriverDimTriac110v || null,
          custoDriverDimTriac220v: input.custoDriverDimTriac220v || null,
          driverOnoff220Extra: input.driverOnoff220Extra || null,
          driverOnoffBivoltExtra: input.driverOnoffBivoltExtra || null,
          driverDim110vExtra: input.driverDim110vExtra || null,
          driverDimDaliExtra: input.driverDimDaliExtra || null,
          driverDimTriac110vExtra: input.driverDimTriac110vExtra || null,
          driverDimTriac220vExtra: input.driverDimTriac220vExtra || null,
          oticaExtra: input.oticaExtra || null,
          fotoUrl: input.fotoUrl || null,
          fotoKey: input.fotoKey || null,
          precoVendaOnoff220: input.precoVendaOnoff220 || null,
          precoVendaOnoffBivolt: input.precoVendaOnoffBivolt || null,
          precoVendaDim110v: input.precoVendaDim110v || null,
          precoVendaDimDali: input.precoVendaDimDali || null,
          precoVendaOnoff220D1:      input.precoVendaOnoff220D1      || null,
          precoVendaOnoff220D1D2:    input.precoVendaOnoff220D1D2    || null,
          precoVendaOnoffBivoltD1:   input.precoVendaOnoffBivoltD1   || null,
          precoVendaOnoffBivoltD1D2: input.precoVendaOnoffBivoltD1D2 || null,
          precoVendaDim110vD1:       input.precoVendaDim110vD1       || null,
          precoVendaDim110vD1D2:     input.precoVendaDim110vD1D2     || null,
          precoVendaDimDaliD1:       input.precoVendaDimDaliD1       || null,
          precoVendaDimDaliD1D2:     input.precoVendaDimDaliD1D2     || null,
          configuracaoPlanos:         input.configuracaoPlanos          ?? null,
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
        if (d.qtdModuloLed !== undefined) update.qtdModuloLed = String(d.qtdModuloLed);
        if (d.moduloLed2700 !== undefined) update.moduloLed2700 = d.moduloLed2700?.toUpperCase() || null;
        if (d.moduloLed3000 !== undefined) update.moduloLed3000 = d.moduloLed3000?.toUpperCase() || null;
        if (d.moduloLed4000 !== undefined) update.moduloLed4000 = d.moduloLed4000?.toUpperCase() || null;
        if (d.moduloLed5000 !== undefined) update.moduloLed5000 = d.moduloLed5000?.toUpperCase() || null;
        if (d.qtdModuloLed2700 !== undefined) update.qtdModuloLed2700 = d.qtdModuloLed2700 ? String(d.qtdModuloLed2700) : null;
        if (d.qtdModuloLed3000 !== undefined) update.qtdModuloLed3000 = d.qtdModuloLed3000 ? String(d.qtdModuloLed3000) : null;
        if (d.qtdModuloLed4000 !== undefined) update.qtdModuloLed4000 = d.qtdModuloLed4000 ? String(d.qtdModuloLed4000) : null;
        if (d.qtdModuloLed5000 !== undefined) update.qtdModuloLed5000 = d.qtdModuloLed5000 ? String(d.qtdModuloLed5000) : null;
        if (d.otica !== undefined) update.otica = d.oticaNaoAplicavel ? "NÃO APLICÁVEL" : d.otica.toUpperCase();
        if (d.qtdOtica !== undefined) update.qtdOtica = d.qtdOtica;
        if (d.oticaNaoAplicavel !== undefined) update.oticaNaoAplicavel = d.oticaNaoAplicavel;
        if (d.holder !== undefined) update.holder = d.holderNaoAplicavel ? "NÃO APLICÁVEL" : d.holder.toUpperCase();
        if (d.qtdHolder !== undefined) update.qtdHolder = d.qtdHolder;
        if (d.holderNaoAplicavel !== undefined) update.holderNaoAplicavel = d.holderNaoAplicavel;
        if (d.dissipador !== undefined) update.dissipador = d.dissipadorNaoAplicavel ? "NÃO APLICÁVEL" : d.dissipador.toUpperCase();
        if (d.qtdDissipador !== undefined) update.qtdDissipador = d.qtdDissipador;
        if (d.dissipadorNaoAplicavel !== undefined) update.dissipadorNaoAplicavel = d.dissipadorNaoAplicavel;
        if (d.semDriver !== undefined) update.semDriver = d.semDriver;
        if (d.driverOnoff220 !== undefined) update.driverOnoff220 = d.driverOnoff220.toUpperCase();
        if (d.qtdDriverOnoff220 !== undefined) update.qtdDriverOnoff220 = d.qtdDriverOnoff220;
        if (d.driverOnoffBivolt !== undefined) update.driverOnoffBivolt = d.driverOnoffBivolt.toUpperCase();
        if (d.qtdDriverOnoffBivolt !== undefined) update.qtdDriverOnoffBivolt = d.qtdDriverOnoffBivolt;
        if (d.driverOnoffBivoltNaoAplicavel !== undefined) update.driverOnoffBivoltNaoAplicavel = d.driverOnoffBivoltNaoAplicavel;
        // DIM 1-10V: ao atualizar o campo, sincroniza a flag NaoAplicavel automaticamente
        if (d.driverDim110v !== undefined) {
          update.driverDim110v = d.driverDim110v?.toUpperCase() || null;
          // Se o campo foi enviado, a flag é derivada do valor: vazio = NaoAplicavel
          update.driverDim110vNaoAplicavel = !d.driverDim110v || d.driverDim110vNaoAplicavel === true;
        } else if (d.driverDim110vNaoAplicavel !== undefined) {
          update.driverDim110vNaoAplicavel = d.driverDim110vNaoAplicavel;
        }
        if (d.qtdDriverDim110v !== undefined) update.qtdDriverDim110v = d.qtdDriverDim110v;
        // DIM DALI: idem
        if (d.driverDimDali !== undefined) {
          update.driverDimDali = d.driverDimDali?.toUpperCase() || null;
          update.driverDimDaliNaoAplicavel = !d.driverDimDali || d.driverDimDaliNaoAplicavel === true;
        } else if (d.driverDimDaliNaoAplicavel !== undefined) {
          update.driverDimDaliNaoAplicavel = d.driverDimDaliNaoAplicavel;
        }
        if (d.qtdDriverDimDali !== undefined) update.qtdDriverDimDali = d.qtdDriverDimDali;
        // DIM TRIAC 110V
        if (d.driverDimTriac110v !== undefined) {
          update.driverDimTriac110v = d.driverDimTriac110v?.toUpperCase() || null;
          update.driverDimTriac110vNaoAplicavel = !d.driverDimTriac110v || d.driverDimTriac110vNaoAplicavel === true;
        } else if (d.driverDimTriac110vNaoAplicavel !== undefined) {
          update.driverDimTriac110vNaoAplicavel = d.driverDimTriac110vNaoAplicavel;
        }
        if (d.qtdDriverDimTriac110v !== undefined) update.qtdDriverDimTriac110v = d.qtdDriverDimTriac110v;
        // DIM TRIAC 220V
        if (d.driverDimTriac220v !== undefined) {
          update.driverDimTriac220v = d.driverDimTriac220v?.toUpperCase() || null;
          update.driverDimTriac220vNaoAplicavel = !d.driverDimTriac220v || d.driverDimTriac220vNaoAplicavel === true;
        } else if (d.driverDimTriac220vNaoAplicavel !== undefined) {
          update.driverDimTriac220vNaoAplicavel = d.driverDimTriac220vNaoAplicavel;
        }
        if (d.qtdDriverDimTriac220v !== undefined) update.qtdDriverDimTriac220v = d.qtdDriverDimTriac220v;
        if (d.temperaturasCor !== undefined) update.temperaturasCor = d.temperaturasCor;
        if (d.fotoUrl !== undefined) update.fotoUrl = d.fotoUrl || null;
        if (d.fotoKey !== undefined) update.fotoKey = d.fotoKey || null;
        if (d.custoLuminaria !== undefined) update.custoLuminaria = d.custoLuminaria || null;
        if (d.custoDriverOnoff220 !== undefined) update.custoDriverOnoff220 = d.custoDriverOnoff220 || null;
        if (d.custoDriverOnoffBivolt !== undefined) update.custoDriverOnoffBivolt = d.custoDriverOnoffBivolt || null;
        if (d.custoDriverDim110v !== undefined) update.custoDriverDim110v = d.custoDriverDim110v || null;
        if (d.custoDriverDimDali !== undefined) update.custoDriverDimDali = d.custoDriverDimDali || null;
        if (d.custoDriverDimTriac110v !== undefined) update.custoDriverDimTriac110v = d.custoDriverDimTriac110v || null;
        if (d.custoDriverDimTriac220v !== undefined) update.custoDriverDimTriac220v = d.custoDriverDimTriac220v || null;
        if (d.driverOnoff220Extra !== undefined) update.driverOnoff220Extra = d.driverOnoff220Extra || null;
        if (d.driverOnoffBivoltExtra !== undefined) update.driverOnoffBivoltExtra = d.driverOnoffBivoltExtra || null;
        if (d.driverDim110vExtra !== undefined) update.driverDim110vExtra = d.driverDim110vExtra || null;
        if (d.driverDimDaliExtra !== undefined) update.driverDimDaliExtra = d.driverDimDaliExtra || null;
        if (d.driverDimTriac110vExtra !== undefined) update.driverDimTriac110vExtra = d.driverDimTriac110vExtra || null;
        if (d.driverDimTriac220vExtra !== undefined) update.driverDimTriac220vExtra = d.driverDimTriac220vExtra || null;
        if (d.oticaExtra !== undefined) update.oticaExtra = d.oticaExtra || null;
        if (d.precoVendaOnoff220 !== undefined) update.precoVendaOnoff220 = d.precoVendaOnoff220 || null;
        if (d.precoVendaOnoffBivolt !== undefined) update.precoVendaOnoffBivolt = d.precoVendaOnoffBivolt || null;
        if (d.precoVendaDim110v !== undefined) update.precoVendaDim110v = d.precoVendaDim110v || null;
        if (d.precoVendaDimDali !== undefined) update.precoVendaDimDali = d.precoVendaDimDali || null;
        if (d.precoVendaOnoff220D1 !== undefined)      update.precoVendaOnoff220D1      = d.precoVendaOnoff220D1      || null;
        if (d.precoVendaOnoff220D1D2 !== undefined)    update.precoVendaOnoff220D1D2    = d.precoVendaOnoff220D1D2    || null;
        if (d.precoVendaOnoffBivoltD1 !== undefined)   update.precoVendaOnoffBivoltD1   = d.precoVendaOnoffBivoltD1   || null;
        if (d.precoVendaOnoffBivoltD1D2 !== undefined) update.precoVendaOnoffBivoltD1D2 = d.precoVendaOnoffBivoltD1D2 || null;
        if (d.precoVendaDim110vD1 !== undefined)       update.precoVendaDim110vD1       = d.precoVendaDim110vD1       || null;
        if (d.precoVendaDim110vD1D2 !== undefined)     update.precoVendaDim110vD1D2     = d.precoVendaDim110vD1D2     || null;
        if (d.precoVendaDimDaliD1 !== undefined)       update.precoVendaDimDaliD1       = d.precoVendaDimDaliD1       || null;
        if (d.precoVendaDimDaliD1D2 !== undefined)     update.precoVendaDimDaliD1D2     = d.precoVendaDimDaliD1D2     || null;
        if (d.configuracaoPlanos !== undefined)          update.configuracaoPlanos        = d.configuracaoPlanos         ?? null;

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
