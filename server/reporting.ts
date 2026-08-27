import * as XLSX from "xlsx";
import { REPORT_SECTION_KEYS, type ReportSection } from "../shared/reports";

export { REPORT_SECTION_KEYS, REPORT_SECTION_LABELS, type ReportSection } from "../shared/reports";
export type ProductReportItem = Record<string, unknown>;

export function parseReportSections(raw?: string | null): ReportSection[] {
  const requested = (raw ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const sections = requested.filter((value): value is ReportSection => REPORT_SECTION_KEYS.includes(value as ReportSection));
  return sections.length ? sections : [...REPORT_SECTION_KEYS];
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

function parseDocuments(raw: unknown) {
  if (!raw) return {} as Record<string, { nome?: string }>;
  if (typeof raw === "object") return raw as Record<string, { nome?: string }>;
  try { return JSON.parse(String(raw)) as Record<string, { nome?: string }>; } catch { return {}; }
}

export function buildProductReportWorkbook(
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
    });
    return row;
  });

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] ?? {});
  if (include("financial") && rows.length) {
    const position = (header: string) => excelColumn(headers.indexOf(header));
    const bodyColumn = position("CUSTO CORPO ON/OFF 220V (R$)");
    const driverColumn = position("CUSTO DRIVER ON/OFF 220V (R$)");
    const totalColumn = position("CUSTO TOTAL ON/OFF 220V (R$)");
    const standardColumn = position("MARKUP PADRÃO ON/OFF 220V");
    const minimumColumn = position("MARKUP MÍNIMO ON/OFF 220V");
    const suggestedStandardColumn = position("PREÇO SUGERIDO — MARKUP PADRÃO (R$)");
    const suggestedMinimumColumn = position("PREÇO SUGERIDO — MARKUP MÍNIMO (R$)");
    rows.forEach((_, index) => {
      const rowNumber = index + 2;
      sheet[`${totalColumn}${rowNumber}`] = { t: "n", f: `IF(COUNT(${bodyColumn}${rowNumber}:${driverColumn}${rowNumber})=0,"",SUM(${bodyColumn}${rowNumber}:${driverColumn}${rowNumber}))` };
      sheet[`${suggestedStandardColumn}${rowNumber}`] = { t: "n", f: `IF(OR(${totalColumn}${rowNumber}="",${standardColumn}${rowNumber}=""),"",${totalColumn}${rowNumber}*${standardColumn}${rowNumber})` };
      sheet[`${suggestedMinimumColumn}${rowNumber}`] = { t: "n", f: `IF(OR(${totalColumn}${rowNumber}="",${minimumColumn}${rowNumber}=""),"",${totalColumn}${rowNumber}*${minimumColumn}${rowNumber})` };
    });
  }
  sheet["!cols"] = headers.map((header) => ({ wch: Math.min(Math.max(header.length + 2, 14), 38) }));
  sheet["!autofilter"] = rows.length ? { ref: `A1:${excelColumn(headers.length - 1)}${rows.length + 1}` } : undefined;
  XLSX.utils.book_append_sheet(workbook, sheet, "Produtos");

  const metrics = calculateReportMetrics(items);
  const summary = XLSX.utils.aoa_to_sheet([
    ["RELATÓRIO GERENCIAL — CADASTRO DE PRODUTOS ALFALUX"],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    [],
    ["Filtros aplicados"],
    ["Família", filters.familia || "Todas"],
    ["Categoria", filters.categoria || "Todas"],
    ["Instalação", filters.instalacao || "Todas"],
    ["Potência", filters.potencia || "Todas"],
    ["Status", filters.apenasInativos ? "Somente inativos" : "Todos"],
    [],
    ["Indicadores"],
    ["Produtos no relatório", metrics.totalProducts],
    ["Produtos ativos", metrics.activeProducts],
    ["Famílias abrangidas", metrics.families],
    ["Produtos com custo ON/OFF 220V", metrics.productsWithCost],
    ["Custo total ON/OFF 220V (R$)", metrics.totalCost],
    ["Custo médio ON/OFF 220V (R$)", metrics.averageCost],
  ]);
  summary["!cols"] = [{ wch: 42 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, summary, "Resumo");
  return workbook;
}
