import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { storagePut, storageGetSignedUrl } from "./storage";
import { bulkInsertProducts, listProducts, getDb } from "./db";
import { components as componentsTable } from "../drizzle/schema";
import { inArray } from "drizzle-orm";

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

// ─── Upload de imagem ─────────────────────────────────────────────────────────
router.post("/upload-image", uploadImage.single("file"), async (req, res) => {
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

// ─── Exportação Excel ─────────────────────────────────────────────────────────
router.get("/export-excel", async (_req, res) => {
  try {
    const { items } = await listProducts({ limit: 5000, offset: 0 });

    const rows = items.map((p) => ({
      CATEGORIA: p.categoria || "",
      INSTALAÇÃO: p.instalacao,
      SKU: p.sku,
      FAMÍLIA: p.familia,
      PRODUTO: p.produto,
      "MÓDULO LED": p.moduloLed,
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
      temperaturasCor: '["2700","3000","4000","5000"]',
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

    products.push({
      categoria: String(row["CATEGORIA"] || sheetName || "").trim().toUpperCase(),
      instalacao: String(row["INSTALAÇÃO"] || row["INSTALACAO"] || "").trim().toUpperCase(),
      familia: String(row["FAMÍLIA"] || row["FAMILIA"] || "").trim().toUpperCase(),
      sku: sku.toUpperCase(),
      produto: produto.toUpperCase(),
      moduloLed: String(row["MÓDULO LED"] || row["MODULO LED"] || "").trim().toUpperCase(),
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
      temperaturasCor: '["2700","3000","4000","5000"]',
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
      temperaturasCor: '["2700","3000","4000","5000"]',
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

router.post("/import-excel", uploadExcel.single("file"), async (req, res) => {
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

    // Buscar todos os drivers da tabela components para lookup do campo codigo (EQ)
    // Cria um Map de modelo (uppercase) -> codigo para uso no makeDriver
    const driverCodigoMap = new Map<string, string | null>();
    try {
      const db = await getDb();
      if (db) {
        const driverTipos = [
          "DRIVER_ONOFF_220",
          "DRIVER_ONOFF_BIVOLT",
          "DRIVER_DIM_110V",
          "DRIVER_DIM_DALI",
          "DRIVER_DIM_TRIAC_110V",
          "DRIVER_DIM_TRIAC_220V",
        ] as const;
        const allDrivers = await db
          .select({ modelo: componentsTable.modelo, codigo: componentsTable.codigo })
          .from(componentsTable)
          .where(inArray(componentsTable.tipo, driverTipos as any));
        for (const d of allDrivers) {
          driverCodigoMap.set(d.modelo.trim().toUpperCase(), d.codigo ?? null);
        }
      }
    } catch (err) {
      console.warn("[products/all] Falha ao buscar códigos de drivers:", err);
      // Não bloqueia o endpoint — makeDriver usará extractEqCode como fallback
    }

    // Resolver URLs públicas do S3 para todos os produtos com foto em paralelo
    const extractKey = (url: string | null | undefined): string | null => {
      if (!url) return null;
      // Suporta tanto "/manus-storage/{key}" quanto chaves diretas
      const match = url.match(/^\/manus-storage\/(.+)$/);
      return match ? match[1] : (url.startsWith("http") ? null : url);
    };

    const signedUrlMap = new Map<string, string>();
    const keysToSign = items
      .map((p) => extractKey(p.fotoUrl))
      .filter((k): k is string => !!k);
    const uniqueKeys = Array.from(new Set(keysToSign));

    await Promise.all(
      uniqueKeys.map(async (key) => {
        try {
          const publicUrl = await storageGetSignedUrl(key);
          signedUrlMap.set(key, publicUrl);
        } catch {
          // Se falhar, mantém null — não bloqueia o endpoint
        }
      })
    );

    // Mapear para o formato que o Configurador espera
    const formatted = items.map((p) => {
      const rawKey = extractKey(p.fotoUrl);
      const resolvedFotoUrl = rawKey ? (signedUrlMap.get(rawKey) ?? null) : null;
      const temps: string[] = [];
      try {
        const parsed = JSON.parse(p.temperaturasCor || "[]");
        if (Array.isArray(parsed)) temps.push(...parsed);
      } catch {
        temps.push("2700", "3000", "4000", "5000");
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
        ledModule: ledModuleVal,
        fotoUrl: resolvedFotoUrl,
        temperaturasCor: temps,
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
        custoLuminaria: p.custoLuminaria ? Number(p.custoLuminaria) : null,
        custoDriver220: (p as any).custoDriverOnoff220 ? Number((p as any).custoDriverOnoff220) : null,
        custoDriverBivolt: (p as any).custoDriverOnoffBivolt ? Number((p as any).custoDriverOnoffBivolt) : null,
        custoDriverDim110v: (p as any).custoDriverDim110v ? Number((p as any).custoDriverDim110v) : null,
        custoDriverDimDali: (p as any).custoDriverDimDali ? Number((p as any).custoDriverDimDali) : null,
        custoDriverDimTriac110v: (p as any).custoDriverDimTriac110v ? Number((p as any).custoDriverDimTriac110v) : null,
        custoDriverDimTriac220v: (p as any).custoDriverDimTriac220v ? Number((p as any).custoDriverDimTriac220v) : null,
      };

      // oticaPrimaria e oticaSecundaria: sempre retornados (não apenas DOWNLIGHTS/SPOTS)
      result.oticaPrimaria = oticaPrimaria;
      result.oticaSecundaria = oticaSecundaria;

      // Quantidades numéricas explícitas para ledModule e holder
      result.ledModuleQtd = p.moduloLed ? qtdLed : null;
      result.holderQtd = p.holderNaoAplicavel ? null : qtdHolder;

      // ── Módulo LED por CCT ────────────────────────────────────────────────
      const ml2700 = (p as any).moduloLed2700 as string | null;
      const ml3000 = (p as any).moduloLed3000 as string | null;
      const ml4000 = (p as any).moduloLed4000 as string | null;
      const ml5000 = (p as any).moduloLed5000 as string | null;
      const hasCctModules = !!(ml2700 || ml3000 || ml4000 || ml5000);

      result.ledModule2700 = ml2700 ? withQty(ml2700, Number((p as any).qtdModuloLed2700) || 1) : null;
      result.ledModule3000 = ml3000 ? withQty(ml3000, Number((p as any).qtdModuloLed3000) || 1) : null;
      result.ledModule4000 = ml4000 ? withQty(ml4000, Number((p as any).qtdModuloLed4000) || 1) : null;
      result.ledModule5000 = ml5000 ? withQty(ml5000, Number((p as any).qtdModuloLed5000) || 1) : null;
      result.ledModuleQtd2700 = ml2700 ? (Number((p as any).qtdModuloLed2700) || 1) : null;
      result.ledModuleQtd3000 = ml3000 ? (Number((p as any).qtdModuloLed3000) || 1) : null;
      result.ledModuleQtd4000 = ml4000 ? (Number((p as any).qtdModuloLed4000) || 1) : null;
      result.ledModuleQtd5000 = ml5000 ? (Number((p as any).qtdModuloLed5000) || 1) : null;

      // Derivar temperaturasCor automaticamente dos módulos preenchidos
      // Se o produto usa o novo modelo CCT, sobrescreve o campo temperaturasCor
      if (hasCctModules) {
        const derivedTemps: string[] = [];
        if (ml2700) derivedTemps.push("2700");
        if (ml3000) derivedTemps.push("3000");
        if (ml4000) derivedTemps.push("4000");
        if (ml5000) derivedTemps.push("5000");
        result.temperaturasCor = derivedTemps;
      }

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
