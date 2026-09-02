import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, entityAdminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { usersRouter } from "./routers/users";
import { sdk } from "./_core/sdk";
import { DUMMY_PASSWORD_HASH, hashPassword, hashPasswordResetToken, validatePasswordStrength, verifyPassword } from "./passwords";
import { getLocalUserByEmail, getUserByValidPasswordResetTokenHash, updateUsersByEmail } from "./db";
import { can, isAllowedUserEmail, normalizeEmail, type AppRole } from "../shared/permissions";
import { componentsRouter } from "./routers/components";
import { bulkOpsRouter } from "./routers/bulkOps";
import { revendaRouter } from "./routers/revenda";
import { accessoriesRouter } from "./routers/accessories";
import { documentsBulkRouter } from "./routers/documentsBulk";
import { reportsRouter } from "./routers/reports";
import { getReportFilterOptions } from "./reporting";
import {
  bulkInsertProducts,
  countProducts,
  createProduct,
  deleteProduct,
  enrichManyWithModuloLedEq,
  getDb,
  getFieldSuggestions,
  getProductById,
  listProducts,
  updateProduct,
} from "./db";
import { runBackup } from "./backupHandler";
import { backups } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { products as productsTable } from "../drizzle/schema";
import { storageGetSignedUrl, storageGet } from "./storage";
import { normalizeOtherEquipmentReferences } from "./productLighting";

// ─── Validation schema ────────────────────────────────────────────────────────

function parseModuloLedExtra(raw: string | null | undefined): Array<{ cct: string; modelo: string; qtd: number }> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

type ProductDocument = { url: string; key: string; nome: string; mimeType: string };
type ProductDocuments = Partial<Record<"datasheet" | "fotometria" | "desenhoTecnico" | "manualInstalacao", ProductDocument>>;

function parseProductDocuments(raw: string | null | undefined): ProductDocuments | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const result: ProductDocuments = {};
    for (const tipo of ["datasheet", "fotometria", "desenhoTecnico", "manualInstalacao"] as const) {
      const value = parsed[tipo];
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const document = value as Record<string, unknown>;
      const url = String(document.url ?? "").trim();
      const key = String(document.key ?? "").trim();
      const nome = String(document.nome ?? "").trim();
      const mimeType = String(document.mimeType ?? "application/octet-stream").trim();
      if (url && key && nome) result[tipo] = { url, key, nome, mimeType };
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

export function extractProductDocumentKey(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = raw.trim();
  const localMatch = value.match(/^\/manus-storage\/(.+)$/);
  if (localMatch) return localMatch[1];
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");

  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    const markerIndex = pathname.indexOf("/products/documents/");
    return markerIndex >= 0 ? pathname.slice(markerIndex + 1) : null;
  } catch {
    return null;
  }
}

function resolveProductDocumentKey(document: ProductDocument): string | null {
  // A URL local contém a chave final com hash para arquivos antigos cujo campo
  // key foi gravado antes de o storage acrescentar o sufixo único.
  return extractProductDocumentKey(document.url) || extractProductDocumentKey(document.key);
}

export async function resolveProductDocumentViewUrls<T extends Record<string, unknown>>(
  product: T,
): Promise<T & { documentosVisualizacao: ProductDocuments | null }> {
  const storedDocuments = parseProductDocuments(
    typeof product.documentos === "string" ? product.documentos : null,
  );
  if (!storedDocuments) return { ...product, documentosVisualizacao: null };

  const resolvedEntries = await Promise.all(
    Object.entries(storedDocuments).map(async ([type, document]) => {
      const key = resolveProductDocumentKey(document);
      if (!key) return [type, document] as const;
      try {
        return [type, { ...document, url: await storageGetSignedUrl(key) }] as const;
      } catch {
        // Mantém a referência existente como contingência para uma falha
        // temporária de assinatura; o proxy privado continua disponível.
        return [type, document] as const;
      }
    }),
  );

  return {
    ...product,
    documentosVisualizacao: Object.fromEntries(resolvedEntries) as ProductDocuments,
  };
}

export function extractProductPhotoKey(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = raw.trim();
  const localMatch = value.match(/^\/manus-storage\/(.+)$/);
  if (localMatch) return localMatch[1];
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");

  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    const markerIndex = pathname.indexOf("/products/photos/");
    return markerIndex >= 0 ? pathname.slice(markerIndex + 1) : null;
  } catch {
    return null;
  }
}

async function resolveProductPhotoUrl<T extends Record<string, unknown>>(product: T): Promise<T & { fotoPublicUrl: string | null }> {
  const storedUrl = typeof product.fotoUrl === "string" ? product.fotoUrl : null;
  const storedKey = typeof product.fotoKey === "string" ? product.fotoKey : null;
  const key = extractProductPhotoKey(storedUrl) || extractProductPhotoKey(storedKey);
  if (!key) return { ...product, fotoPublicUrl: storedUrl };

  try {
    return { ...product, fotoPublicUrl: await storageGetSignedUrl(key) };
  } catch {
    // O proxy local continua sendo um fallback para não ocultar a foto se o
    // serviço de assinatura estiver momentaneamente indisponível.
    return { ...product, fotoPublicUrl: storedUrl };
  }
}

async function resolveProductAssetUrls<T extends Record<string, unknown>>(product: T) {
  return resolveProductDocumentViewUrls(await resolveProductPhotoUrl(product));
}

