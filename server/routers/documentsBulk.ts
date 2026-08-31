import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { products } from "../../drizzle/schema";
import { getDb, getProductById } from "../db";
import { entityAdminProcedure, router } from "../_core/trpc";
import { getReportFilterOptions } from "../reporting";

export const documentTypes = ["datasheet", "fotometria", "desenhoTecnico", "manualInstalacao"] as const;
export type ProductDocumentType = (typeof documentTypes)[number];
export type BulkDocumentFilterScope = {
  familia?: string;
  categoria?: string;
  instalacao?: string;
  potencia?: string;
};

export function getBulkDocumentFilterOptions(
  items: Array<{ familia?: unknown; categoria?: unknown; instalacao?: unknown; potencia?: unknown }>,
  scope: BulkDocumentFilterScope,
) {
  return getReportFilterOptions(items, scope);
}

export type ProductDocument = {
  url: string;
  key: string;
  nome: string;
  mimeType: string;
};

export type ProductDocuments = Partial<Record<ProductDocumentType, ProductDocument>>;

function parseDocuments(raw: unknown): ProductDocuments {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: ProductDocuments = {};
    for (const type of documentTypes) {
      const value = (parsed as Record<string, unknown>)[type];
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const item = value as Record<string, unknown>;
      const url = String(item.url ?? "").trim();
      const key = String(item.key ?? "").trim();
      const nome = String(item.nome ?? "").trim();
      const mimeType = String(item.mimeType ?? "application/octet-stream").trim();
      if (url && key && nome) result[type] = { url, key, nome, mimeType };
    }
    return result;
  } catch {
    return {};
  }
}

export function mergeSharedDocuments(
  current: ProductDocuments,
  source: ProductDocuments,
  selectedTypes: ProductDocumentType[],
  replaceExisting: boolean,
): { documents: ProductDocuments; changed: boolean } {
  const documents = { ...current };
  let changed = false;
  for (const type of selectedTypes) {
    const sourceDocument = source[type];
    if (!sourceDocument || (!replaceExisting && documents[type])) continue;
    const currentDocument = documents[type];
    if (currentDocument?.key === sourceDocument.key && currentDocument?.nome === sourceDocument.nome) continue;
    documents[type] = sourceDocument;
    changed = true;
  }
  return { documents, changed };
}

const audienceSchema = z.object({
  familia: z.string().min(1, "Selecione a família do cadastro"),
  categoria: z.string().optional(),
  instalacao: z.string().optional(),
  potencia: z.enum(["18W", "26W", "36W-SF", "36W-SL"]).optional(),
});

export const bulkDocumentsInputSchema = audienceSchema.extend({
  sourceProductId: z.number().int().positive().optional(),
  documentos: z.object({
    datasheet: z.object({ url: z.string().min(1), key: z.string().min(1), nome: z.string().min(1), mimeType: z.string().min(1) }).optional(),
    fotometria: z.object({ url: z.string().min(1), key: z.string().min(1), nome: z.string().min(1), mimeType: z.string().min(1) }).optional(),
    desenhoTecnico: z.object({ url: z.string().min(1), key: z.string().min(1), nome: z.string().min(1), mimeType: z.string().min(1) }).optional(),
    manualInstalacao: z.object({ url: z.string().min(1), key: z.string().min(1), nome: z.string().min(1), mimeType: z.string().min(1) }).optional(),
  }).optional(),
  tipos: z.array(z.enum(documentTypes)).min(1, "Selecione ao menos um documento"),
  substituirExistentes: z.boolean().default(false),
  modoSelecao: z.enum(["todos", "selecionados"]).default("todos"),
  produtosSelecionados: z.array(z.number().int().positive()).max(5000).default([]),
}).superRefine((input, ctx) => {
  const documents = parseDocuments(input.documentos);
  const hasUploadedDocuments = input.tipos.every((type) => !!documents[type]);
  if (!input.sourceProductId && !hasUploadedDocuments) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione um produto de referência ou envie todos os documentos selecionados." });
  }
  if (input.modoSelecao === "selecionados" && input.produtosSelecionados.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione ao menos um produto para a aplicação individual." });
  }
});

async function resolveSourceDocuments(sourceProductId: number, types: ProductDocumentType[]) {
  const sourceProduct = await getProductById(sourceProductId);
  if (!sourceProduct) throw new Error("Produto de referência não encontrado");
  const sourceDocuments = parseDocuments((sourceProduct as { documentos?: unknown }).documentos);
  const missing = types.filter((type) => !sourceDocuments[type]);
  if (missing.length) {
    const labels: Record<ProductDocumentType, string> = { datasheet: "Datasheet", fotometria: "Fotometria IES", desenhoTecnico: "Desenho Técnico", manualInstalacao: "Manual de Instalação" };
    throw new Error(`O produto de referência não possui: ${missing.map((type) => labels[type]).join(", ")}.`);
  }
  return { sourceProduct, sourceDocuments };
}

