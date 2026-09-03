import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { storagePut, storageGetSignedUrl } from "./storage";
import { bulkInsertProducts, listProducts, getDb, getProductById } from "./db";
import { accessories as accessoriesTable, components as componentsTable } from "../drizzle/schema";
import { parsePublicDriverExtras } from "./driverExtras";
import { buildSpecialLightingContract, type AccessorySummary, type ComponentSummary } from "./productLighting";
import { requireRestPermission } from "./authz";
import { buildProductReportWorkbook, parseReportSections } from "./reporting";

const router = express.Router();

// ─── Multer config ────────────────────────────────────────────────────────────
// Multer para imagens (JPEG, JPG, PNG apenas)
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedImages = ["image/jpeg", "image/jpg", "image/png"];
    if (allowedImages.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos JPEG, JPG e PNG são aceitos para foto"));
    }
  },
});

// Multer para Excel (.xlsx apenas)
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowedExcel = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (allowedExcel.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos .xlsx são aceitos para importação"));
    }
  },
});

// Multer para documentos do produto. A extensão permitida depende do tipo.
const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

const documentRules = {
  datasheet: { extensions: ["pdf"], label: "Datasheet" },
  fotometria: { extensions: ["ies"], label: "Fotometria IES" },
  desenhoTecnico: { extensions: ["pdf", "dwg", "dxf", "png", "jpg", "jpeg"], label: "Desenho Técnico" },
  manualInstalacao: { extensions: ["pdf"], label: "Manual de Instalação" },
} as const;

export function extractStorageKey(urlOrKey: string | null | undefined): string | null {
  if (!urlOrKey) return null;
  const value = urlOrKey.trim();
  if (!value) return null;

  const localMatch = value.match(/^\/manus-storage\/(.+)$/);
  if (localMatch) return localMatch[1];

  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return value.replace(/^\/+/, "");
  }

  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    const documentsMarker = "/products/documents/";
    const markerIndex = pathname.indexOf(documentsMarker);
    if (markerIndex >= 0) return pathname.slice(markerIndex + 1);
  } catch {
    return null;
  }

  return null;
}

export function resolveStoredDocumentKey(document: { url?: string | null; key?: string | null } | null | undefined): string | null {
  if (!document) return null;
  // O storage acrescenta um hash ao nome no upload. Registros antigos salvaram
  // por engano a chave anterior ao hash, enquanto a URL local contém a chave real.
  return extractStorageKey(document.url) || extractStorageKey(document.key);
}

export const productDocumentTypes = ["datasheet", "fotometria", "desenhoTecnico", "manualInstalacao"] as const;
type ProductDocumentType = (typeof productDocumentTypes)[number];
type StoredDocument = { url: string; key: string; nome: string; mimeType: string };
type StoredDocuments = Partial<Record<ProductDocumentType, StoredDocument>>;

export function parseStoredProductDocuments(raw: unknown): StoredDocuments {
  if (!raw) return {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: StoredDocuments = {};
    for (const tipo of productDocumentTypes) {
      const value = (parsed as Record<string, unknown>)[tipo];
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const document = value as Record<string, unknown>;
      const url = String(document.url ?? "").trim();
      const key = String(document.key ?? "").trim();
      const nome = String(document.nome ?? "").trim();
      const mimeType = String(document.mimeType ?? "application/octet-stream").trim();
      if (url && key && nome) result[tipo] = { url, key, nome, mimeType };
    }
    return result;
  } catch {
    return {};
  }
}

export function resolveInternalProductDocument(raw: unknown, type: string): { document: StoredDocument; key: string } | null {
  if (!(productDocumentTypes as readonly string[]).includes(type)) return null;
  const document = parseStoredProductDocuments(raw)[type as ProductDocumentType];
  if (!document) return null;
  const key = resolveStoredDocumentKey(document);
  return key ? { document, key } : null;
}

export function buildPublicProductDocuments(raw: unknown, signedUrlMap: ReadonlyMap<string, string>) {
  const storedDocuments = parseStoredProductDocuments(raw);
  const resolveDocument = (document: StoredDocument | undefined) => {
    if (!document) return null;
    const key = resolveStoredDocumentKey(document);
    return {
      nome: document.nome,
      mimeType: document.mimeType,
      url: key ? (signedUrlMap.get(key) ?? document.url) : document.url,
    };
  };
  const documentos = {
    datasheet: resolveDocument(storedDocuments.datasheet),
    fotometria: resolveDocument(storedDocuments.fotometria),
    desenhoTecnico: resolveDocument(storedDocuments.desenhoTecnico),
    manualInstalacao: resolveDocument(storedDocuments.manualInstalacao),
  };
  return {
    documentos,
    datasheetUrl: documentos.datasheet?.url ?? null,
    fotometriaIesUrl: documentos.fotometria?.url ?? null,
    desenhoTecnicoUrl: documentos.desenhoTecnico?.url ?? null,
    manualInstalacaoUrl: documentos.manualInstalacao?.url ?? null,
  };
}

// ─── Upload de imagem ─────────────────────────────────────────────────────────
router.post("/upload-image", requireRestPermission("manageEntities"), uploadImage.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "jpg";
    const key = `products/photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);

    return res.json({ url, key });
  } catch (err) {
    console.error("[upload-image]", err);
    return res.status(500).json({ error: "Erro ao fazer upload da imagem" });
  }
});

// ─── Upload de documento ───────────────────────────────────────────────────────
router.post("/upload-document", requireRestPermission("manageDocuments"), uploadDocument.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

    const tipo = String(req.body.tipo || "") as keyof typeof documentRules;
    const rule = documentRules[tipo];
    if (!rule) return res.status(400).json({ error: "Tipo de documento inválido" });

    const originalName = req.file.originalname.replace(/[\\/\0]/g, "").trim();
    const ext = originalName.split(".").pop()?.toLowerCase() || "";
    if (!(rule.extensions as readonly string[]).includes(ext)) {
      return res.status(400).json({
        error: `${rule.label}: formatos aceitos — ${rule.extensions.map((item) => `.${item}`).join(", ")}`,
      });
    }

    const requestedKey = `products/documents/${tipo}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const mimeType = req.file.mimetype || "application/octet-stream";
    const { key, url } = await storagePut(requestedKey, req.file.buffer, mimeType);
    const documento = { url, key, nome: originalName, mimeType };
    let urlVisualizacao = url;
    try {
      urlVisualizacao = await storageGetSignedUrl(key);
    } catch (signError) {
      console.warn("[upload-document] Falha ao assinar URL de visualização; usando proxy privado", signError);
    }

    return res.json({
      tipo,
      // "documento" é a referência durável que será salva no produto.
      documento,
      // A cópia abaixo é transitória e permite abrir o arquivo imediatamente
      // após o upload, antes mesmo de uma nova consulta do produto.
      documentoVisualizacao: { ...documento, url: urlVisualizacao },
    });
  } catch (err) {
    console.error("[upload-document]", err);
    return res.status(500).json({ error: "Erro ao fazer upload do documento" });
  }
});

// ─── Abertura interna de documento ──────────────────────────────────────────
// A assinatura é renovada a cada clique, evitando URLs expiradas em abas ou
// consultas já abertas, sem tornar nenhum arquivo público.
router.get("/:id/document/:type", requireRestPermission("viewCatalog"), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "Produto inválido." });
    }

    const product = await getProductById(productId);
    const resolvedDocument = resolveInternalProductDocument(product?.documentos, req.params.type);
    if (!resolvedDocument) {
      return res.status(404).json({ error: "Documento não encontrado." });
    }

    const signedUrl = await storageGetSignedUrl(resolvedDocument.key);
    res.set("Cache-Control", "private, no-store");
    return res.redirect(307, signedUrl);
  } catch (error) {
    console.error("[open-product-document]", error);
    return res.status(502).json({ error: "Não foi possível preparar o documento para visualização." });
  }
});