const isFinancialProductField = (field: string) => /^(custo|precoVenda|mkp)/.test(field);

function redactProductFinancials<T extends Record<string, unknown>>(product: T, role: AppRole | null | undefined, permissionOverrides?: unknown): T {
  if (can(role, "viewCosts", permissionOverrides) || can(role, "editCosts", permissionOverrides)) return product;
  const sanitized = { ...product };
  for (const key of Object.keys(sanitized)) {
    if (isFinancialProductField(key)) sanitized[key as keyof T] = null as T[keyof T];
  }
  return sanitized;
}

function assertProductUpdatePermission(role: AppRole | null | undefined, permissionOverrides: unknown, data: Record<string, unknown>) {
  const fields = Object.keys(data).filter((field) => data[field] !== undefined);
  if (can(role, "manageEntities", permissionOverrides)) return;
  if (can(role, "manageDocuments", permissionOverrides) && fields.length > 0 && fields.every((field) => field === "documentos")) return;
  if (can(role, "editCosts", permissionOverrides) && fields.length > 0 && fields.every(isFinancialProductField)) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não pode alterar estes campos do produto." });
}

const productSchema = z.object({
  categoria: z.string().optional(),
  instalacao: z.string().min(1, "INSTALAÇÃO é obrigatório"),
  familia: z.string().min(1, "FAMÍLIA é obrigatório"),
  sku: z.string().optional().default(""),
  produto: z.string().min(1, "PRODUTO é obrigatório"),
  moduloLed: z.string().optional().default(""),
  qtdModuloLed: z.number().min(0.01).default(1),
  moduloRgbw: z.number().int().min(0).max(1).default(0),
  moduloLampada: z.number().int().min(0).max(1).default(0),
  moduloLedRgbw: z.string().nullish(),
  qtdModuloLedRgbw: z.number().min(0.01).nullish(),
  moduloTunableWhite: z.boolean().default(false),
  moduloLedTunableWhite: z.string().nullish(),
  qtdModuloLedTunableWhite: z.number().min(0.01).nullish(),
  semModuloLed: z.boolean().default(false),
  lampadaAcessorioId: z.number().int().positive().nullish(),
  outrosEquipamentos: z.string().nullish(),
  // Módulo LED por CCT
  moduloLed2700: z.string().nullish(),
  moduloLed3000: z.string().nullish(),
  moduloLed3500: z.string().nullish(),
  moduloLed4000: z.string().nullish(),
  moduloLed5000: z.string().nullish(),
  qtdModuloLed2700: z.number().min(0.01).nullish(),
  qtdModuloLed3000: z.number().min(0.01).nullish(),
  qtdModuloLed3500: z.number().min(0.01).nullish(),
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
  driverOnoff220NaoAplicavel: z.boolean().default(false),
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
  temperaturasCor: z.string().default('["2700","3000","3500","4000","5000"]'),
  fotoUrl: z.string().nullish(),
  fotoKey: z.string().nullish(),
  documentos: z.string().nullish(),
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
  // CCTs extras de módulo LED (JSON string de array [{cct, modelo, qtd}])
  moduloLedExtra: z.string().nullish(),
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
  possuiOpcaoD1D2: z.boolean().default(false),
  // Custo do corpo por tipo de driver (sem driver) + markups
  custoCorpoOnoff220v: z.string().nullish(),
  mkpPadraoOnoff220v: z.string().nullish(),
  mkpMinimoOnoff220v: z.string().nullish(),
  custoCorpoOnoffBivolt: z.string().nullish(),
  mkpPadraoOnoffBivolt: z.string().nullish(),
  mkpMinimoOnoffBivolt: z.string().nullish(),
  custoCorpoDim110v: z.string().nullish(),
  mkpPadraoDim110v: z.string().nullish(),
  mkpMinimoDim110v: z.string().nullish(),
  custoCorpoDimDali: z.string().nullish(),
  mkpPadraoDimDali: z.string().nullish(),
  mkpMinimoDimDali: z.string().nullish(),
  custoCorpoDimTriac110v: z.string().nullish(),
  mkpPadraoDimTriac110v: z.string().nullish(),
  mkpMinimoDimTriac110v: z.string().nullish(),
  custoCorpoDimTriac220v: z.string().nullish(),
  mkpPadraoDimTriac220v: z.string().nullish(),
  mkpMinimoDimTriac220v: z.string().nullish(),
  // Markup do driver por tipo (buscado do componente ao salvar — não exibido no formulário)
  mkpPadraoDriverOnoff220v:    z.string().nullish(),
  mkpPadraoDriverOnoffBivolt:  z.string().nullish(),
  mkpPadraoDriverDim110v:      z.string().nullish(),
  mkpPadraoDriverDimDali:      z.string().nullish(),
  mkpPadraoDriverDimTriac110v: z.string().nullish(),
  mkpPadraoDriverDimTriac220v: z.string().nullish(),
  // Markup mínimo do driver — valor global fixo (padrão 3.0)
  mkpMinimoDriver: z.string().nullish(),
  // Custo D1+D2 (apenas para PERFIS com iluminação direta + indireta)
  custoCorpoOnoff220vD1D2: z.string().nullish(),
  custoCorpoOnoffBivoltD1D2: z.string().nullish(),
  custoCorpoDim110vD1D2: z.string().nullish(),
  custoCorpoDimDaliD1D2: z.string().nullish(),
  custoCorpoDimTriac110vD1D2: z.string().nullish(),
  custoCorpoDimTriac220vD1D2: z.string().nullish(),
  correnteDriver: z.string().nullish(),
  composicaoD1D2: z.string().nullish(),
}).superRefine((data, ctx) => {
  const modosEspeciais = [
    Boolean(data.moduloRgbw),
    Boolean(data.moduloLampada),
    Boolean(data.moduloTunableWhite),
    Boolean(data.semModuloLed),
  ].filter(Boolean).length;
  if (modosEspeciais > 1) {
    ctx.addIssue({
      code: "custom",
      path: ["moduloRgbw"],
      message: "Selecione somente uma modalidade de iluminação por produto",
    });
  }
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
  // ON/OFF BIVOLT: opcional — não é obrigatório
});