async function resolveDocuments(input: z.infer<typeof bulkDocumentsInputSchema>) {
  const uploadedDocuments = parseDocuments(input.documentos);
  const missingTypes = input.tipos.filter((type) => !uploadedDocuments[type]);
  if (missingTypes.length === 0) {
    return { sourceProduct: null, sourceDocuments: uploadedDocuments, skipsSource: false };
  }
  const source = await resolveSourceDocuments(input.sourceProductId!, missingTypes);
  return {
    ...source,
    sourceDocuments: { ...source.sourceDocuments, ...uploadedDocuments },
    // Se algum arquivo foi enviado nesta tela, o produto de referência também
    // participa da atualização para receber a versão mais recente.
    skipsSource: missingTypes.length === input.tipos.length,
  };
}

type TargetFilters = z.infer<typeof audienceSchema> & Partial<Pick<z.infer<typeof bulkDocumentsInputSchema>, "modoSelecao" | "produtosSelecionados">>;

async function listTargets(input: TargetFilters) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const conditions = [eq(products.familia, input.familia)];
  if (input.categoria?.trim()) conditions.push(eq(products.categoria, input.categoria.trim()));
  if (input.instalacao?.trim()) conditions.push(eq(products.instalacao, input.instalacao.trim()));
  if (input.potencia) conditions.push(eq(products.potencia, input.potencia));
  if (input.modoSelecao === "selecionados" && input.produtosSelecionados?.length) {
    conditions.push(inArray(products.id, input.produtosSelecionados));
  }

  return db
    .select({ id: products.id, sku: products.sku, produto: products.produto, familia: products.familia, categoria: products.categoria, instalacao: products.instalacao, potencia: products.potencia, documentos: products.documentos })
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(products.produto), asc(products.sku));
}

export const documentsBulkRouter = router({
  filterOptions: entityAdminProcedure
    .input(audienceSchema.partial().optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      const items = await db
        .select({ familia: products.familia, categoria: products.categoria, instalacao: products.instalacao, potencia: products.potencia })
        .from(products);
      return getBulkDocumentFilterOptions(items, input ?? {});
    }),

  targets: entityAdminProcedure
    .input(audienceSchema)
    .query(async ({ input }) => listTargets(input)),

  preview: entityAdminProcedure
    .input(bulkDocumentsInputSchema)
    .query(async ({ input }) => {
      const [source, targets] = await Promise.all([
        resolveDocuments(input),
        listTargets(input),
      ]);
      const selected = new Set(input.tipos);
      const preview = targets.map((target) => {
        const current = parseDocuments(target.documentos);
        const documentsToApply = input.tipos.filter((type) => input.substituirExistentes || !current[type]);
        return {
          id: target.id,
          sku: target.sku,
          produto: target.produto,
          familia: target.familia,
          potencia: target.potencia,
          isSource: source.skipsSource && target.id === input.sourceProductId,
          currentTypes: documentTypes.filter((type) => !!current[type]),
          documentsToApply,
          willChange: !(source.skipsSource && target.id === input.sourceProductId) && documentsToApply.some((type) => !!source.sourceDocuments[type]),
          selectedTypes: Array.from(selected),
        };
      });
      return {
        source: source.sourceProduct ? {
          id: source.sourceProduct.id,
          sku: source.sourceProduct.sku,
          produto: source.sourceProduct.produto,
          documents: source.sourceDocuments,
        } : null,
        total: preview.length,
        affected: preview.filter((item) => item.willChange).length,
        items: preview.slice(0, 100),
      };
    }),

  applyDocuments: entityAdminProcedure
    .input(bulkDocumentsInputSchema)
    .mutation(async ({ input }) => {
      const [source, targets, db] = await Promise.all([
        resolveDocuments(input),
        listTargets(input),
        getDb(),
      ]);
      if (!db) throw new Error("Banco de dados indisponível");

      let updated = 0;
      let unchanged = 0;
      for (const target of targets) {
        if (source.skipsSource && target.id === input.sourceProductId) {
          unchanged += 1;
          continue;
        }
        const current = parseDocuments(target.documentos);
        const merged = mergeSharedDocuments(current, source.sourceDocuments, input.tipos, input.substituirExistentes);
        if (!merged.changed) {
          unchanged += 1;
          continue;
        }
        await db.update(products).set({ documentos: JSON.stringify(merged.documents) }).where(eq(products.id, target.id));
        updated += 1;
      }
      return { total: targets.length, updated, unchanged, sourceProductId: source.sourceProduct?.id ?? null };
    }),
});
