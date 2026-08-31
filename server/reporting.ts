import ExcelJS from "exceljs";
import { REPORT_SECTION_KEYS, type ReportSection } from "../shared/reports";

export { REPORT_SECTION_KEYS, REPORT_SECTION_LABELS, type ReportSection } from "../shared/reports";
export type ProductReportItem = Record<string, unknown>;

const COLORS = {
  navy: "102A43",
  navySoft: "243B53",
  blue: "1D72B8",
  sky: "D9EAF7",
  mist: "F3F6F9",
  grey: "E2E8F0",
  ink: "172B4D",
  muted: "627D98",
  white: "FFFFFF",
  green: "D9F2E6",
  amber: "FFF3D6",
};

export function parseReportSections(raw?: string | null): ReportSection[] {
  const requested = (raw ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const sections = requested.filter((value): value is ReportSection => REPORT_SECTION_KEYS.includes(value as ReportSection));
  return sections.length ? sections : Array.from(REPORT_SECTION_KEYS);
}

export function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export function calculateOnOff220Financials(product: ProductReportItem) {
  const corpo = asNumber(product.custoCorpoOnoff220v);
  const legacyTotal = asNumber(product.custoLuminaria);
  const driver = asNumber(product.custoDriverOnoff220);
  const total = corpo !== null ? corpo + (driver ?? 0) : legacyTotal;
  return {
    corpo,
    driver,
    total,
    markupPadrao: asNumber(product.mkpPadraoOnoff220v),
    markupMinimo: asNumber(product.mkpMinimoOnoff220v),
    precoCadastrado: asNumber(product.precoVendaOnoff220),
  };
}

export function calculateReportMetrics(items: ProductReportItem[]) {
  const financials = items.map(calculateOnOff220Financials);
  const totals = financials.map((item) => item.total).filter((value): value is number => value !== null);
  return {
    totalProducts: items.length,
    activeProducts: items.filter((item) => item.ativo !== false).length,
    families: new Set(items.map((item) => String(item.familia ?? "").trim()).filter(Boolean)).size,
    productsWithCost: totals.length,
    totalCost: totals.reduce((sum, value) => sum + value, 0),
    averageCost: totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : 0,
  };
}

export type ReportFilterScope = {
  familia?: string;
  categoria?: string;
  instalacao?: string;
  potencia?: string;
};

function normalized(value: unknown) {
  return String(value ?? "").trim();
}

function distinctValues(items: ProductReportItem[], key: keyof ReportFilterScope) {
  return Array.from(new Set(items.map((item) => normalized(item[key])).filter(Boolean)))
    .sort((first, second) => first.localeCompare(second, "pt-BR"));
}

/** Retorna somente valores existentes no escopo definido pelos demais filtros. */
export function getReportFilterOptions(items: ProductReportItem[], scope: ReportFilterScope) {
  const withinScope = (except: keyof ReportFilterScope) => items.filter((item) => {
    return (Object.keys(scope) as Array<keyof ReportFilterScope>).every((key) => {
      if (key === except) return true;
      const selected = normalized(scope[key]);
      return !selected || normalized(item[key]) === selected;
    });
  });
  return {
    familias: distinctValues(withinScope("familia"), "familia"),
    categorias: distinctValues(withinScope("categoria"), "categoria"),
    instalacoes: distinctValues(withinScope("instalacao"), "instalacao"),
    potencias: distinctValues(withinScope("potencia"), "potencia"),
  };
}

function parseDocuments(raw: unknown) {
  if (!raw) return {} as Record<string, { nome?: string }>;
  if (typeof raw === "object") return raw as Record<string, { nome?: string }>;
  try { return JSON.parse(String(raw)) as Record<string, { nome?: string }>; } catch { return {}; }
}

function excelColumn(index: number) {
  let column = "";
  let value = index + 1;
  while (value > 0) {
    const rest = (value - 1) % 26;
    column = String.fromCharCode(65 + rest) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 26;
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
    cell.font = { bold: true, color: { argb: COLORS.white }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: COLORS.blue } } };
  });
}