// ─── Exportação Excel ─────────────────────────────────────────────────────────
router.get("/export-excel", requireRestPermission("viewCosts"), async (_req, res) => {
  try {
    const { items } = await listProducts({ limit: 5000, offset: 0 });

    const rows = items.map((p) => ({
      CATEGORIA: p.categoria || "",
      INSTALAÇÃO: p.instalacao,
      SKU: p.sku,
      FAMÍLIA: p.familia,
      PRODUTO: p.produto,
      "MÓDULO LED": p.moduloLed,
      "MÓDULO LED 2700K": (p as any).moduloLed2700 || "",
      "QTD MÓDULO LED 2700K": (p as any).qtdModuloLed2700 || "",
      "MÓDULO LED 3000K": (p as any).moduloLed3000 || "",
      "QTD MÓDULO LED 3000K": (p as any).qtdModuloLed3000 || "",
      "MÓDULO LED 3500K": (p as any).moduloLed3500 || "",
      "QTD MÓDULO LED 3500K": (p as any).qtdModuloLed3500 || "",
      "MÓDULO LED 4000K": (p as any).moduloLed4000 || "",
      "QTD MÓDULO LED 4000K": (p as any).qtdModuloLed4000 || "",
      "MÓDULO LED 5000K": (p as any).moduloLed5000 || "",
      "QTD MÓDULO LED 5000K": (p as any).qtdModuloLed5000 || "",
      ÓTICA: p.oticaNaoAplicavel ? "NÃO APLICÁVEL" : p.otica,
      HOLDER: p.holderNaoAplicavel ? "NÃO APLICÁVEL" : p.holder,
      DISSIPADOR: p.dissipadorNaoAplicavel ? "NÃO APLICÁVEL" : p.dissipador,
      "ON/OFF DRIVER 220Vac": p.driverOnoff220,
      "ON/OFF DRIVER BIVOLT": p.driverOnoffBivolt,
      "DIM 1-10V": p.driverDim110v || "",
      "DIM DALI": p.driverDimDali || "",
      "TEMPERATURAS COR": p.temperaturasCor,
      "CUSTO LUMINÁRIA (R$)": p.custoLuminaria || "",
      "CUSTO DRIVER ON/OFF 220Vac (R$)": (p as any).custoDriverOnoff220 || "",
      "CUSTO DRIVER ON/OFF BIVOLT (R$)": (p as any).custoDriverOnoffBivolt || "",
      "CUSTO DRIVER DIM 1-10V (R$)": (p as any).custoDriverDim110v || "",
      "CUSTO DRIVER DIM DALI (R$)": (p as any).custoDriverDimDali || "",
      "FOTO URL": p.fotoUrl || "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Ajustar largura das colunas
    const colWidths = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(k.length, 20) }));
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "PRODUTOS");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="cadastro-produtos-alfalux-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    return res.send(buf);
  } catch (err) {
    console.error("[export-excel]", err);
    return res.status(500).json({ error: "Erro ao exportar Excel" });
  }
});

// ─── Relatório gerencial Excel ─────────────────────────────────────────────────
router.get("/reports-excel", requireRestPermission("viewReports"), async (req, res) => {
  try {
    const value = (key: string) => typeof req.query[key] === "string" ? req.query[key].trim() || undefined : undefined;
    const filters = {
      search: value("search"), categoria: value("categoria"), instalacao: value("instalacao"),
      familia: value("familia"), potencia: value("potencia"), apenasInativos: req.query.apenasInativos === "true",
    };
    const { items } = await listProducts({ ...filters, limit: 5000, offset: 0 });
    const workbook = await buildProductReportWorkbook(items, parseReportSections(value("sections")), filters);
    const buf = Buffer.from(await workbook.xlsx.writeBuffer());
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio-gerencial-alfalux-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    return res.send(buf);
  } catch (err) {
    console.error("[reports-excel]", err);
    return res.status(500).json({ error: "Erro ao gerar relatório Excel" });
  }
});

// ─── Importação Excel ─────────────────────────────────────────────────────────

/**
 * Detecta se a planilha está no formato do Configurador de Produtos Alfalux
 * (aba "Módulos de Perfis", cabeçalho na linha 4, dados a partir da linha 6)
 */
function isConfiguadorFormat(rawData: any[][]): boolean {
  // Linha 1 contém o título do catálogo
  const linha1 = String(rawData[0]?.[0] || "");
  if (linha1.includes("CATÁLOGO DE MÓDULOS") || linha1.includes("PERFIS LED ALFALUX")) return true;
  // Linha 4 (índice 3) contém "Código (SKU)" como primeiro cabeçalho
  const linha4 = String(rawData[3]?.[0] || "");
  if (linha4.includes("Código (SKU)") || linha4.includes("Codigo (SKU)")) return true;
  return false;
}

/**
 * Detecta se a planilha está no formato DRIVER_LOOKUP (Downlights/Painéis)
 * O XLSX.js pula linhas vazias iniciais, então o cabeçalho aparece na linha 1 (idx 0)
 * Colunas: INSTALAÇÃO, SKU, FAMÍLIA, PRODUTO, HOLDER/MÓDULO LED, ÓTICA, DISSIPADOR...
 */
function isDriverLookupFormat(rawData: any[][], sheetName: string): boolean {
  // Procurar a linha de cabeçalho nas primeiras 5 linhas (XLSX.js pula linhas vazias)
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const row = rawData[i] as any[];
    if (!row) continue;
    const cells = row.map((c: any) => String(c || "").toUpperCase());
    if (cells.includes("INSTALAÇÃO") && cells.includes("SKU") && cells.includes("FAMÍLIA") && cells.includes("PRODUTO")) {
      return true;
    }
  }
  return false;
}

/**
 * Importa produtos no formato DRIVER_LOOKUP
 * O XLSX.js pula linhas vazias, então o cabeçalho está na primeira linha não vazia
 * Suporta abas DOWNLIGHTS e PAINÉIS com colunas ligeiramente diferentes
 */
