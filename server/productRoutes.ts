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
router.post("/import-excel", uploadExcel.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const allProducts: any[] = [];

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      // Tentar encontrar a linha de cabeçalho
      let data: any[] = [];
      try {
        // Primeiro tenta com header na linha 5 (índice 4) como no arquivo original
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        let headerRow = -1;
        for (let i = 0; i < Math.min(rawData.length, 10); i++) {
          const row = rawData[i];
          if (row && row.some((cell: any) => String(cell || "").includes("SKU") || String(cell || "").includes("PRODUTO"))) {
            headerRow = i;
            break;
          }
        }
        if (headerRow >= 0) {
          data = XLSX.utils.sheet_to_json(ws, { range: headerRow }) as any[];
        } else {
          data = XLSX.utils.sheet_to_json(ws) as any[];
        }
      } catch {
        data = XLSX.utils.sheet_to_json(ws) as any[];
      }

      for (const row of data) {
        const sku = String(row["SKU"] || row["sku"] || "").trim();
        const produto = String(row["PRODUTO"] || row["produto"] || "").trim();
        if (!sku || !produto || sku === "SKU") continue;

        const oticaRaw = String(row["ÓTICA"] || row["OTICA"] || row["Ótica"] || "").trim().toUpperCase();
        const holderRaw = String(row["HOLDER"] || row["holder"] || "").trim().toUpperCase();
        const dissipadorRaw = String(row["DISSIPADOR"] || row["dissipador"] || "").trim().toUpperCase();

        allProducts.push({
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
          driverDim110v: String(row["DIM 1-10V"] || "").trim().toUpperCase() || null,
          driverDimDali: String(row["DIM DALI"] || "").trim().toUpperCase() || null,
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
    }

    if (allProducts.length === 0) {
      return res.status(400).json({ error: "Nenhum produto válido encontrado no arquivo" });
    }

    const inserted = await bulkInsertProducts(allProducts);
    return res.json({ success: true, inserted, total: allProducts.length });
  } catch (err) {
    console.error("[import-excel]", err);
    return res.status(500).json({ error: "Erro ao importar Excel: " + String(err) });
  }
});

export default router;
