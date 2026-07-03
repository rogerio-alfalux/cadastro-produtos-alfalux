import express from "express";
import multer from "multer";
import { getDb } from "./db";
import { accessories, components as componentsTable } from "../drizzle/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { storagePut, storageGetSignedUrl } from "./storage";

const router = express.Router();

// Extrai a chave do storage a partir de um fotoUrl (/manus-storage/<key>)
function extractStorageKey(fotoUrl: string): string | null {
  const match = fotoUrl.match(/^\/manus-storage\/(.+)$/);
  return match ? match[1] : null;
}

// ─── Multer para upload de imagem ────────────────────────────────────────────
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos JPEG, JPG, PNG e WEBP são aceitos"));
    }
  },
});

// ─── Endpoint: Upload de foto de acessório ───────────────────────────────────
// POST /api/acessorios/upload-foto
router.post("/upload-foto", uploadImage.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "jpg";
    const key = `accessories/photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);

    return res.json({ url, key });
  } catch (err) {
    console.error("[acessorios/upload-foto]", err);
    return res.status(500).json({ error: "Erro ao fazer upload da imagem" });
  }
});

// ─── Endpoint: Excluir foto de acessório ─────────────────────────────────────
// DELETE /api/acessorios/:id/foto
router.delete("/:id/foto", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Banco de dados indisponível" });

    await db
      .update(accessories)
      .set({ fotoUrl: null, fotoKey: null })
      .where(eq(accessories.id, id));

    return res.json({ success: true });
  } catch (err) {
    console.error("[acessorios/delete-foto]", err);
    return res.status(500).json({ error: "Erro ao excluir foto" });
  }
});

// ─── Endpoint público para o Configurador ───────────────────────────────────
// GET /api/acessorios/all  (sem autenticação — consumido pelo Configurador)
router.get("/all", async (_req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Cache-Control", "no-cache");

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Banco de dados indisponível" });
    }

    const items = await db
      .select()
      .from(accessories)
      .orderBy(asc(accessories.familia), asc(accessories.codigo));

    // Buscar drivers e fontes da tabela components para incluir como acessórios
    const DRIVER_TIPOS = [
      "DRIVER_ONOFF_220",
      "DRIVER_ONOFF_BIVOLT",
      "DRIVER_DIM_110V",
      "DRIVER_DIM_DALI",
      "DRIVER_DIM_TRIAC_110V",
      "DRIVER_DIM_TRIAC_220V",
    ] as const;
    const drivers = await db
      .select()
      .from(componentsTable)
      .where(inArray(componentsTable.tipo, DRIVER_TIPOS as any))
      .orderBy(asc(componentsTable.tipo), asc(componentsTable.modelo));

    // Mapear tipo do componente para família legível
    const tipoToFamilia: Record<string, string> = {
      DRIVER_ONOFF_220:      "Driver ON/OFF 220V",
      DRIVER_ONOFF_BIVOLT:   "Driver ON/OFF Bivolt",
      DRIVER_DIM_110V:       "Driver DIM 1-10V",
      DRIVER_DIM_DALI:       "Driver DIM DALI",
      DRIVER_DIM_TRIAC_110V: "Driver DIM TRIAC 110V",
      DRIVER_DIM_TRIAC_220V: "Driver DIM TRIAC 220V",
    };

    // Gerar URLs assinadas para acessórios com foto em paralelo
    const formattedPromises = items.map(async (a) => {
      let fotoUrl: string | null = null;
      if (a.fotoUrl) {
        const key = extractStorageKey(a.fotoUrl);
        if (key) {
          try {
            fotoUrl = await storageGetSignedUrl(key);
          } catch {
            fotoUrl = a.fotoUrl;
          }
        } else {
          fotoUrl = a.fotoUrl;
        }
      }

      return {
        id:         a.id,
        source:     "accessories" as const,
        codigo:     a.codigo ?? null,
        sku:        a.sku ?? null,
        produto:    a.produto ?? null,
        familia:    a.familia ?? null,
        dimensao:   a.dimensao ?? null,
        precoVenda: a.precoVenda != null ? Number(a.precoVenda) : null,
        custo:      a.custo != null ? Number(a.custo) : null,
        observacoes: a.observacoes ?? null,
        fotoUrl,
      };
    });

    const formattedAccessories = await Promise.all(formattedPromises);

    // Mapear drivers como acessórios (com foto assinada se disponível)
    const formattedDriversPromises = drivers.map(async (d) => {
      let driverFotoUrl: string | null = null;
      if (d.fotoUrl) {
        const key = extractStorageKey(d.fotoUrl);
        if (key) {
          try { driverFotoUrl = await storageGetSignedUrl(key); } catch { driverFotoUrl = d.fotoUrl; }
        } else {
          driverFotoUrl = d.fotoUrl;
        }
      }
      return {
        id:         `driver-${d.id}`,
        source:     "driver" as const,
        codigo:     d.codigo ?? null,
        sku:        d.codigo ?? null,
        produto:    d.modelo,
        familia:    tipoToFamilia[d.tipo] ?? d.tipo,
        dimensao:   null,
        precoVenda: null,
        custo:      d.custo != null ? Number(d.custo) : null,
        observacoes: d.observacao ?? null,
        fotoUrl:    driverFotoUrl,
      };
    });
    const formattedDrivers = await Promise.all(formattedDriversPromises);

    const formatted = [...formattedAccessories, ...formattedDrivers];

    return res.json({
      count: formatted.length,
      items: formatted,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[acessorios/all]", err);
    return res.status(500).json({ error: "Erro ao buscar acessórios" });
  }
});

// ─── Multer para Excel ───────────────────────────────────────────────────────
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/octet-stream",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.xlsx?$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos .xlsx s\u00e3o aceitos"));
    }
  },
});

// ─── GET /template — baixar planilha modelo de acessórios ─────────────────────
router.get("/template", (_req, res) => {
  const XLSX = require("xlsx");
  const wb = XLSX.utils.book_new();

  // Aba de instruções
  const instrucoes = [
    ["IMPORTAÇÃO DE ACESSÓRIOS — PLANILHA MODELO"],
    [""],
    ["Preencha a aba ACESSÓRIOS com os dados dos itens a importar."],
    ["Colunas obrigatórias: PRODUTO"],
    ["Colunas opcionais: CÓDIGO, SKU, FAMÍLIA, DIMENSÃO, CUSTO, PREÇO VENDA, OBSERVAÇÕES"],
    [""],
    ["REGRAS:"],
    ["\u2022 Se o CÓDIGO já existir no banco, o item será ignorado (não duplica)."],
    ["\u2022 Se não houver CÓDIGO, o item é sempre inserido."],
    ["\u2022 CUSTO e PREÇO VENDA devem ser numéricos (ex: 45.90 ou 45,90)."],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instrucoes);
  XLSX.utils.book_append_sheet(wb, wsInst, "INSTRUÇÕES");

  // Aba de dados com exemplos
  const dados = [
    ["CÓDIGO", "SKU", "PRODUTO", "FAMÍLIA", "DIMENSÃO", "CUSTO", "PREÇO VENDA", "OBSERVAÇÕES"],
    ["CP00526", "RAB-500-PT", "RABICHO CABO PP 3X 0,50 PRETO 500MM", "CABOS & RABICHOS", "500MM", "8.50", "15.00", ""],
    ["EQ00081", "HL224110LA-20", "FITA LED 2835 120LEDS/M 24V 10W/M IP20 IRC80 4000K", "FITA LED", "", "12.00", "22.00", "Rolo 5m"],
  ];
  const wsData = XLSX.utils.aoa_to_sheet(dados);
  wsData["!cols"] = [
    { wch: 12 }, { wch: 18 }, { wch: 50 }, { wch: 20 },
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsData, "ACESSÓRIOS");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="template-acessorios.xlsx"`);
  res.send(buf);
});