function parseFormatoDriverLookup(ws: any, sheetName: string): any[] {
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

  // Encontrar a linha de cabeçalho (contém INSTALAÇÃO, SKU, FAMÍLIA, PRODUTO)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const row = rawData[i] as any[];
    if (!row) continue;
    const cells = row.map((c: any) => String(c || "").toUpperCase());
    if (cells.includes("INSTALAÇÃO") && cells.includes("SKU") && cells.includes("PRODUTO")) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx < 0) return [];

  const headers = rawData[headerRowIdx] as any[];

  // Mapear índices das colunas pelo nome
  const colIdx: Record<string, number> = {};
  headers.forEach((h: any, i: number) => {
    if (h != null) colIdx[String(h).trim().toUpperCase()] = i;
  });

  // Detectar categoria pela aba
  const categoriaAba = sheetName.toUpperCase().includes("PAIN") ? "PAINÉIS" : "DOWNLIGHTS";

  const products: any[] = [];
  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row) continue;

    const skuRaw = row[colIdx["SKU"]];
    const sku = String(skuRaw || "").trim();
    if (!sku) continue;

    const produto = String(row[colIdx["PRODUTO"]] || "").trim().toUpperCase();
    if (!produto) continue;

    const instalacao = String(row[colIdx["INSTALAÇÃO"]] || "").trim().toUpperCase();
    const familia = String(row[colIdx["FAMÍLIA"]] || "").trim().toUpperCase();

    // Campos que podem variar entre abas
    const holderRaw = String(row[colIdx["HOLDER"]] || "").trim().toUpperCase();
    const oticaRaw = String(row[colIdx["ÓTICA"]] || row[colIdx["OTICA"]] || "").trim().toUpperCase();
    const dissipadorRaw = String(row[colIdx["DISSIPADOR"]] || "").trim().toUpperCase();
    const moduloLed = String(row[colIdx["MÓDULO LED"]] || row[colIdx["MODULO LED"]] || "").trim().toUpperCase();

    const driver220 = String(row[colIdx["ON/OFF DRIVER 220VAC"]] || row[colIdx["ON/OFF DRIVER 220Vac"]] || "").trim().toUpperCase();
    const driverBivolt = String(row[colIdx["ON/OFF DRIVER BIVOLT"]] || "").trim().toUpperCase();
    const driverDim110 = String(row[colIdx["DIM 1-10V"]] || "").trim().toUpperCase();
    const driverDali = String(row[colIdx["DIM DALI"]] || "").trim().toUpperCase();

    const otica = oticaRaw || "NÃO APLICÁVEL";
    const holder = holderRaw || "NÃO APLICÁVEL";
    const dissipador = dissipadorRaw || "NÃO APLICÁVEL";

    products.push({
      categoria: categoriaAba,
      instalacao,
      familia,
      sku: sku.toUpperCase(),
      produto,
      moduloLed: moduloLed || "NÃO ESPECIFICADO",
      otica,
      oticaNaoAplicavel: otica === "NÃO APLICÁVEL" || otica === "NAO APLICAVEL",
      holder,
      holderNaoAplicavel: holder === "NÃO APLICÁVEL" || holder === "NAO APLICAVEL",
      dissipador,
      dissipadorNaoAplicavel: dissipador === "NÃO APLICÁVEL" || dissipador === "NAO APLICAVEL",
      driverOnoff220: driver220 || "NÃO ESPECIFICADO",
      driverOnoffBivolt: driverBivolt || null,
      driverOnoffBivoltNaoAplicavel: !driverBivolt,
      driverDim110v: driverDim110 || null,
      driverDim110vNaoAplicavel: !driverDim110,
      driverDimDali: driverDali || null,
      driverDimDaliNaoAplicavel: !driverDali,
      temperaturasCor: '["2700","3000","3500","4000","5000"]',
      fotoUrl: null,
      fotoKey: null,
      custoLuminaria: null,
      custoDriverOnoff220: null,
      custoDriverOnoffBivolt: null,
      custoDriverDim110v: null,
      custoDriverDimDali: null,
    });
  }
  return products;
}

/**
 * Importa produtos no formato padrão do Cadastro (cabeçalho na primeira linha encontrada com SKU/PRODUTO)
 */
function parseFormatoPadrao(ws: any, sheetName: string): any[] {
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  let headerRow = -1;
  for (let i = 0; i < Math.min(rawData.length, 10); i++) {
    const row = rawData[i];
    if (row && row.some((cell: any) => String(cell || "").includes("SKU") || String(cell || "").includes("PRODUTO"))) {
      headerRow = i;
      break;
    }
  }
  let data: any[];
  if (headerRow >= 0) {
    data = XLSX.utils.sheet_to_json(ws, { range: headerRow }) as any[];
  } else {
    data = XLSX.utils.sheet_to_json(ws) as any[];
  }

  const products: any[] = [];
  for (const row of data) {
    const sku = String(row["SKU"] || row["sku"] || "").trim();
    const produto = String(row["PRODUTO"] || row["produto"] || "").trim();
    if (!sku || !produto || sku === "SKU") continue;

    const oticaRaw = String(row["ÓTICA"] || row["OTICA"] || row["Ótica"] || "").trim().toUpperCase();
    const holderRaw = String(row["HOLDER"] || row["holder"] || "").trim().toUpperCase();
    const dissipadorRaw = String(row["DISSIPADOR"] || row["dissipador"] || "").trim().toUpperCase();
    const moduloLed3500 = String(row["MÓDULO LED 3500K"] || row["MODULO LED 3500K"] || "").trim().toUpperCase();
    const qtdModuloLed3500Raw = String(row["QTD MÓDULO LED 3500K"] || row["QTD MODULO LED 3500K"] || "").trim().replace(',', '.');
    const qtdModuloLed3500 = qtdModuloLed3500Raw ? Number(qtdModuloLed3500Raw) : undefined;

    products.push({
      categoria: String(row["CATEGORIA"] || sheetName || "").trim().toUpperCase(),
      instalacao: String(row["INSTALAÇÃO"] || row["INSTALACAO"] || "").trim().toUpperCase(),
      familia: String(row["FAMÍLIA"] || row["FAMILIA"] || "").trim().toUpperCase(),
      sku: sku.toUpperCase(),
      produto: produto.toUpperCase(),
      moduloLed: String(row["MÓDULO LED"] || row["MODULO LED"] || "").trim().toUpperCase(),
      moduloLed3500: moduloLed3500 || null,
      qtdModuloLed3500: Number.isFinite(qtdModuloLed3500) && qtdModuloLed3500! > 0 ? qtdModuloLed3500 : undefined,
      otica: oticaRaw || "NÃO APLICÁVEL",
      oticaNaoAplicavel: oticaRaw === "NÃO APLICÁVEL" || oticaRaw === "NAO APLICAVEL",
      holder: holderRaw || "NÃO APLICÁVEL",
      holderNaoAplicavel: holderRaw === "NÃO APLICÁVEL" || holderRaw === "NAO APLICAVEL",
      dissipador: dissipadorRaw || "NÃO APLICÁVEL",
      dissipadorNaoAplicavel: dissipadorRaw === "NÃO APLICÁVEL" || dissipadorRaw === "NAO APLICAVEL",
      driverOnoff220: String(row["ON/OFF DRIVER 220Vac"] || row["ON/OFF DRIVER 220VAC"] || "").trim().toUpperCase(),
      driverOnoffBivolt: String(row["ON/OFF DRIVER BIVOLT"] || "").trim().toUpperCase(),
      driverOnoffBivoltNaoAplicavel: false,
      driverDim110v: String(row["DIM 1-10V"] || "").trim().toUpperCase() || null,
      driverDim110vNaoAplicavel: true,
      driverDimDali: String(row["DIM DALI"] || "").trim().toUpperCase() || null,
      driverDimDaliNaoAplicavel: true,
      temperaturasCor: '["2700","3000","3500","4000","5000"]',
      fotoUrl: null,
      fotoKey: null,
      custoLuminaria: String(row["CUSTO LUMINÁRIA (R$)"] || "").trim() || null,
      custoDriverOnoff220: String(row["CUSTO DRIVER ON/OFF 220Vac (R$)"] || "").trim() || null,
      custoDriverOnoffBivolt: String(row["CUSTO DRIVER ON/OFF BIVOLT (R$)"] || "").trim() || null,
      custoDriverDim110v: String(row["CUSTO DRIVER DIM 1-10V (R$)"] || "").trim() || null,
      custoDriverDimDali: String(row["CUSTO DRIVER DIM DALI (R$)"] || "").trim() || null,
    });
  }
  return products;
}