export async function buildProductReportWorkbook(
  items: ProductReportItem[],
  sections: ReportSection[],
  filters: Record<string, unknown>,
) {
  const include = (section: ReportSection) => sections.includes(section);
  const rows = items.map((product) => {
    const financials = calculateOnOff220Financials(product);
    const documents = parseDocuments(product.documentos);
    const row: Record<string, string | number | null> = {
      "CATEGORIA": String(product.categoria ?? ""),
      "INSTALAÇÃO": String(product.instalacao ?? ""),
      "FAMÍLIA": String(product.familia ?? ""),
      "SKU": String(product.sku ?? ""),
      "PRODUTO": String(product.produto ?? ""),
      "POTÊNCIA": String(product.potencia ?? ""),
      "STATUS": product.ativo === false ? "INATIVO" : "ATIVO",
    };
    if (include("technical")) Object.assign(row, {
      "MÓDULO LED": String(product.moduloLed ?? ""),
      "TEMPERATURAS DE COR": String(product.temperaturasCor ?? ""),
      "ÓTICA": String(product.otica ?? ""),
      "CORRENTE DRIVER": String(product.correnteDriver ?? ""),
      "OPÇÃO D1 + D2": product.possuiOpcaoD1D2 ? "SIM" : "NÃO",
    });
    if (include("drivers")) Object.assign(row, {
      "DRIVER ON/OFF 220V": String(product.driverOnoff220 ?? ""),
      "QTD DRIVER ON/OFF 220V": asNumber(product.qtdDriverOnoff220),
      "DRIVER BIVOLT": String(product.driverOnoffBivolt ?? ""),
      "DRIVER 1–10V": String(product.driverDim110v ?? ""),
      "DRIVER DALI": String(product.driverDimDali ?? ""),
      "DRIVER TRIAC 110V": String(product.driverDimTriac110v ?? ""),
      "DRIVER TRIAC 220V": String(product.driverDimTriac220v ?? ""),
    });
    if (include("financial")) Object.assign(row, {
      "CUSTO CORPO ON/OFF 220V (R$)": financials.corpo ?? (financials.total !== null ? financials.total - (financials.driver ?? 0) : null),
      "CUSTO DRIVER ON/OFF 220V (R$)": financials.driver,
      "CUSTO TOTAL ON/OFF 220V (R$)": null,
      "MARKUP PADRÃO ON/OFF 220V": financials.markupPadrao,
      "MARKUP MÍNIMO ON/OFF 220V": financials.markupMinimo,
      "PREÇO SUGERIDO — MARKUP PADRÃO (R$)": null,
      "PREÇO SUGERIDO — MARKUP MÍNIMO (R$)": null,
      "PREÇO CADASTRADO ON/OFF 220V (R$)": financials.precoCadastrado,
    });
    if (include("documents")) Object.assign(row, {
      "DATASHEET": documents.datasheet?.nome ?? "",
      "FOTOMETRIA IES": documents.fotometria?.nome ?? "",
      "DESENHO TÉCNICO": documents.desenhoTecnico?.nome ?? "",
      "MANUAL DE INSTALAÇÃO": documents.manualInstalacao?.nome ?? "",
    });
    return row;
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Alfalux Cadastro de Produtos";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const headers = Object.keys(rows[0] ?? {
    "CATEGORIA": "", "INSTALAÇÃO": "", "FAMÍLIA": "", "SKU": "", "PRODUTO": "", "POTÊNCIA": "", "STATUS": "",
  });
  const detail = workbook.addWorksheet("Produtos", {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { tabColor: { argb: COLORS.blue } },
    pageSetup: { orientation: "landscape", paperSize: 9, scale: 85, margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  detail.columns = headers.map((header) => ({ header, key: header, width: Math.min(Math.max(header.length * 0.9, 14), 34) }));
  rows.forEach((row) => detail.addRow(row));
  styleHeader(detail.getRow(1));
  detail.autoFilter = { from: "A1", to: `${excelColumn(headers.length - 1)}1` };

  const currencyHeaders = ["CUSTO CORPO ON/OFF 220V (R$)", "CUSTO DRIVER ON/OFF 220V (R$)", "CUSTO TOTAL ON/OFF 220V (R$)", "PREÇO SUGERIDO — MARKUP PADRÃO (R$)", "PREÇO SUGERIDO — MARKUP MÍNIMO (R$)", "PREÇO CADASTRADO ON/OFF 220V (R$)"];
  const markupHeaders = ["MARKUP PADRÃO ON/OFF 220V", "MARKUP MÍNIMO ON/OFF 220V"];
  const financialFormulaHeaders = ["CUSTO TOTAL ON/OFF 220V (R$)", "PREÇO SUGERIDO — MARKUP PADRÃO (R$)", "PREÇO SUGERIDO — MARKUP MÍNIMO (R$)"];
  const indexOf = (header: string) => headers.indexOf(header) + 1;
  if (include("financial")) {
    const body = excelColumn(indexOf("CUSTO CORPO ON/OFF 220V (R$)") - 1);
    const driver = excelColumn(indexOf("CUSTO DRIVER ON/OFF 220V (R$)") - 1);
    const total = excelColumn(indexOf("CUSTO TOTAL ON/OFF 220V (R$)") - 1);
    const standard = excelColumn(indexOf("MARKUP PADRÃO ON/OFF 220V") - 1);
    const minimum = excelColumn(indexOf("MARKUP MÍNIMO ON/OFF 220V") - 1);
    const suggestedStandard = excelColumn(indexOf("PREÇO SUGERIDO — MARKUP PADRÃO (R$)") - 1);
    const suggestedMinimum = excelColumn(indexOf("PREÇO SUGERIDO — MARKUP MÍNIMO (R$)") - 1);
    detail.eachRow((row, index) => {
      if (index === 1) return;
      row.getCell(indexOf("CUSTO TOTAL ON/OFF 220V (R$)")).value = { formula: `IF(COUNT(${body}${index}:${driver}${index})=0,"",SUM(${body}${index}:${driver}${index}))` };
      row.getCell(indexOf("PREÇO SUGERIDO — MARKUP PADRÃO (R$)")).value = { formula: `IF(OR(${total}${index}="",${standard}${index}=""),"",${total}${index}*${standard}${index})` };
      row.getCell(indexOf("PREÇO SUGERIDO — MARKUP MÍNIMO (R$)")).value = { formula: `IF(OR(${total}${index}="",${minimum}${index}=""),"",${total}${index}*${minimum}${index})` };
    });
  }
  detail.eachRow((row, index) => {
    if (index === 1) return;
    row.height = 20;
    row.eachCell((cell) => {
      cell.font = { color: { argb: COLORS.ink }, size: 10 };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: COLORS.grey } } };
      if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.mist } };
    });
    currencyHeaders.forEach((header) => {
      const column = indexOf(header);
      if (column) { const cell = row.getCell(column); cell.numFmt = 'R$ #,##0.00'; cell.alignment = { vertical: "middle", horizontal: "right" }; }
    });
    markupHeaders.forEach((header) => { const column = indexOf(header); if (column) row.getCell(column).numFmt = '0.00x'; });
    financialFormulaHeaders.forEach((header) => {
      const column = indexOf(header);
      if (column) { const cell = row.getCell(column); cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.sky } }; cell.font = { bold: true, color: { argb: COLORS.ink }, size: 10 }; }
    });
    const status = row.getCell(indexOf("STATUS"));
    status.font = { bold: true, color: { argb: status.value === "ATIVO" ? "107C41" : "A65B00" }, size: 10 };
    status.fill = { type: "pattern", pattern: "solid", fgColor: { argb: status.value === "ATIVO" ? COLORS.green : COLORS.amber } };
  });

  const metrics = calculateReportMetrics(items);
  const summary = workbook.addWorksheet("Resumo", {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: COLORS.navy } },
    pageSetup: { orientation: "portrait", fitToWidth: 1, fitToHeight: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  summary.columns = [{ width: 42 }, { width: 28 }];
  summary.mergeCells("A1:B1");
  const title = summary.getCell("A1");
  title.value = "RELATÓRIO GERENCIAL — ALFALUX";
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
  title.font = { bold: true, color: { argb: COLORS.white }, size: 16 };
  title.alignment = { vertical: "middle", horizontal: "left" };
  summary.getRow(1).height = 32;
  summary.mergeCells("A2:B2");
  const subtitle = summary.getCell("A2");
  subtitle.value = `Carteira de produtos · Gerado em ${new Date().toLocaleString("pt-BR")}`;
  subtitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navySoft } };
  subtitle.font = { color: { argb: "D9E2EC" }, italic: true, size: 10 };
  subtitle.alignment = { vertical: "middle" };
  summary.getRow(2).height = 22;
  summary.mergeCells("A4:B4");
  summary.getCell("A4").value = "FILTROS APLICADOS";
  summary.mergeCells("A11:B11");
  summary.getCell("A11").value = "INDICADORES DO ESCOPO";
  [4, 11].forEach((rowNumber) => {
    const cell = summary.getCell(`A${rowNumber}`);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.blue } };
    cell.font = { bold: true, color: { argb: COLORS.white }, size: 10 };
    cell.alignment = { vertical: "middle" };
    summary.getRow(rowNumber).height = 22;
  });
  const filterRows: Array<[string, string]> = [["Família", String(filters.familia || "Todas")], ["Categoria", String(filters.categoria || "Todas")], ["Instalação", String(filters.instalacao || "Todas")], ["Potência", String(filters.potencia || "Todas")], ["Status", filters.apenasInativos ? "Somente inativos" : "Todos"]];
  filterRows.forEach(([label, value], index) => {
    const row = summary.getRow(index + 5); row.values = [label, value]; row.height = 20;
    row.getCell(1).font = { bold: true, color: { argb: COLORS.ink }, size: 10 };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.sky } };
    row.getCell(2).font = { color: { argb: COLORS.ink }, size: 10 };
    row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.mist } };
  });
  const metricRows: Array<[string, number, boolean]> = [["Produtos no relatório", metrics.totalProducts, false], ["Produtos ativos", metrics.activeProducts, false], ["Famílias abrangidas", metrics.families, false], ["Produtos com custo ON/OFF 220V", metrics.productsWithCost, false], ["Custo total ON/OFF 220V (R$)", metrics.totalCost, true], ["Custo médio ON/OFF 220V (R$)", metrics.averageCost, true]];
  metricRows.forEach(([label, value, monetary], index) => {
    const row = summary.getRow(index + 12); row.values = [label, value]; row.height = 23;
    row.getCell(1).font = { bold: true, color: { argb: COLORS.ink }, size: 10 };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 ? COLORS.mist : COLORS.sky } };
    row.getCell(2).font = { bold: true, color: { argb: COLORS.navy }, size: 11 };
    row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.white } };
    row.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
    if (monetary) row.getCell(2).numFmt = 'R$ #,##0.00';
  });
  [summary, detail].forEach((worksheet) => {
    worksheet.eachRow((row) => row.eachCell((cell) => {
      if (!cell.border || Object.keys(cell.border).length === 0) cell.border = { bottom: { style: "hair", color: { argb: COLORS.grey } } };
    }));
  });
  return workbook;
}