// ─── POST /import-excel — importar acessórios em massa ───────────────────────
router.post("/import-excel", uploadExcel.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const XLSX = require("xlsx");
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });

    interface ParsedAccessory {
      codigo?: string;
      sku?: string;
      produto: string;
      familia?: string;
      dimensao?: string;
      custo?: number;
      precoVenda?: number;
      observacoes?: string;
    }

    const allParsed: ParsedAccessory[] = [];

    for (const sheetName of wb.SheetNames) {
      if (sheetName.toUpperCase().includes("INSTRU")) continue;
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
      if (!rawData || rawData.length === 0) continue;

      // Encontrar linha de cabeçalho
      let headerRowIdx = -1;
      let colMap: Record<string, number> = {};
      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const row = rawData[i];
        if (!row) continue;
        const normalized: Record<string, number> = {};
        for (let j = 0; j < row.length; j++) {
          const cell = String(row[j] ?? "").trim().toUpperCase();
          if (cell) normalized[cell] = j;
        }
        const hasProduto = "PRODUTO" in normalized || "DESCRIÇÃO" in normalized || "DESCRICAO" in normalized || "NOME" in normalized;
        if (hasProduto) {
          headerRowIdx = i;
          colMap = normalized;
          break;
        }
      }
      if (headerRowIdx === -1) continue;

      const getCol = (...names: string[]): number => {
        for (const n of names) { if (n in colMap) return colMap[n]; }
        return -1;
      };

      const produtoCol   = getCol("PRODUTO", "DESCRIÇÃO", "DESCRICAO", "NOME");
      const codigoCol    = getCol("CÓDIGO", "CODIGO", "COD", "CÓD", "CODE");
      const skuCol       = getCol("SKU", "REF", "REFERÊNCIA", "REFERENCIA");
      const familiaCol   = getCol("FAMÍLIA", "FAMILIA", "FAMILY", "GRUPO");
      const dimensaoCol  = getCol("DIMENSÃO", "DIMENSAO", "DIM", "TAMANHO", "SIZE");
      const custoCol     = getCol("CUSTO", "COST", "VALOR", "PREÇO CUSTO");
      const precoVendaCol = getCol("PREÇO VENDA", "PRECO VENDA", "VENDA", "PRICE", "PREÇO");
      const obsCol       = getCol("OBSERVAÇÕES", "OBSERVACOES", "OBS", "OBSERVATION", "NOTA");

      for (let i = headerRowIdx + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;
        const produto = produtoCol >= 0 ? String(row[produtoCol] ?? "").trim() : "";
        if (!produto) continue;

        const parseNum = (col: number): number | undefined => {
          if (col < 0 || row[col] === undefined || row[col] === null || row[col] === "") return undefined;
          const raw = String(row[col]).replace(",", ".");
          const n = parseFloat(raw);
          return isNaN(n) ? undefined : n;
        };

        allParsed.push({
          codigo:     codigoCol >= 0 ? String(row[codigoCol] ?? "").trim() || undefined : undefined,
          sku:        skuCol >= 0 ? String(row[skuCol] ?? "").trim() || undefined : undefined,
          produto,
          familia:    familiaCol >= 0 ? String(row[familiaCol] ?? "").trim() || undefined : undefined,
          dimensao:   dimensaoCol >= 0 ? String(row[dimensaoCol] ?? "").trim() || undefined : undefined,
          custo:      parseNum(custoCol),
          precoVenda: parseNum(precoVendaCol),
          observacoes: obsCol >= 0 ? String(row[obsCol] ?? "").trim() || undefined : undefined,
        });
      }
    }

    if (allParsed.length === 0) {
      return res.status(400).json({
        error: "Nenhum acessório válido encontrado. Verifique se a planilha possui a coluna PRODUTO.",
      });
    }

    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of allParsed) {
      try {
        // Se tem código, verificar duplicata
        if (item.codigo) {
          const existing = await db
            .select({ id: accessories.id, produto: accessories.produto })
            .from(accessories)
            .where(eq(accessories.codigo, item.codigo))
            .limit(1);
          if (existing.length > 0) {
            errors.push(`Código "${item.codigo}" já em uso por "${existing[0].produto}" \u2014 ignorado`);
            skipped++;
            continue;
          }
        }

        await db.insert(accessories).values({
          codigo:     item.codigo ?? null,
          sku:        item.sku ?? null,
          produto:    item.produto,
          familia:    item.familia ?? null,
          dimensao:   item.dimensao ?? null,
          custo:      item.custo !== undefined ? String(item.custo) : null,
          precoVenda: item.precoVenda !== undefined ? String(item.precoVenda) : null,
          observacoes: item.observacoes ?? null,
        });
        inserted++;
      } catch (err: any) {
        errors.push(`Erro ao inserir "${item.produto}": ${err?.message ?? String(err)}`);
        skipped++;
      }
    }

    return res.json({
      success: true,
      total: allParsed.length,
      inserted,
      skipped,
      errors: errors.slice(0, 50),
    });
  } catch (err) {
    console.error("[acessorios/import-excel]", err);
    return res.status(500).json({ error: "Erro ao importar Excel: " + String(err) });
  }
});

export default router;