const productUpdateSchema = productSchema.partial();
type ProductUpdateData = z.infer<typeof productUpdateSchema>;

const bulkProductSchema = z.object({
  categoria: z.string().optional().default(""),
  instalacao: z.string().default(""),
  familia: z.string().default(""),
  sku: z.string().default(""),
  produto: z.string().default(""),
  moduloLed: z.string().default(""),
  qtdModuloLed: z.number().min(0.01).default(1),
  moduloRgbw: z.number().int().min(0).max(1).default(0),
  moduloLampada: z.number().int().min(0).max(1).default(0),
  moduloLedRgbw: z.string().optional(),
  qtdModuloLedRgbw: z.number().min(0.01).optional(),
  moduloTunableWhite: z.boolean().default(false),
  moduloLedTunableWhite: z.string().optional(),
  qtdModuloLedTunableWhite: z.number().min(0.01).optional(),
  semModuloLed: z.boolean().default(false),
  lampadaAcessorioId: z.number().int().positive().optional(),
  outrosEquipamentos: z.string().optional(),
  // Módulo LED por CCT
  moduloLed2700: z.string().optional(),
  moduloLed3000: z.string().optional(),
  moduloLed3500: z.string().optional(),
  moduloLed4000: z.string().optional(),
  moduloLed5000: z.string().optional(),
  qtdModuloLed2700: z.number().min(0.01).optional(),
  qtdModuloLed3000: z.number().min(0.01).optional(),
  qtdModuloLed3500: z.number().min(0.01).optional(),
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
  driverOnoff220NaoAplicavel: z.boolean().default(false),
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
  temperaturasCor: z.string().default('["2700","3000","3500","4000","5000"]'),
  fotoUrl: z.string().nullable().optional(),
  fotoKey: z.string().nullable().optional(),
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
  composicaoD1D2: z.string().nullable().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  components: componentsRouter,
  bulkOps: bulkOpsRouter,
  documentosEmMassa: documentsBulkRouter,
  reports: reportsRouter,
  revenda: revendaRouter,
  accessories: accessoriesRouter,
  users: usersRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      if (!opts.ctx.user) return null;
      const {
        passwordHash: _passwordHash,
        failedLoginAttempts: _failedLoginAttempts,
        lockedUntil: _lockedUntil,
        passwordResetTokenHash: _passwordResetTokenHash,
        passwordResetExpiresAt: _passwordResetExpiresAt,
        ...safeUser
      } = opts.ctx.user;
      return safeUser;
    }),
    passwordResetStatus: publicProcedure
      .input(z.object({ token: z.string().min(20).max(200) }))
      .query(async ({ input }) => {
        const user = await getUserByValidPasswordResetTokenHash(hashPasswordResetToken(input.token));
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Link de redefinição inválido ou expirado." });
        }
        return { valid: true } as const;
      }),
    resetPassword: publicProcedure
      .input(z.object({ token: z.string().min(20).max(200), password: z.string() }))
      .mutation(async ({ input }) => {
        const user = await getUserByValidPasswordResetTokenHash(hashPasswordResetToken(input.token));
        if (!user?.email) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Link de redefinição inválido ou expirado." });
        }
        const passwordError = validatePasswordStrength(input.password);
        if (passwordError) throw new TRPCError({ code: "BAD_REQUEST", message: passwordError });

        await updateUsersByEmail(user.email, {
          passwordHash: hashPassword(input.password),
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        });
        return { success: true } as const;
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1).max(128) }))
      .mutation(async ({ input, ctx }) => {
        const email = normalizeEmail(input.email);
        const deny = async () => {
          await verifyPassword(input.password, DUMMY_PASSWORD_HASH);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        };
        if (!isAllowedUserEmail(email)) return deny();
        const user = await getLocalUserByEmail(email);
        if (!user?.passwordHash || !user.active) return deny();

        const now = new Date();
        if (user.lockedUntil && user.lockedUntil > now) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde 15 minutos." });
        }
        if (!verifyPassword(input.password, user.passwordHash)) {
          const attempts = (user.failedLoginAttempts ?? 0) + 1;
          await updateUsersByEmail(email, {
            failedLoginAttempts: attempts >= 5 ? 0 : attempts,
            lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
          });
          return deny();
        }

        await updateUsersByEmail(email, { failedLoginAttempts: 0, lockedUntil: null, lastSignedIn: now });
        const sessionDuration = 12 * 60 * 60 * 1000;
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || email,
          expiresInMs: sessionDuration,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: sessionDuration });
        const {
          passwordHash: _passwordHash,
          failedLoginAttempts: _failedLoginAttempts,
          lockedUntil: _lockedUntil,
          passwordResetTokenHash: _passwordResetTokenHash,
          passwordResetExpiresAt: _passwordResetExpiresAt,
          ...safeUser
        } = user;
        return { success: true, user: safeUser } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  products: router({
    filterOptions: protectedProcedure
      .input(z.object({
        categoria: z.string().optional(),
        instalacao: z.string().optional(),
        familia: z.string().optional(),
        potencia: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { items } = await listProducts({ limit: 5000, offset: 0 });
        return getReportFilterOptions(items, input ?? {});
      }),

    list: protectedProcedure
      .input(
        z.object({
          search: z.string().optional(),
          categoria: z.string().optional(),
          instalacao: z.string().optional(),
          familia: z.string().optional(),
          potencia: z.string().optional(),
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0),
          apenasInativos: z.boolean().optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        const result = await listProducts(input);
        return {
          ...result,
          items: (await Promise.all(result.items.map(resolveProductAssetUrls)))
            .map((item) => redactProductFinancials(item, ctx.user.role, ctx.user.permissionOverrides)),
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const product = await getProductById(input.id);
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
        return redactProductFinancials(
          await resolveProductAssetUrls(product),
          ctx.user.role,
          ctx.user.permissionOverrides,
        );
      }),

    create: entityAdminProcedure
      .input(productSchema)
      .mutation(async ({ input }) => {
        const usesStandardCct = !input.moduloRgbw && !input.moduloLampada && !input.moduloTunableWhite && !input.semModuloLed;
        const data = {
          ...input,
          familia: input.familia.toUpperCase(),
          sku: input.sku.toUpperCase(),
          produto: input.produto.toUpperCase(),
          moduloLed: usesStandardCct ? input.moduloLed.toUpperCase() : "",
          qtdModuloLed: String(input.qtdModuloLed ?? 1),
          moduloRgbw: input.moduloRgbw ?? 0,
          moduloLampada: input.moduloLampada ?? 0,
          moduloLedRgbw: input.moduloRgbw ? input.moduloLedRgbw?.toUpperCase() || null : null,
          qtdModuloLedRgbw: input.moduloRgbw && input.moduloLedRgbw ? String(input.qtdModuloLedRgbw ?? 1) : null,
          moduloTunableWhite: input.moduloTunableWhite ?? false,
          moduloLedTunableWhite: input.moduloTunableWhite ? input.moduloLedTunableWhite?.toUpperCase() || null : null,
          qtdModuloLedTunableWhite: input.moduloTunableWhite && input.moduloLedTunableWhite
            ? String(input.qtdModuloLedTunableWhite ?? 1)
            : null,
          semModuloLed: input.semModuloLed ?? false,
          lampadaAcessorioId: input.moduloLampada ? input.lampadaAcessorioId ?? null : null,
          outrosEquipamentos: normalizeOtherEquipmentReferences(input.outrosEquipamentos),
          moduloLed2700: usesStandardCct ? input.moduloLed2700?.toUpperCase() || null : null,
          moduloLed3000: usesStandardCct ? input.moduloLed3000?.toUpperCase() || null : null,
          moduloLed3500: usesStandardCct ? input.moduloLed3500?.toUpperCase() || null : null,
          moduloLed4000: usesStandardCct ? input.moduloLed4000?.toUpperCase() || null : null,
          moduloLed5000: usesStandardCct ? input.moduloLed5000?.toUpperCase() || null : null,
          qtdModuloLed2700: usesStandardCct && input.moduloLed2700 ? String(input.qtdModuloLed2700 ?? 1) : null,
          qtdModuloLed3000: usesStandardCct && input.moduloLed3000 ? String(input.qtdModuloLed3000 ?? 1) : null,
          qtdModuloLed3500: usesStandardCct && input.moduloLed3500 ? String(input.qtdModuloLed3500 ?? 1) : null,
          qtdModuloLed4000: usesStandardCct && input.moduloLed4000 ? String(input.qtdModuloLed4000 ?? 1) : null,
          qtdModuloLed5000: usesStandardCct && input.moduloLed5000 ? String(input.qtdModuloLed5000 ?? 1) : null,
          moduloLedExtra: usesStandardCct ? parseModuloLedExtra(input.moduloLedExtra) : null,
          otica: input.oticaNaoAplicavel ? "NÃO APLICÁVEL" : input.otica.toUpperCase(),
          qtdOtica: input.qtdOtica ?? 1,
          holder: input.holderNaoAplicavel ? "NÃO APLICÁVEL" : input.holder.toUpperCase(),
          qtdHolder: input.qtdHolder ?? 1,
          dissipador: input.dissipadorNaoAplicavel ? "NÃO APLICÁVEL" : input.dissipador.toUpperCase(),
          qtdDissipador: input.qtdDissipador ?? 1,
          semDriver: input.semDriver ?? false,
          driverOnoff220: (input.semDriver || input.driverOnoff220NaoAplicavel) ? "NÃO APLICÁVEL" : input.driverOnoff220.toUpperCase(),
          qtdDriverOnoff220: input.qtdDriverOnoff220 ?? 1,
          driverOnoff220NaoAplicavel: input.driverOnoff220NaoAplicavel ?? false,
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
          temperaturasCor: input.moduloRgbw
            ? '["RGBW"]'
            : usesStandardCct
              ? input.temperaturasCor || '["2700","3000","3500","4000","5000"]'
              : '[]',
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
          composicaoD1D2: input.composicaoD1D2 || null,
          fotoUrl: input.fotoUrl || null,
          fotoKey: input.fotoKey || null,
          documentos: parseProductDocuments(input.documentos),
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
          possuiOpcaoD1D2: input.possuiOpcaoD1D2 ?? false,
          custoCorpoOnoff220v: input.custoCorpoOnoff220v || null,
          mkpPadraoOnoff220v: input.mkpPadraoOnoff220v || null,
          mkpMinimoOnoff220v: input.mkpMinimoOnoff220v || null,
          custoCorpoOnoffBivolt: input.custoCorpoOnoffBivolt || null,
          mkpPadraoOnoffBivolt: input.mkpPadraoOnoffBivolt || null,
          mkpMinimoOnoffBivolt: input.mkpMinimoOnoffBivolt || null,
          custoCorpoDim110v: input.custoCorpoDim110v || null,
          mkpPadraoDim110v: input.mkpPadraoDim110v || null,
          mkpMinimoDim110v: input.mkpMinimoDim110v || null,
          custoCorpoDimDali: input.custoCorpoDimDali || null,
          mkpPadraoDimDali: input.mkpPadraoDimDali || null,
          mkpMinimoDimDali: input.mkpMinimoDimDali || null,
          custoCorpoDimTriac110v: input.custoCorpoDimTriac110v || null,
          mkpPadraoDimTriac110v: input.mkpPadraoDimTriac110v || null,
          mkpMinimoDimTriac110v: input.mkpMinimoDimTriac110v || null,
          custoCorpoDimTriac220v: input.custoCorpoDimTriac220v || null,
          mkpPadraoDimTriac220v: input.mkpPadraoDimTriac220v || null,
          mkpMinimoDimTriac220v: input.mkpMinimoDimTriac220v || null,
          mkpPadraoDriverOnoff220v:    input.mkpPadraoDriverOnoff220v    || null,
          mkpPadraoDriverOnoffBivolt:  input.mkpPadraoDriverOnoffBivolt  || null,
          mkpPadraoDriverDim110v:      input.mkpPadraoDriverDim110v      || null,
          mkpPadraoDriverDimDali:      input.mkpPadraoDriverDimDali      || null,
          mkpPadraoDriverDimTriac110v: input.mkpPadraoDriverDimTriac110v || null,
          mkpPadraoDriverDimTriac220v: input.mkpPadraoDriverDimTriac220v || null,
          mkpMinimoDriver: input.mkpMinimoDriver || "3",
          custoCorpoOnoff220vD1D2: input.custoCorpoOnoff220vD1D2 || null,
          custoCorpoOnoffBivoltD1D2: input.custoCorpoOnoffBivoltD1D2 || null,
          custoCorpoDim110vD1D2: input.custoCorpoDim110vD1D2 || null,
          custoCorpoDimDaliD1D2: input.custoCorpoDimDaliD1D2 || null,
          custoCorpoDimTriac110vD1D2: input.custoCorpoDimTriac110vD1D2 || null,
          custoCorpoDimTriac220vD1D2: input.custoCorpoDimTriac220vD1D2 || null,
          correnteDriver: input.correnteDriver || null,
        };
        await createProduct(data);
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getProductById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });

        const parsedData = productUpdateSchema.parse(input.data);
        const d = Object.fromEntries(
          Object.keys(input.data)
            .filter((field) => Object.prototype.hasOwnProperty.call(parsedData, field))
            .map((field) => [field, parsedData[field as keyof ProductUpdateData]]),
        ) as ProductUpdateData;
        assertProductUpdatePermission(ctx.user.role, ctx.user.permissionOverrides, d as Record<string, unknown>);
        const canEditCosts = can(ctx.user.role, "editCosts", ctx.user.permissionOverrides);

        const effectiveLighting = { ...existing, ...d } as Record<string, unknown>;
        const activeLightingModes = [
          Boolean(effectiveLighting.moduloRgbw),
          Boolean(effectiveLighting.moduloLampada),
          Boolean(effectiveLighting.moduloTunableWhite),
          Boolean(effectiveLighting.semModuloLed),
        ].filter(Boolean).length;
        if (activeLightingModes > 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione somente uma modalidade de iluminação por produto." });
        }

        // Bloquear alteração de markup mínimo fora dos perfis financeiros autorizados
        const MKP_MINIMO_FIELDS = [
          'mkpMinimoOnoff220v', 'mkpMinimoOnoffBivolt',
          'mkpMinimoDim110v', 'mkpMinimoDimDali',
          'mkpMinimoDimTriac110v', 'mkpMinimoDimTriac220v',
        ] as const;
        if (!canEditCosts) {
          for (const field of MKP_MINIMO_FIELDS) {
            const incomingValue = d[field];
            const existingValue = (existing as any)[field];
            const normalizeMarkup = (value: unknown) => {
              if (value === undefined || value === null || value === '') return null;
              const numeric = Number(value);
              return Number.isFinite(numeric) ? numeric : String(value);
            };
            if (incomingValue !== undefined && normalizeMarkup(incomingValue) !== normalizeMarkup(existingValue)) {
              throw new TRPCError({ code: 'FORBIDDEN', message: 'Seu perfil não pode alterar o markup mínimo.' });
            }
          }
        }

        const update: Record<string, unknown> = {};

        if (d.categoria !== undefined) update.categoria = d.categoria;
        if (d.instalacao !== undefined) update.instalacao = d.instalacao;
        if (d.familia !== undefined) update.familia = d.familia.toUpperCase();
        if (d.sku !== undefined) update.sku = d.sku.toUpperCase();
        if (d.produto !== undefined) update.produto = d.produto.toUpperCase();
        if (d.moduloLed !== undefined) update.moduloLed = d.moduloLed.toUpperCase();
        if (d.qtdModuloLed !== undefined) update.qtdModuloLed = String(d.qtdModuloLed);
        if (d.moduloRgbw !== undefined) update.moduloRgbw = d.moduloRgbw;
        if (d.moduloLampada !== undefined) update.moduloLampada = d.moduloLampada;
        if (d.moduloLedRgbw !== undefined) update.moduloLedRgbw = d.moduloLedRgbw?.toUpperCase() || null;
        if (d.qtdModuloLedRgbw !== undefined) update.qtdModuloLedRgbw = d.qtdModuloLedRgbw ? String(d.qtdModuloLedRgbw) : null;
        if (d.moduloTunableWhite !== undefined) update.moduloTunableWhite = d.moduloTunableWhite;
        if (d.moduloLedTunableWhite !== undefined) update.moduloLedTunableWhite = d.moduloLedTunableWhite?.toUpperCase() || null;
        if (d.qtdModuloLedTunableWhite !== undefined) update.qtdModuloLedTunableWhite = d.qtdModuloLedTunableWhite ? String(d.qtdModuloLedTunableWhite) : null;
        if (d.semModuloLed !== undefined) update.semModuloLed = d.semModuloLed;
        if (d.lampadaAcessorioId !== undefined) update.lampadaAcessorioId = d.lampadaAcessorioId ?? null;
        if (d.outrosEquipamentos !== undefined) update.outrosEquipamentos = normalizeOtherEquipmentReferences(d.outrosEquipamentos);
        if (d.moduloLed2700 !== undefined) update.moduloLed2700 = d.moduloLed2700?.toUpperCase() || null;
        if (d.moduloLed3000 !== undefined) update.moduloLed3000 = d.moduloLed3000?.toUpperCase() || null;
        if (d.moduloLed3500 !== undefined) update.moduloLed3500 = d.moduloLed3500?.toUpperCase() || null;
        if (d.moduloLed4000 !== undefined) update.moduloLed4000 = d.moduloLed4000?.toUpperCase() || null;
        if (d.moduloLed5000 !== undefined) update.moduloLed5000 = d.moduloLed5000?.toUpperCase() || null;
        if (d.qtdModuloLed2700 !== undefined) update.qtdModuloLed2700 = d.qtdModuloLed2700 ? String(d.qtdModuloLed2700) : null;
        if (d.qtdModuloLed3000 !== undefined) update.qtdModuloLed3000 = d.qtdModuloLed3000 ? String(d.qtdModuloLed3000) : null;
        if (d.qtdModuloLed3500 !== undefined) update.qtdModuloLed3500 = d.qtdModuloLed3500 ? String(d.qtdModuloLed3500) : null;
        if (d.qtdModuloLed4000 !== undefined) update.qtdModuloLed4000 = d.qtdModuloLed4000 ? String(d.qtdModuloLed4000) : null;
        if (d.qtdModuloLed5000 !== undefined) update.qtdModuloLed5000 = d.qtdModuloLed5000 ? String(d.qtdModuloLed5000) : null;
        const effectiveUsesStandardCct = !effectiveLighting.moduloRgbw
          && !effectiveLighting.moduloLampada
          && !effectiveLighting.moduloTunableWhite
          && !effectiveLighting.semModuloLed;
        if (!effectiveUsesStandardCct) {
          update.moduloLed = "";
          update.moduloLed2700 = null;
          update.moduloLed3000 = null;
          update.moduloLed3500 = null;
          update.moduloLed4000 = null;
          update.moduloLed5000 = null;
          update.qtdModuloLed2700 = null;
          update.qtdModuloLed3000 = null;
          update.qtdModuloLed3500 = null;
          update.qtdModuloLed4000 = null;
          update.qtdModuloLed5000 = null;
          update.moduloLedExtra = null;
          update.temperaturasCor = effectiveLighting.moduloRgbw ? '["RGBW"]' : '[]';
        }
        if (!effectiveLighting.moduloRgbw) {
          update.moduloLedRgbw = null;
          update.qtdModuloLedRgbw = null;
        }
        if (!effectiveLighting.moduloTunableWhite) {
          update.moduloLedTunableWhite = null;
          update.qtdModuloLedTunableWhite = null;
        }
        if (!effectiveLighting.moduloLampada) update.lampadaAcessorioId = null;
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
        if (d.driverOnoff220NaoAplicavel !== undefined) update.driverOnoff220NaoAplicavel = d.driverOnoff220NaoAplicavel;
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
        if (d.documentos !== undefined) update.documentos = parseProductDocuments(d.documentos);
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
        if (d.moduloLedExtra !== undefined) update.moduloLedExtra = parseModuloLedExtra(d.moduloLedExtra);
        if (d.composicaoD1D2 !== undefined) update.composicaoD1D2 = d.composicaoD1D2 || null;
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
        if (d.configuracaoPlanos !== undefined) update.configuracaoPlanos = d.configuracaoPlanos ?? null;
        if (d.possuiOpcaoD1D2 !== undefined) update.possuiOpcaoD1D2 = d.possuiOpcaoD1D2;
        if (d.custoCorpoOnoff220v !== undefined) update.custoCorpoOnoff220v = d.custoCorpoOnoff220v || null;
        if (d.mkpPadraoOnoff220v !== undefined) update.mkpPadraoOnoff220v = d.mkpPadraoOnoff220v || null;
        // mkpMinimo — apenas admin pode alterar
        if (d.mkpMinimoOnoff220v !== undefined) update.mkpMinimoOnoff220v = d.mkpMinimoOnoff220v || null;
        if (d.custoCorpoOnoffBivolt !== undefined) update.custoCorpoOnoffBivolt = d.custoCorpoOnoffBivolt || null;
        if (d.mkpPadraoOnoffBivolt !== undefined) update.mkpPadraoOnoffBivolt = d.mkpPadraoOnoffBivolt || null;
        if (d.mkpMinimoOnoffBivolt !== undefined) update.mkpMinimoOnoffBivolt = d.mkpMinimoOnoffBivolt || null;
        if (d.custoCorpoDim110v !== undefined) update.custoCorpoDim110v = d.custoCorpoDim110v || null;
        if (d.mkpPadraoDim110v !== undefined) update.mkpPadraoDim110v = d.mkpPadraoDim110v || null;
        if (d.mkpMinimoDim110v !== undefined) update.mkpMinimoDim110v = d.mkpMinimoDim110v || null;
        if (d.custoCorpoDimDali !== undefined) update.custoCorpoDimDali = d.custoCorpoDimDali || null;
        if (d.mkpPadraoDimDali !== undefined) update.mkpPadraoDimDali = d.mkpPadraoDimDali || null;
        if (d.mkpMinimoDimDali !== undefined) update.mkpMinimoDimDali = d.mkpMinimoDimDali || null;
        if (d.custoCorpoDimTriac110v !== undefined) update.custoCorpoDimTriac110v = d.custoCorpoDimTriac110v || null;
        if (d.mkpPadraoDimTriac110v !== undefined) update.mkpPadraoDimTriac110v = d.mkpPadraoDimTriac110v || null;
        if (d.mkpMinimoDimTriac110v !== undefined) update.mkpMinimoDimTriac110v = d.mkpMinimoDimTriac110v || null;
        if (d.custoCorpoDimTriac220v !== undefined) update.custoCorpoDimTriac220v = d.custoCorpoDimTriac220v || null;
        if (d.mkpPadraoDimTriac220v !== undefined) update.mkpPadraoDimTriac220v = d.mkpPadraoDimTriac220v || null;
        if (d.mkpMinimoDimTriac220v !== undefined) update.mkpMinimoDimTriac220v = d.mkpMinimoDimTriac220v || null;
        if (d.mkpPadraoDriverOnoff220v !== undefined)    update.mkpPadraoDriverOnoff220v    = d.mkpPadraoDriverOnoff220v    || null;
        if (d.mkpPadraoDriverOnoffBivolt !== undefined)  update.mkpPadraoDriverOnoffBivolt  = d.mkpPadraoDriverOnoffBivolt  || null;
        if (d.mkpPadraoDriverDim110v !== undefined)      update.mkpPadraoDriverDim110v      = d.mkpPadraoDriverDim110v      || null;
        if (d.mkpPadraoDriverDimDali !== undefined)      update.mkpPadraoDriverDimDali      = d.mkpPadraoDriverDimDali      || null;
        if (d.mkpPadraoDriverDimTriac110v !== undefined) update.mkpPadraoDriverDimTriac110v = d.mkpPadraoDriverDimTriac110v || null;
        if (d.mkpPadraoDriverDimTriac220v !== undefined) update.mkpPadraoDriverDimTriac220v = d.mkpPadraoDriverDimTriac220v || null;
        if (d.mkpMinimoDriver !== undefined) update.mkpMinimoDriver = d.mkpMinimoDriver || "3";
        if (d.correnteDriver !== undefined) update.correnteDriver = d.correnteDriver || null;
        if (d.custoCorpoOnoff220vD1D2 !== undefined) update.custoCorpoOnoff220vD1D2 = d.custoCorpoOnoff220vD1D2 || null;
        if (d.custoCorpoOnoffBivoltD1D2 !== undefined) update.custoCorpoOnoffBivoltD1D2 = d.custoCorpoOnoffBivoltD1D2 || null;
        if (d.custoCorpoDim110vD1D2 !== undefined) update.custoCorpoDim110vD1D2 = d.custoCorpoDim110vD1D2 || null;
        if (d.custoCorpoDimDaliD1D2 !== undefined) update.custoCorpoDimDaliD1D2 = d.custoCorpoDimDaliD1D2 || null;
        if (d.custoCorpoDimTriac110vD1D2 !== undefined) update.custoCorpoDimTriac110vD1D2 = d.custoCorpoDimTriac110vD1D2 || null;
        if (d.custoCorpoDimTriac220vD1D2 !== undefined) update.custoCorpoDimTriac220vD1D2 = d.custoCorpoDimTriac220vD1D2 || null;
        await updateProduct(input.id, update as any);
        return { success: true };
      }),

    delete: entityAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteProduct(input.id);
        return { success: true };
      }),

    toggleAtivo: entityAdminProcedure
      .input(z.object({ id: z.number(), ativo: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        await db.update(productsTable)
          .set({ ativo: input.ativo })
          .where(eq(productsTable.id, input.id));
        return { success: true, id: input.id, ativo: input.ativo };
      }),


    bulkCreate: entityAdminProcedure
      .input(z.array(bulkProductSchema))
      .mutation(async ({ input }) => {
        const items = input.map((p) => ({
          ...p,
          familia: p.familia.toUpperCase(),
          sku: p.sku.toUpperCase(),
          produto: p.produto.toUpperCase(),
          moduloLed: p.moduloLed.toUpperCase(),
          moduloRgbw: p.moduloRgbw ?? 0,
          moduloLampada: p.moduloLampada ?? 0,
          moduloLedRgbw: p.moduloLedRgbw?.toUpperCase() || null,
          qtdModuloLedRgbw: p.qtdModuloLedRgbw ? String(p.qtdModuloLedRgbw) : null,
          moduloTunableWhite: p.moduloTunableWhite ?? false,
          moduloLedTunableWhite: p.moduloTunableWhite ? p.moduloLedTunableWhite?.toUpperCase() || null : null,
          qtdModuloLedTunableWhite: p.moduloTunableWhite && p.moduloLedTunableWhite ? String(p.qtdModuloLedTunableWhite ?? 1) : null,
          semModuloLed: p.semModuloLed ?? false,
          lampadaAcessorioId: p.moduloLampada ? p.lampadaAcessorioId ?? null : null,
          outrosEquipamentos: normalizeOtherEquipmentReferences(p.outrosEquipamentos),
          moduloLed2700: p.moduloLed2700?.toUpperCase() || null,
          moduloLed3000: p.moduloLed3000?.toUpperCase() || null,
          moduloLed3500: p.moduloLed3500?.toUpperCase() || null,
          moduloLed4000: p.moduloLed4000?.toUpperCase() || null,
          moduloLed5000: p.moduloLed5000?.toUpperCase() || null,
          qtdModuloLed2700: p.qtdModuloLed2700 ? String(p.qtdModuloLed2700) : null,
          qtdModuloLed3000: p.qtdModuloLed3000 ? String(p.qtdModuloLed3000) : null,
          qtdModuloLed3500: p.qtdModuloLed3500 ? String(p.qtdModuloLed3500) : null,
          qtdModuloLed4000: p.qtdModuloLed4000 ? String(p.qtdModuloLed4000) : null,
          qtdModuloLed5000: p.qtdModuloLed5000 ? String(p.qtdModuloLed5000) : null,
          otica: p.oticaNaoAplicavel || p.otica.toUpperCase() === "NÃO APLICÁVEL" ? "NÃO APLICÁVEL" : p.otica.toUpperCase(),
          holder: p.holderNaoAplicavel || p.holder.toUpperCase() === "NÃO APLICÁVEL" ? "NÃO APLICÁVEL" : p.holder.toUpperCase(),
          dissipador: p.dissipadorNaoAplicavel || p.dissipador.toUpperCase() === "NÃO APLICÁVEL" ? "NÃO APLICÁVEL" : p.dissipador.toUpperCase(),
          driverOnoff220: p.driverOnoff220.toUpperCase(),
          driverOnoffBivolt: p.driverOnoffBivolt.toUpperCase(),
          driverDim110v: p.driverDim110v?.toUpperCase() || null,
          driverDimDali: p.driverDimDali?.toUpperCase() || null,
          temperaturasCor: p.temperaturasCor || '["2700","3000","3500","4000","5000"]',
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

    count: protectedProcedure.query(async () => {
      return { count: await countProducts() };
    }),
  }),

  // ─── Backups ───────────────────────────────────────────────────────────────
  backups: router({
    // Listar backups disponíveis (somente admin)
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(backups).orderBy(desc(backups.createdAt)).limit(30);
      return rows;
    }),

    // Gerar backup manual (somente admin)
    generate: adminProcedure.mutation(async () => {
      // Inicia o backup em background sem aguardar — evita timeout em produção
      runBackup().then((result) => {
        if (!result.ok) {
          console.error("[Backup] Falha no backup manual:", result.error);
        }
      }).catch((err) => {
        console.error("[Backup] Erro inesperado no backup manual:", err);
      });
      return { ok: true, message: "Backup iniciado. A lista será atualizada em alguns segundos." };
    }),

    // Obter URL de download de um backup (somente admin)
    getDownloadUrl: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { eq: eqFn } = await import("drizzle-orm");
        const [backup] = await db.select().from(backups).where(eqFn(backups.id, input.id)).limit(1);
        if (!backup) throw new Error("Backup não encontrado");
        if (!backup.storageKey) throw new Error("Backup sem arquivo");
        const url = await storageGetSignedUrl(backup.storageKey);
        return { url, filename: backup.filename };
      }),
  }),

  // ─── (continuação products) ────────────────────────────────────────────────
  _products_tail: router({

    getAll: protectedProcedure.query(async ({ ctx }) => {
      const result = await listProducts({ limit: 2000, offset: 0 });
      const db = await getDb();
      const items = db ? await enrichManyWithModuloLedEq(db, result.items) : result.items;
      return items.map((item) => redactProductFinancials(item, ctx.user.role, ctx.user.permissionOverrides));
    }),

    // Autocomplete suggestions for free-text fields
    suggestions: protectedProcedure
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
