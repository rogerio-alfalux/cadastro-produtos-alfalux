import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { getDb } from "./db";
import { components } from "../drizzle/schema";
import { eq, and, ne } from "drizzle-orm";

const router = express.Router();

// ─── Tipos válidos de componente ─────────────────────────────────────────────
const VALID_TYPES = new Set([
  "DRIVER_ONOFF_220",
  "DRIVER_ONOFF_BIVOLT",
  "DRIVER_DIM_110V",
  "DRIVER_DIM_DALI",
  "DRIVER_DIM_TRIAC_110V",
  "DRIVER_DIM_TRIAC_220V",
  "OTICA",
  "HOLDER",
  "DISSIPADOR",
  "MODULO_LED",
]);

const TYPE_LABELS: Record<string, string> = {
  DRIVER_ONOFF_220: "Driver ON/OFF 220V",
  DRIVER_ONOFF_BIVOLT: "Driver ON/OFF Bivolt",
  DRIVER_DIM_110V: "Driver Dim 1-10V",
  DRIVER_DIM_DALI: "Driver Dim DALI",
  DRIVER_DIM_TRIAC_110V: "Driver Dim Triac 110V",
  DRIVER_DIM_TRIAC_220V: "Driver Dim Triac 220V",
  OTICA: "Ótica",
  HOLDER: "Holder",
  DISSIPADOR: "Dissipador",
  MODULO_LED: "Módulo LED",
};

// ─── Multer para Excel ────────────────────────────────────────────────────────
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith(".xlsx") || file.originalname.endsWith(".xls")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos .xlsx ou .xls são aceitos para importação"));
    }
  },
});

// ─── Normalizar string de tipo ────────────────────────────────────────────────
function normalizeType(raw: string): string | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase().replace(/[\s\-]/g, "_");
  if (VALID_TYPES.has(upper)) return upper;
  // Tentar mapear pelo label (ex: "Driver ON/OFF 220V" → "DRIVER_ONOFF_220")
  for (const [key, label] of Object.entries(TYPE_LABELS)) {
    if (label.toUpperCase() === raw.trim().toUpperCase()) return key;
  }
  return null;
}

// ─── Parse da planilha de componentes ────────────────────────────────────────
interface ParsedComponent {
  tipo: string;
  modelo: string;
  codigo?: string;
  observacao?: string;
  custo?: number;
}

function parseComponentsSheet(ws: XLSX.WorkSheet): ParsedComponent[] {
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  if (!rawData || rawData.length === 0) return [];

  // Encontrar linha de cabeçalho (procurar nas primeiras 5 linhas)
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
    // Verificar se tem pelo menos TIPO e MODELO
    const hasTipo = "TIPO" in normalized || "TYPE" in normalized;
    const hasModelo = "MODELO" in normalized || "DESCRIÇÃO" in normalized || "DESCRICAO" in normalized || "DESCRIPTION" in normalized || "NOME" in normalized;
    if (hasTipo && hasModelo) {
      headerRowIdx = i;
      colMap = normalized;
      break;
    }
  }

  if (headerRowIdx === -1) return [];

  const getCol = (...names: string[]): number => {
    for (const n of names) {
      if (n in colMap) return colMap[n];
    }
    return -1;
  };

  const tipoCol = getCol("TIPO", "TYPE");
  const modeloCol = getCol("MODELO", "DESCRIÇÃO", "DESCRICAO", "DESCRIPTION", "NOME");
  const codigoCol = getCol("CÓDIGO", "CODIGO", "CODE", "COD", "CÓD");
  const observacaoCol = getCol("OBSERVAÇÃO", "OBSERVACAO", "OBS", "OBSERVATION", "NOTA");
  const custoCol = getCol("CUSTO", "COST", "PREÇO", "PRECO", "VALOR", "PRICE");

  const results: ParsedComponent[] = [];

  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row) continue;

    const rawTipo = tipoCol >= 0 ? String(row[tipoCol] ?? "").trim() : "";
    const rawModelo = modeloCol >= 0 ? String(row[modeloCol] ?? "").trim() : "";

    if (!rawTipo || !rawModelo) continue;

    const tipo = normalizeType(rawTipo);
    if (!tipo) continue; // tipo inválido — pular

    const codigo = codigoCol >= 0 ? String(row[codigoCol] ?? "").trim() || undefined : undefined;
    const observacao = observacaoCol >= 0 ? String(row[observacaoCol] ?? "").trim() || undefined : undefined;
    let custo: number | undefined;
    if (custoCol >= 0 && row[custoCol] !== undefined && row[custoCol] !== null && row[custoCol] !== "") {
      const raw = String(row[custoCol]).replace(",", ".");
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) custo = parsed;
    }

    results.push({ tipo, modelo: rawModelo, codigo, observacao, custo });
  }

  return results;
}

