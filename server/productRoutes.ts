import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { storagePut } from "./storage";
import { bulkInsertProducts, listProducts } from "./db";

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
    const categoria = String(row[colIdx["Categoria"] ?? 3] || "PERFIS LINEARES LED").trim().toUpperCase();
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
      } else {
        // Formato padrão do Cadastro
        const produtos = parseFormatoPadrao(ws, sheetName);
        allProducts.push(...produtos);
      }
    }

    if (allProducts.length === 0) {
      return res.status(400).json({ error: "Nenhum produto válido encontrado no arquivo. Verifique se a planilha segue o formato padrão do Cadastro ou o formato do Configurador de Produtos." });
    }

    const inserted = await bulkInsertProducts(allProducts);
    return res.json({ success: true, inserted, total: allProducts.length, formato: formatoDetectado });
  } catch (err) {
    console.error("[import-excel]", err);
    return res.status(500).json({ error: "Erro ao importar Excel: " + String(err) });
  }
});

// ─── Endpoint público para o Configurador ───────────────────────────────────
// Retorna todos os produtos no formato esperado pelo Configurador de Produtos
// GET /api/products/all  (sem autenticação — consumido pelo Configurador)
router.get("/all", async (_req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Cache-Control", "no-cache");

    const { items } = await listProducts({ limit: 10000, offset: 0 });

    // Mapear para o formato que o Configurador espera
    const formatted = items.map((p) => {
      const temps: string[] = [];
      try {
        const parsed = JSON.parse(p.temperaturasCor || "[]");
        if (Array.isArray(parsed)) temps.push(...parsed);
      } catch {
        temps.push("2700", "3000", "4000", "5000");
      }

      return {
        instalacao: p.instalacao,
        familia: p.familia,
        sku: p.sku,
        name: p.produto,
        categoria: p.categoria || null,
        holder: p.holderNaoAplicavel ? null : (p.holder || null),
        otica: p.oticaNaoAplicavel ? null : (p.otica || null),
        dissipador: p.dissipadorNaoAplicavel ? null : (p.dissipador || null),
        ledModule: p.moduloLed,
        fotoUrl: p.fotoUrl || null,
        temperaturasCor: temps,
        driver220: p.driverOnoff220
          ? { model: p.driverOnoff220, code: null }
          : null,
        driverBivolt: p.driverOnoffBivoltNaoAplicavel
          ? null
          : p.driverOnoffBivolt
            ? { model: p.driverOnoffBivolt, code: null }
            : null,
        driverDim110v: p.driverDim110vNaoAplicavel
          ? null
          : p.driverDim110v
            ? { model: p.driverDim110v, code: null }
            : null,
        driverDimDali: p.driverDimDaliNaoAplicavel
          ? null
          : p.driverDimDali
            ? { model: p.driverDimDali, code: null }
            : null,
        custoLuminaria: p.custoLuminaria ? Number(p.custoLuminaria) : null,
        custoDriver220: (p as any).custoDriverOnoff220 ? Number((p as any).custoDriverOnoff220) : null,
        custoDriverBivolt: (p as any).custoDriverOnoffBivolt ? Number((p as any).custoDriverOnoffBivolt) : null,
        custoDriverDim110v: (p as any).custoDriverDim110v ? Number((p as any).custoDriverDim110v) : null,
        custoDriverDimDali: (p as any).custoDriverDimDali ? Number((p as any).custoDriverDimDali) : null,
      };
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