/**
 * Importa produtos no formato do Configurador de Produtos Alfalux
 * Aba "Módulos de Perfis": título nas linhas 1-2, cabeçalho na linha 4, dados a partir da linha 6
 * Linhas de seção (▶ EMBUTIR, ▶ PENDENTE etc.) são ignoradas
 */
function parseFormatoConfigurador(ws: any): any[] {
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  // Cabeçalho está na linha 4 (índice 3)
  const headers = rawData[3] as any[];
  if (!headers) return [];

  // Mapear índices das colunas pelo nome
  const colIdx: Record<string, number> = {};
  headers.forEach((h: any, i: number) => {
    if (h != null) colIdx[String(h).trim()] = i;
  });

  const products: any[] = [];
  // Dados começam na linha 6 (índice 5) — linha 5 (índice 4) é a primeira seção ▶
  for (let i = 5; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row) continue;

    const skuRaw = row[colIdx["Código (SKU)"] ?? 0];
    const sku = String(skuRaw || "").trim();

    // Ignorar linhas de seção (▶) e linhas sem SKU
    if (!sku || sku.startsWith("▶") || sku === "Código (SKU)") continue;

    const nomeProduto = String(row[colIdx["Nome do Produto"] ?? 1] || "").trim().toUpperCase();
    const rawCategoria = String(row[colIdx["Categoria"] ?? 3] || "PERFIS").trim().toUpperCase();
    // Normalizar variantes do nome da categoria de perfis
    const categoria = rawCategoria === "PERFIS LINEARES LED" ? "PERFIS" : rawCategoria;
    const familia = String(row[colIdx["Família"] ?? 5] || "").trim().toUpperCase();
    const tipoInstalacao = String(row[colIdx["Tipo de Instalação"] ?? 8] || "").trim().toUpperCase();
    const potencia = String(row[colIdx["Potência"] ?? 12] || "").trim();
    const tipoBarra = String(row[colIdx["Tipo de Barra"] ?? 13] || "").trim();
    const corrente = String(row[colIdx["Corrente"] ?? 14] || "").trim();
    const tensaoBarra = String(row[colIdx["Tensão da Barra"] ?? 15] || "").trim();

    // Módulo LED: composto de Potência + Tipo de Barra + Corrente + Tensão
    const moduloLed = [potencia, tipoBarra, corrente, tensaoBarra].filter(Boolean).join(" ").toUpperCase();

    // Drivers
    const driver220Modelo = String(row[colIdx["Modelo Driver (220V)"] ?? 19] || "").trim().toUpperCase();
    const driverBivoltModelo = String(row[colIdx["Modelo Driver (Bivolt)"] ?? 22] || "").trim().toUpperCase();

    // Normalizar instalação para os valores do sistema
    let instalacao = tipoInstalacao;
    if (instalacao === "EMBUTIR") instalacao = "EMBUTIR";
    else if (instalacao === "PENDENTE") instalacao = "PENDENTE";
    else if (instalacao === "SOBREPOR") instalacao = "SOBREPOR";

    products.push({
      categoria,
      instalacao,
      familia,
      sku: sku.toUpperCase(),
      produto: nomeProduto,
      moduloLed: moduloLed || "NÃO ESPECIFICADO",
      // Perfis não têm ótica, holder ou dissipador
      otica: "NÃO APLICÁVEL",
      oticaNaoAplicavel: true,
      holder: "NÃO APLICÁVEL",
      holderNaoAplicavel: true,
      dissipador: "NÃO APLICÁVEL",
      dissipadorNaoAplicavel: true,
      // Drivers
      driverOnoff220: driver220Modelo || "NÃO ESPECIFICADO",
      driverOnoffBivolt: driverBivoltModelo || null,
      driverOnoffBivoltNaoAplicavel: !driverBivoltModelo,
      driverDim110v: null,
      driverDim110vNaoAplicavel: true,
      driverDimDali: null,
      driverDimDaliNaoAplicavel: true,
      temperaturasCor: '["2700","3000","3500","4000","5000"]',
      fotoUrl: null,
      fotoKey: null,
      custoLuminaria: null,
      custoDriverOnoff220: null,
      custoDriverOnoffBivolt: null,
      custoDriverDim110v: null,
      custoDriverDimDali: null,
    });
  }
  return products;
}

router.post("/import-excel", requireRestPermission("manageEntities"), uploadExcel.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const allProducts: any[] = [];

    // Abas que devem ser ignoradas no formato do Configurador (são abas auxiliares, não de produtos)
    const ABAS_IGNORADAS_CONFIGURADOR = new Set([
      "Resumo por Perfil",
      "Tabela de Drivers",
      "Legenda",
      "Resumo",
      "Drivers",
    ]);

    // Passo 1: detectar o formato geral do arquivo (verificar todas as abas)
    let formatoDetectado = "padrão";
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      if (isConfiguadorFormat(rawData)) {
        formatoDetectado = "configurador";
        break;
      }
      if (isDriverLookupFormat(rawData, sheetName)) {
        formatoDetectado = "driver_lookup";
        break;
      }
    }

    // Passo 2: processar as abas de acordo com o formato detectado
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      if (formatoDetectado === "configurador") {
        // Pular abas auxiliares
        if (ABAS_IGNORADAS_CONFIGURADOR.has(sheetName)) continue;
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (isConfiguadorFormat(rawData)) {
          const produtos = parseFormatoConfigurador(ws);
          allProducts.push(...produtos);
        }
        // Abas não reconhecidas no formato configurador são ignoradas
      } else if (formatoDetectado === "driver_lookup") {
        // Formato DRIVER_LOOKUP: processar cada aba (DOWNLIGHTS, PAINÉIS)
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (isDriverLookupFormat(rawData, sheetName)) {
          const produtos = parseFormatoDriverLookup(ws, sheetName);
          allProducts.push(...produtos);
        }
      } else {
        // Formato padrão do Cadastro
        const produtos = parseFormatoPadrao(ws, sheetName);
        allProducts.push(...produtos);
      }
    }

    if (allProducts.length === 0) {
      return res.status(400).json({ error: "Nenhum produto válido encontrado no arquivo. Verifique se a planilha segue o formato padrão do Cadastro ou o formato do Configurador de Produtos." });
    }

    const { inserted, skipped } = await bulkInsertProducts(allProducts);
    return res.json({ success: true, inserted, skipped, total: allProducts.length, formato: formatoDetectado });
  } catch (err) {
    console.error("[import-excel]", err);
    return res.status(500).json({ error: "Erro ao importar Excel: " + String(err) });
  }
});

// ─── Helpers para o endpoint /api/products/all ──────────────────────────────

/** Formata "NX MODELO" quando qty > 1, ou só "MODELO" quando qty = 1 */
function withQty(modelo: string | null | undefined, qty: number): string | null {
  if (!modelo) return null;
  const m = modelo.trim();
  if (!m) return null;
  return qty > 1 ? `${qty}x ${m}` : m;
}

/** Extrai código EQ do nome do driver, ex: "PHILIPS XITANIUM 44W (EQ00347)" → "EQ00347" */
function extractEqCode(model: string | null | undefined): string | null {
  if (!model) return null;
  // Captura EQ seguido de 4+ dígitos, com ou sem parênteses
  const m = model.match(/\b(EQ\d{4,})\b/i);
  return m ? m[1].toUpperCase() : null;
}

/** Categorias que recebem campos extras de ótica */
const CATS_OTICA_EXTRA = new Set(["DOWNLIGHTS", "SPOTS"]);