// ─── GET /template — baixar planilha modelo ───────────────────────────────────
router.get("/template", (_req, res) => {
  const wb = XLSX.utils.book_new();

  // Aba de instruções
  const instrucoes = [
    ["IMPORTAÇÃO DE COMPONENTES — PLANILHA MODELO"],
    [""],
    ["Preencha a aba COMPONENTES com os dados dos componentes a importar."],
    ["Colunas obrigatórias: TIPO e MODELO"],
    ["Colunas opcionais: CÓDIGO, CUSTO, OBSERVAÇÃO"],
    [""],
    ["TIPOS VÁLIDOS:"],
    ...Object.entries(TYPE_LABELS).map(([k, v]) => [`  ${k}`, `→ ${v}`]),
    [""],
    ["REGRAS:"],
    ["• Se o CÓDIGO já existir no banco, o item será ignorado (não duplica)."],
    ["• Se não houver CÓDIGO, o item é sempre inserido."],
    ["• O CUSTO deve ser numérico (ex: 45.90 ou 45,90)."],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instrucoes);
  XLSX.utils.book_append_sheet(wb, wsInst, "INSTRUÇÕES");

  // Aba de dados com exemplos
  const dados = [
    ["TIPO", "MODELO", "CÓDIGO", "CUSTO", "OBSERVAÇÃO"],
    ["DRIVER_ONOFF_220", "PHILIPS XITANIUM 20W 500MA", "EQ00100", "45.90", ""],
    ["DRIVER_DIM_DALI", "TRIDONIC EXCITE 40W DALI", "EQ00200", "89.00", "Versão 2024"],
    ["DRIVER_DIM_TRIAC_110V", "OSRAM OPTOTRONIC 30W TRIAC 110V", "EQ00300", "72.50", ""],
    ["DRIVER_DIM_TRIAC_220V", "OSRAM OPTOTRONIC 30W TRIAC 220V", "EQ00301", "72.50", ""],
    ["MODULO_LED", "CREE XHP50 3000K 80CRI", "EQ00400", "12.00", ""],
    ["OTICA", "LEDIL STRADA 60°", "EQ00500", "8.50", ""],
    ["HOLDER", "HOLDER CREE XHP50", "EQ00600", "2.30", ""],
    ["DISSIPADOR", "DISSIPADOR ALUMÍNIO 100MM", "EQ00700", "15.00", ""],
  ];
  const wsData = XLSX.utils.aoa_to_sheet(dados);
  // Largura das colunas
  wsData["!cols"] = [{ wch: 25 }, { wch: 45 }, { wch: 12 }, { wch: 10 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsData, "COMPONENTES");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="template-componentes.xlsx"`);
  res.send(buf);
});

// ─── POST /import-excel — importar componentes em massa ───────────────────────
router.post("/import-excel", uploadExcel.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const allParsed: ParsedComponent[] = [];

    for (const sheetName of wb.SheetNames) {
      // Pular abas de instruções
      if (sheetName.toUpperCase().includes("INSTRU")) continue;
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const parsed = parseComponentsSheet(ws);
      allParsed.push(...parsed);
    }

    if (allParsed.length === 0) {
      return res.status(400).json({
        error: "Nenhum componente válido encontrado. Verifique se a planilha possui as colunas TIPO e MODELO e se os tipos são válidos.",
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
            .select({ id: components.id, modelo: components.modelo })
            .from(components)
            .where(eq(components.codigo, item.codigo))
            .limit(1);

          if (existing.length > 0) {
            errors.push(`Código "${item.codigo}" já em uso por "${existing[0].modelo}" — ignorado`);
            skipped++;
            continue;
          }
        }

        await db.insert(components).values({
          tipo: item.tipo as any,
          modelo: item.modelo,
          codigo: item.codigo ?? null,
          observacao: item.observacao ?? null,
          custo: item.custo !== undefined ? String(item.custo) : null,
        });
        inserted++;
      } catch (err: any) {
        errors.push(`Erro ao inserir "${item.modelo}": ${err?.message ?? String(err)}`);
        skipped++;
      }
    }

    return res.json({
      success: true,
      total: allParsed.length,
      inserted,
      skipped,
      errors: errors.slice(0, 50), // limitar a 50 erros no retorno
    });
  } catch (err) {
    console.error("[components/import-excel]", err);
    return res.status(500).json({ error: "Erro ao importar Excel: " + String(err) });
  }
});

export default router;