// ─── Endpoint público para o Configurador ───────────────────────────────────
// Retorna todos os produtos no formato esperado pelo Configurador de Produtos
// GET /api/products/all  (sem autenticação — consumido pelo Configurador)
router.get("/all", async (_req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Cache-Control", "no-cache");

    const { items } = await listProducts({ limit: 10000, offset: 0 });
    // A API pública só transmite produtos ativos (ativo = true)
    const activeItems = items.filter((p: any) => p.ativo !== false);

    // Buscar TODOS os componentes da tabela components para lookup do campo codigo (EQ/CP)
    // Inclui drivers, óticas, holders, dissipadores e módulos LED
    const driverCodigoMap = new Map<string, string | null>();
    const componentsById = new Map<number, ComponentSummary>();
    const accessoriesById = new Map<number, AccessorySummary>();
    try {
      const db = await getDb();
      if (db) {
        const allComponents = await db
          .select({ id: componentsTable.id, tipo: componentsTable.tipo, modelo: componentsTable.modelo, codigo: componentsTable.codigo })
          .from(componentsTable);
        for (const d of allComponents) {
          if (d.modelo) {
            driverCodigoMap.set(d.modelo.trim().toUpperCase(), d.codigo ?? null);
            componentsById.set(d.id, { id: d.id, tipo: d.tipo, modelo: d.modelo, codigo: d.codigo ?? null });
          }
        }

        const allAccessories = await db
          .select({
            id: accessoriesTable.id,
            codigo: accessoriesTable.codigo,
            sku: accessoriesTable.sku,
            produto: accessoriesTable.produto,
            familia: accessoriesTable.familia,
          })
          .from(accessoriesTable);
        for (const accessory of allAccessories) {
          accessoriesById.set(accessory.id, {
            id: accessory.id,
            codigo: accessory.codigo ?? null,
            sku: accessory.sku ?? null,
            produto: accessory.produto ?? "",
            familia: accessory.familia ?? null,
          });
        }
      }
    } catch (err) {
      console.warn("[products/all] Falha ao buscar códigos de componentes:", err);
      // Não bloqueia o endpoint — makeDriver usará extractEqCode como fallback
    }

    const signedUrlMap = new Map<string, string>();
    const keysToSign = activeItems
      .flatMap((p: any) => {
        const documents = parseStoredProductDocuments(p.documentos);
        return [
          extractStorageKey(p.fotoUrl),
          ...Object.values(documents).map((document) => resolveStoredDocumentKey(document)),
        ];
      })
      .filter((k): k is string => !!k);
    const uniqueKeys = Array.from(new Set(keysToSign));

    await Promise.all(
      uniqueKeys.map(async (key) => {
        try {
          const publicUrl = await storageGetSignedUrl(key);
          signedUrlMap.set(key, publicUrl);
        } catch {
          // O endpoint /manus-storage continua resolvendo a chave por redirect;
          // manter esse fallback evita perder a foto na API quando o presign falha.
          signedUrlMap.set(key, `/manus-storage/${key}`);
        }
      })
    );

    // Mapear para o formato que o Configurador espera
    const formatted = activeItems.map((p) => {
      const rawKey = extractStorageKey(p.fotoUrl);
      const resolvedFotoUrl = rawKey ? (signedUrlMap.get(rawKey) ?? null) : null;
      const publicDocumentContract = buildPublicProductDocuments((p as any).documentos, signedUrlMap);
      const lightingContract = buildSpecialLightingContract(p as any, componentsById, accessoriesById);
      const usesStandardCct = lightingContract.modoIluminacao === "CCT";
      const temps: string[] = [];
      try {
        const parsed = JSON.parse(p.temperaturasCor || "[]");
        if (Array.isArray(parsed)) temps.push(...parsed);
      } catch {
        temps.push("2700", "3000", "3500", "4000", "5000");
      }

      // ── Quantidades dos componentes ──────────────────────────────────────
      const qtdLed    = Number((p as any).qtdModuloLed)  || 1;
      const qtdOtica  = Number((p as any).qtdOtica)      || 1;
      const qtdHolder = Number((p as any).qtdHolder)     || 1;
      const qtdDiss   = Number((p as any).qtdDissipador) || 1;

      // ── Campos base com quantidade embutida ──────────────────────────────
      const ledModuleVal = p.moduloLed ? withQty(p.moduloLed, qtdLed) : null;
      const holderVal    = p.holderNaoAplicavel ? null : withQty(p.holder, qtdHolder);
      const dissipadorVal = p.dissipadorNaoAplicavel ? null : withQty(p.dissipador, qtdDiss);

      // ── Ótica: montar campo otica com primária + secundárias ─────────────
      let oticaVal: string | null = null;
      let oticaPrimaria: string | null = null;
      let oticaSecundaria: string | null = null;

      if (!p.oticaNaoAplicavel && p.otica) {
        // Parsear extras
        let extras: Array<{ modelo: string; qtd: number }> = [];
        try {
          const raw = (p as any).oticaExtra;
          if (raw) extras = JSON.parse(raw);
        } catch { extras = []; }

        // Ótica primária com quantidade
        oticaPrimaria = withQty(p.otica, qtdOtica);

        if (extras.length > 0) {
          // Ótica secundária: concatenar todos os extras com " + "
          oticaSecundaria = extras
            .filter((e) => e.modelo?.trim())
            .map((e) => withQty(e.modelo, e.qtd || 1))
            .filter(Boolean)
            .join(" + ");
          if (!oticaSecundaria) oticaSecundaria = null;

          // Campo otica legado: primária + secundárias concatenadas
          const partes = [oticaPrimaria, oticaSecundaria].filter(Boolean);
          oticaVal = partes.join(" + ");
        } else {
          // Sem extras: otica = oticaPrimaria
          oticaVal = oticaPrimaria;
          oticaSecundaria = null;
        }
      }

      // ── Helpers para drivers com código EQ ──────────────────────────────
      // Verifica se um valor de driver é válido (não nulo e não "NÃO APLICÁVEL")
      const isValidDriver = (model: string | null | undefined): boolean => {
        if (!model) return false;
        const m = model.trim().toUpperCase();
        return m !== "NÃO APLICÁVEL" && m !== "NAO APLICAVEL" && m !== "NÃO ESPECIFICADO" && m !== "";
      };

      const makeDriver = (model: string | null | undefined) => {
        if (!isValidDriver(model)) return null;
        const trimmed = model!.trim();
        // Primeiro tenta buscar o codigo cadastrado na tabela components
        // Fallback: extrai EQ do nome do modelo via regex
        const codigoCadastrado = driverCodigoMap.get(trimmed.toUpperCase());
        const code = codigoCadastrado !== undefined
          ? codigoCadastrado  // pode ser null se o driver não tem codigo cadastrado
          : extractEqCode(model);  // fallback para regex
        return { model: trimmed, code };
      };

      const driver220Extras = parsePublicDriverExtras((p as any).driverOnoff220Extra, makeDriver);
      const driverBivoltExtras = parsePublicDriverExtras((p as any).driverOnoffBivoltExtra, makeDriver);
      const driverDim110vExtras = parsePublicDriverExtras((p as any).driverDim110vExtra, makeDriver);
      const driverDimDaliExtras = parsePublicDriverExtras((p as any).driverDimDaliExtra, makeDriver);
      const driverDimTriac110vExtras = parsePublicDriverExtras((p as any).driverDimTriac110vExtra, makeDriver);
      const driverDimTriac220vExtras = parsePublicDriverExtras((p as any).driverDimTriac220vExtra, makeDriver);

      const cat = (p.categoria || "").toUpperCase();
      const includeOticaExtras = CATS_OTICA_EXTRA.has(cat);

      const result: Record<string, any> = {
        instalacao: p.instalacao,
        familia: p.familia,
        sku: p.sku,
        name: p.produto,
        categoria: p.categoria || null,
        holder: holderVal,
        otica: oticaVal,
        dissipador: dissipadorVal,
        ledModule: usesStandardCct ? ledModuleVal : null,
        fotoUrl: resolvedFotoUrl,
        ...publicDocumentContract,
        temperaturasCor: lightingContract.modoIluminacao === "RGBW" ? ["RGBW"] : usesStandardCct ? temps : [],
        driver220: isValidDriver(p.driverOnoff220) ? makeDriver(p.driverOnoff220) : null,
        driverBivolt: (p.driverOnoffBivoltNaoAplicavel || !isValidDriver(p.driverOnoffBivolt))
          ? null
          : makeDriver(p.driverOnoffBivolt),
        driverDim110v: (p.driverDim110vNaoAplicavel || !isValidDriver(p.driverDim110v))
          ? null
          : makeDriver(p.driverDim110v),
        driverDimDali: (p.driverDimDaliNaoAplicavel || !isValidDriver(p.driverDimDali))
          ? null
          : makeDriver(p.driverDimDali),
        driverDimTriac110v: ((p as any).driverDimTriac110vNaoAplicavel || !isValidDriver((p as any).driverDimTriac110v))
          ? null
          : makeDriver((p as any).driverDimTriac110v),
        driverDimTriac220v: ((p as any).driverDimTriac220vNaoAplicavel || !isValidDriver((p as any).driverDimTriac220v))
          ? null
          : makeDriver((p as any).driverDimTriac220v),
        driver220Extras,
        driverBivoltExtras,
        driverDim110vExtras,
        driverDimDaliExtras,
        driverDimTriac110vExtras,
        driverDimTriac220vExtras,
        driversExtras: {
          onoff220: driver220Extras,
          onoffBivolt: driverBivoltExtras,
          dim110v: driverDim110vExtras,
          dimDali: driverDimDaliExtras,
          dimTriac110v: driverDimTriac110vExtras,
          dimTriac220v: driverDimTriac220vExtras,
        },
        custoLuminaria: p.custoLuminaria ? Number(p.custoLuminaria) : null,
        custoDriver220: (p as any).custoDriverOnoff220 ? Number((p as any).custoDriverOnoff220) : null,
        custoDriverBivolt: (p as any).custoDriverOnoffBivolt ? Number((p as any).custoDriverOnoffBivolt) : null,
        custoDriverDim110v: (p as any).custoDriverDim110v ? Number((p as any).custoDriverDim110v) : null,
        custoDriverDimDali: (p as any).custoDriverDimDali ? Number((p as any).custoDriverDimDali) : null,
        custoDriverDimTriac110v: (p as any).custoDriverDimTriac110v ? Number((p as any).custoDriverDimTriac110v) : null,
        custoDriverDimTriac220v: (p as any).custoDriverDimTriac220v ? Number((p as any).custoDriverDimTriac220v) : null,
        // Custo do corpo por tipo de driver (sem driver) + markups (nomenclatura interna mkp*)
        custoCorpoOnoff220v: (p as any).custoCorpoOnoff220v ? Number((p as any).custoCorpoOnoff220v) : null,
        mkpPadraoOnoff220v: (p as any).mkpPadraoOnoff220v ? Number((p as any).mkpPadraoOnoff220v) : null,
        mkpMinimoOnoff220v: (p as any).mkpMinimoOnoff220v ? Number((p as any).mkpMinimoOnoff220v) : null,
        custoCorpoOnoffBivolt: (p as any).custoCorpoOnoffBivolt ? Number((p as any).custoCorpoOnoffBivolt) : null,
        mkpPadraoOnoffBivolt: (p as any).mkpPadraoOnoffBivolt ? Number((p as any).mkpPadraoOnoffBivolt) : null,
        mkpMinimoOnoffBivolt: (p as any).mkpMinimoOnoffBivolt ? Number((p as any).mkpMinimoOnoffBivolt) : null,
        custoCorpoDim110v: (p as any).custoCorpoDim110v ? Number((p as any).custoCorpoDim110v) : null,
        mkpPadraoDim110v: (p as any).mkpPadraoDim110v ? Number((p as any).mkpPadraoDim110v) : null,
        mkpMinimoDim110v: (p as any).mkpMinimoDim110v ? Number((p as any).mkpMinimoDim110v) : null,
        custoCorpoDimDali: (p as any).custoCorpoDimDali ? Number((p as any).custoCorpoDimDali) : null,
        mkpPadraoDimDali: (p as any).mkpPadraoDimDali ? Number((p as any).mkpPadraoDimDali) : null,
        mkpMinimoDimDali: (p as any).mkpMinimoDimDali ? Number((p as any).mkpMinimoDimDali) : null,
        custoCorpoDimTriac110v: (p as any).custoCorpoDimTriac110v ? Number((p as any).custoCorpoDimTriac110v) : null,
        mkpPadraoDimTriac110v: (p as any).mkpPadraoDimTriac110v ? Number((p as any).mkpPadraoDimTriac110v) : null,
        mkpMinimoDimTriac110v: (p as any).mkpMinimoDimTriac110v ? Number((p as any).mkpMinimoDimTriac110v) : null,
        custoCorpoDimTriac220v: (p as any).custoCorpoDimTriac220v ? Number((p as any).custoCorpoDimTriac220v) : null,
        mkpPadraoDimTriac220v: (p as any).mkpPadraoDimTriac220v ? Number((p as any).mkpPadraoDimTriac220v) : null,
        mkpMinimoDimTriac220v: (p as any).mkpMinimoDimTriac220v ? Number((p as any).mkpMinimoDimTriac220v) : null,
        // ── Campos de markup com nomenclatura esperada pelo Sistema Luna ──────
        // markupPadrao* / markupMinimo* — aliases dos campos mkp* acima
        markupPadraoOnoff220v:    (p as any).mkpPadraoOnoff220v    ? Number((p as any).mkpPadraoOnoff220v)    : null,
        markupMinimoOnoff220v:    (p as any).mkpMinimoOnoff220v    ? Number((p as any).mkpMinimoOnoff220v)    : null,
        markupPadraoOnoffBivolt:  (p as any).mkpPadraoOnoffBivolt  ? Number((p as any).mkpPadraoOnoffBivolt)  : null,
        markupMinimoOnoffBivolt:  (p as any).mkpMinimoOnoffBivolt  ? Number((p as any).mkpMinimoOnoffBivolt)  : null,
        markupPadraoDim110v:      (p as any).mkpPadraoDim110v      ? Number((p as any).mkpPadraoDim110v)      : null,
        markupMinimoDim110v:      (p as any).mkpMinimoDim110v      ? Number((p as any).mkpMinimoDim110v)      : null,
        markupPadraoDimDali:      (p as any).mkpPadraoDimDali      ? Number((p as any).mkpPadraoDimDali)      : null,
        markupMinimoDimDali:      (p as any).mkpMinimoDimDali      ? Number((p as any).mkpMinimoDimDali)      : null,
        markupPadraoDimTriac110v: (p as any).mkpPadraoDimTriac110v ? Number((p as any).mkpPadraoDimTriac110v) : null,
        markupMinimoDimTriac110v: (p as any).mkpMinimoDimTriac110v ? Number((p as any).mkpMinimoDimTriac110v) : null,
        markupPadraoDimTriac220v: (p as any).mkpPadraoDimTriac220v ? Number((p as any).mkpPadraoDimTriac220v) : null,
        markupMinimoDimTriac220v: (p as any).mkpMinimoDimTriac220v ? Number((p as any).mkpMinimoDimTriac220v) : null,
        // Markup do driver por tipo de controle
        markupPadraoDriverOnoff220v:    (p as any).mkpPadraoDriverOnoff220v    ? Number((p as any).mkpPadraoDriverOnoff220v)    : null,
        markupPadraoDriverOnoffBivolt:  (p as any).mkpPadraoDriverOnoffBivolt  ? Number((p as any).mkpPadraoDriverOnoffBivolt)  : null,
        markupPadraoDriverDim110v:      (p as any).mkpPadraoDriverDim110v      ? Number((p as any).mkpPadraoDriverDim110v)      : null,
        markupPadraoDriverDimDali:      (p as any).mkpPadraoDriverDimDali      ? Number((p as any).mkpPadraoDriverDimDali)      : null,
        markupPadraoDriverDimTriac110v: (p as any).mkpPadraoDriverDimTriac110v ? Number((p as any).mkpPadraoDriverDimTriac110v) : null,
        markupPadraoDriverDimTriac220v: (p as any).mkpPadraoDriverDimTriac220v ? Number((p as any).mkpPadraoDriverDimTriac220v) : null,
        // Markup mínimo do driver — valor global fixo (padrão 3.0)
        markupMinimoDriver: (p as any).mkpMinimoDriver ? Number((p as any).mkpMinimoDriver) : 3,
        // Custo do corpo D1+D2 (apenas para PERFIS com iluminação direta + indireta)
        custoCorpoOnoff220vD1D2:    (p as any).custoCorpoOnoff220vD1D2    ? Number((p as any).custoCorpoOnoff220vD1D2)    : null,
        custoCorpoOnoffBivoltD1D2:  (p as any).custoCorpoOnoffBivoltD1D2  ? Number((p as any).custoCorpoOnoffBivoltD1D2)  : null,
        custoCorpoDim110vD1D2:      (p as any).custoCorpoDim110vD1D2      ? Number((p as any).custoCorpoDim110vD1D2)      : null,
        custoCorpoDimDaliD1D2:      (p as any).custoCorpoDimDaliD1D2      ? Number((p as any).custoCorpoDimDaliD1D2)      : null,
        custoCorpoDimTriac110vD1D2: (p as any).custoCorpoDimTriac110vD1D2 ? Number((p as any).custoCorpoDimTriac110vD1D2) : null,
        custoCorpoDimTriac220vD1D2: (p as any).custoCorpoDimTriac220vD1D2 ? Number((p as any).custoCorpoDimTriac220vD1D2) : null,
      };

      // oticaPrimaria e oticaSecundaria: sempre retornados (não apenas DOWNLIGHTS/SPOTS)
      result.oticaPrimaria = oticaPrimaria;
      result.oticaSecundaria = oticaSecundaria;

      // Quantidades numéricas explícitas para ledModule e holder
      result.ledModuleQtd = usesStandardCct && p.moduloLed ? qtdLed : null;
      result.holderQtd = p.holderNaoAplicavel ? null : qtdHolder;

      // ── Códigos EQ/CP de ótica, holder e dissipador ───────────────────────────────────────────
      const lookupCode = (name: string | null | undefined): string | null => {
        if (!name) return null;
        const key = name.trim().toUpperCase();
        if (key === 'NÃO APLICÁVEL' || key === 'NAO APLICAVEL' || key === 'NÃO ESPECIFICADO') return null;
        const cached = driverCodigoMap.get(key);
        return cached !== undefined ? cached : extractEqCode(name);
      };
      result.oticaCode = p.oticaNaoAplicavel ? null : lookupCode(p.otica);
      result.holderCode = p.holderNaoAplicavel ? null : lookupCode(p.holder);
      result.dissipadorCode = p.dissipadorNaoAplicavel ? null : lookupCode(p.dissipador);
      result.ledModuleCode = usesStandardCct && p.moduloLed ? lookupCode(p.moduloLed) : null;

      // ── Módulo LED por CCT ────────────────────────────────────────────────────────────────────────────────────
      const ml2700 = (p as any).moduloLed2700 as string | null;
      const ml3000 = (p as any).moduloLed3000 as string | null;
      const ml3500 = (p as any).moduloLed3500 as string | null;
      const ml4000 = (p as any).moduloLed4000 as string | null;
      const ml5000 = (p as any).moduloLed5000 as string | null;
      const hasCctModules = !!(ml2700 || ml3000 || ml3500 || ml4000 || ml5000);

      result.ledModule2700 = usesStandardCct && ml2700 ? withQty(ml2700, Number((p as any).qtdModuloLed2700) || 1) : null;
      result.ledModule3000 = usesStandardCct && ml3000 ? withQty(ml3000, Number((p as any).qtdModuloLed3000) || 1) : null;
      result.ledModule3500 = usesStandardCct && ml3500 ? withQty(ml3500, Number((p as any).qtdModuloLed3500) || 1) : null;
      result.ledModule4000 = usesStandardCct && ml4000 ? withQty(ml4000, Number((p as any).qtdModuloLed4000) || 1) : null;
      result.ledModule5000 = usesStandardCct && ml5000 ? withQty(ml5000, Number((p as any).qtdModuloLed5000) || 1) : null;
      result.ledModuleQtd2700 = usesStandardCct && ml2700 ? (Number((p as any).qtdModuloLed2700) || 1) : null;
      result.ledModuleQtd3000 = usesStandardCct && ml3000 ? (Number((p as any).qtdModuloLed3000) || 1) : null;
      result.ledModuleQtd3500 = usesStandardCct && ml3500 ? (Number((p as any).qtdModuloLed3500) || 1) : null;
      result.ledModuleQtd4000 = usesStandardCct && ml4000 ? (Number((p as any).qtdModuloLed4000) || 1) : null;
      result.ledModuleQtd5000 = usesStandardCct && ml5000 ? (Number((p as any).qtdModuloLed5000) || 1) : null;
      // Códigos EQ/CP dos módulos LED por CCT
      result.ledModuleCode2700 = usesStandardCct && ml2700 ? lookupCode(ml2700) : null;
      result.ledModuleCode3000 = usesStandardCct && ml3000 ? lookupCode(ml3000) : null;
      result.ledModuleCode3500 = usesStandardCct && ml3500 ? lookupCode(ml3500) : null;
      result.ledModuleCode4000 = usesStandardCct && ml4000 ? lookupCode(ml4000) : null;
      result.ledModuleCode5000 = usesStandardCct && ml5000 ? lookupCode(ml5000) : null;

      // CCTs adicionais, específicos deste produto. Mantém os campos legados acima
      // intactos e envia uma coleção estruturada para o Configurador.
      let rawLedModulesExtras: unknown[] = [];
      try {
        const raw = (p as any).moduloLedExtra;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) rawLedModulesExtras = parsed;
      } catch {
        rawLedModulesExtras = [];
      }
      const seenExtraCcts = new Set<string>();
      const ledModulesExtras = rawLedModulesExtras
        .map((item) => {
          const row = (item ?? {}) as Record<string, unknown>;
          const cct = String(row.cct ?? "").replace(/\D/g, "");
          const model = String(row.modelo ?? "").trim();
          const qtd = Math.max(0.01, Number(row.qtd) || 1);
          return { cct, model, qtd, code: model ? lookupCode(model) : null };
        })
        .filter((item) => {
          const cctNumerico = Number(item.cct);
          const valido = !!item.model && Number.isInteger(cctNumerico) && cctNumerico >= 1000 && cctNumerico <= 10000;
          if (!valido || seenExtraCcts.has(item.cct)) return false;
          seenExtraCcts.add(item.cct);
          return true;
        });
      result.ledModulesExtras = usesStandardCct ? ledModulesExtras : [];

      // Derivar temperaturasCor automaticamente dos módulos preenchidos
      // Se o produto usa o novo modelo CCT, sobrescreve o campo temperaturasCor
      if (usesStandardCct && (hasCctModules || ledModulesExtras.length > 0)) {
        const derivedTemps: string[] = [];
        if (ml2700) derivedTemps.push("2700");
        if (ml3000) derivedTemps.push("3000");
        if (ml3500) derivedTemps.push("3500");
        if (ml4000) derivedTemps.push("4000");
        if (ml5000) derivedTemps.push("5000");
        derivedTemps.push(...ledModulesExtras.map((item) => item.cct));
        result.temperaturasCor = derivedTemps;
      }

      // Flags de modo especial de módulo
      result.moduloRgbw = !!(p as any).moduloRgbw;
      result.moduloLampada = !!(p as any).moduloLampada;
      result.moduloLedRgbw = (p as any).moduloLedRgbw || null;
      result.moduloLedRgbwCode = (p as any).moduloLedRgbw ? lookupCode((p as any).moduloLedRgbw) : null;
      result.qtdModuloLedRgbw = (p as any).qtdModuloLedRgbw ? Number((p as any).qtdModuloLedRgbw) : null;
      Object.assign(result, lightingContract);

      // Campos de preço por metro linear para categoria PERFIS
      // Retorna null quando o controle não está disponível para o produto
      const isPerfil = cat === "PERFIS";
      result.precoOnOff220 = isPerfil
        ? (isValidDriver(p.driverOnoff220) && (p as any).precoVendaOnoff220 != null
            ? Number((p as any).precoVendaOnoff220)
            : null)
        : null;
      result.precoOnOffBivolt = isPerfil
        ? (!p.driverOnoffBivoltNaoAplicavel && isValidDriver(p.driverOnoffBivolt) && (p as any).precoVendaOnoffBivolt != null
            ? Number((p as any).precoVendaOnoffBivolt)
            : null)
        : null;
      result.precoDim110v = isPerfil
        ? (!p.driverDim110vNaoAplicavel && isValidDriver(p.driverDim110v) && (p as any).precoVendaDim110v != null
            ? Number((p as any).precoVendaDim110v)
            : null)
        : null;
      result.precoDimDali = isPerfil
        ? (!p.driverDimDaliNaoAplicavel && isValidDriver(p.driverDimDali) && (p as any).precoVendaDimDali != null
            ? Number((p as any).precoVendaDimDali)
            : null)
        : null;

      // Configuração de planos
      const configuracaoPlanos = (p as any).configuracaoPlanos ?? null;
      result.configuracaoPlanos = isPerfil ? configuracaoPlanos : null;
      result.possuiOpcaoD1D2 = isPerfil ? !!(p as any).possuiOpcaoD1D2 : false;

      // Composição D1+D2 (módulo LED dobrado + drivers específicos)
      if (isPerfil && (p as any).composicaoD1D2) {
        try {
          const raw = (p as any).composicaoD1D2;
          const comp = typeof raw === "string" ? JSON.parse(raw) : raw;
          result.composicaoD1D2 = comp;
        } catch {
          result.composicaoD1D2 = null;
        }
      } else {
        result.composicaoD1D2 = null;
      }

      // Preços D1/D1+D2 — exclusivo para PERFIS com dois planos de iluminação
      const toNum = (v: any) => (v != null ? Number(v) : null);
      result.precoOnOff220D1      = isPerfil ? toNum((p as any).precoVendaOnoff220D1)      : null;
      result.precoOnOff220D1D2    = isPerfil ? toNum((p as any).precoVendaOnoff220D1D2)    : null;
      result.precoOnOffBivoltD1   = isPerfil ? toNum((p as any).precoVendaOnoffBivoltD1)   : null;
      result.precoOnOffBivoltD1D2 = isPerfil ? toNum((p as any).precoVendaOnoffBivoltD1D2) : null;
      result.precoDim110vD1       = isPerfil ? toNum((p as any).precoVendaDim110vD1)       : null;
      result.precoDim110vD1D2     = isPerfil ? toNum((p as any).precoVendaDim110vD1D2)     : null;
      result.precoDimDaliD1       = isPerfil ? toNum((p as any).precoVendaDimDaliD1)       : null;
      result.precoDimDaliD1D2     = isPerfil ? toNum((p as any).precoVendaDimDaliD1D2)     : null;

      // Preço resolvido automaticamente com base em configuracaoPlanos
      // Se D1+D2 → usa campos D1D2; se D1, D2 ou null → usa campos padrão
      if (isPerfil) {
        const isD1D2 = configuracaoPlanos === "D1+D2";
        result.precoOnOff220     = isD1D2 ? toNum((p as any).precoVendaOnoff220D1D2)    : toNum((p as any).precoVendaOnoff220);
        result.precoOnOffBivolt  = isD1D2 ? toNum((p as any).precoVendaOnoffBivoltD1D2) : toNum((p as any).precoVendaOnoffBivolt);
        result.precoDim110v      = isD1D2 ? toNum((p as any).precoVendaDim110vD1D2)     : toNum((p as any).precoVendaDim110v);
        result.precoDimDali      = isD1D2 ? toNum((p as any).precoVendaDimDaliD1D2)     : toNum((p as any).precoVendaDimDali);
      }

      // Quantidades numéricas de drivers
      result.driverQtd220 = isValidDriver(p.driverOnoff220)
        ? (p.qtdDriverOnoff220 != null ? Number(p.qtdDriverOnoff220) : 1)
        : null;
      result.driverQtdBivolt = (!p.driverOnoffBivoltNaoAplicavel && isValidDriver(p.driverOnoffBivolt))
        ? (p.qtdDriverOnoffBivolt != null ? Number(p.qtdDriverOnoffBivolt) : 1)
        : null;
      result.driverQtdDim110v = (!p.driverDim110vNaoAplicavel && isValidDriver(p.driverDim110v))
        ? (p.qtdDriverDim110v != null ? Number(p.qtdDriverDim110v) : 1)
        : null;
      result.driverQtdDimDali = (!p.driverDimDaliNaoAplicavel && isValidDriver(p.driverDimDali))
        ? (p.qtdDriverDimDali != null ? Number(p.qtdDriverDimDali) : 1)
        : null;
      result.driverQtdDimTriac110v = (!(p as any).driverDimTriac110vNaoAplicavel && isValidDriver((p as any).driverDimTriac110v))
        ? ((p as any).qtdDriverDimTriac110v != null ? Number((p as any).qtdDriverDimTriac110v) : 1)
        : null;
      result.driverQtdDimTriac220v = (!(p as any).driverDimTriac220vNaoAplicavel && isValidDriver((p as any).driverDimTriac220v))
        ? ((p as any).qtdDriverDimTriac220v != null ? Number((p as any).qtdDriverDimTriac220v) : 1)
        : null;
      // Corrente de programação do driver
      result.correnteDriver = (p as any).correnteDriver ?? null;

      return result;
    });

    return res.json({
      count: formatted.length,
      available: formatted.length,
      products: formatted,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[products/all]", err);
    return res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

export default router;
