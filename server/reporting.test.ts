import { describe, expect, it } from "vitest";
import {
  buildProductReportWorkbook,
  calculateOnOff220Financials,
  calculateReportMetrics,
  getReportFilterOptions,
  parseReportSections,
} from "./reporting";

describe("relatórios gerenciais", () => {
  const product = {
    id: 1, produto: "BLAZE H P 18W", sku: "LLP-001", familia: "BLAZE H", categoria: "PERFIS", instalacao: "PENDENTE", potencia: "18W", ativo: true,
    custoCorpoOnoff220v: "100.0000", custoDriverOnoff220: "20.00", mkpPadraoOnoff220v: "2.5", mkpMinimoOnoff220v: "1.8", precoVendaOnoff220: "300.00",
    moduloLed: "LED 3000K", temperaturasCor: "[\"3000\"]", driverOnoff220: "DRIVER 20W", qtdDriverOnoff220: "1",
  };

  it("calcula o custo ON/OFF 220V sem arredondar o markup", () => {
    expect(calculateOnOff220Financials(product)).toMatchObject({
      corpo: 100,
      driver: 20,
      total: 120,
      markupPadrao: 2.5,
      markupMinimo: 1.8,
      precoCadastrado: 300,
    });
  });

  it("consolida indicadores do escopo filtrado", () => {
    const metrics = calculateReportMetrics([product, { ...product, id: 2, familia: "LUNA", ativo: false, custoCorpoOnoff220v: null, custoLuminaria: "80" }]);
    expect(metrics).toMatchObject({ totalProducts: 2, activeProducts: 1, families: 2, productsWithCost: 2, totalCost: 200, averageCost: 100 });
  });

  it("gera fórmulas financeiras e formatação executiva no workbook", async () => {
    const workbook = await buildProductReportWorkbook([product], ["financial"], { familia: "BLAZE H" });
    const sheet = workbook.getWorksheet("Produtos")!;
    const headers = sheet.getRow(1).values.slice(1).map((value) => String(value));
    const totalIndex = headers.indexOf("CUSTO TOTAL ON/OFF 220V (R$)");
    const standardIndex = headers.indexOf("PREÇO SUGERIDO — MARKUP PADRÃO (R$)");
    const minimumIndex = headers.indexOf("PREÇO SUGERIDO — MARKUP MÍNIMO (R$)");
    const row = sheet.getRow(2);
    expect(String((row.getCell(totalIndex + 1).value as { formula?: string }).formula)).toContain("SUM");
    expect(String((row.getCell(standardIndex + 1).value as { formula?: string }).formula)).toContain("*");
    expect(String((row.getCell(minimumIndex + 1).value as { formula?: string }).formula)).toContain("*");
    expect(sheet.getRow(1).getCell(1).fill).toMatchObject({ fgColor: { argb: "102A43" } });
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(workbook.getWorksheet("Resumo")!.getCell("A1").value).toBe("RELATÓRIO GERENCIAL — ALFALUX");
  });

  it("aceita apenas seções conhecidas e usa todas quando não há seleção", () => {
    expect(parseReportSections("financial,documents,invalida")).toEqual(["financial", "documents"]);
    expect(parseReportSections()).toHaveLength(4);
  });

  it("oferece somente instalações reais compatíveis com a família selecionada", () => {
    const options = getReportFilterOptions([
      product,
      { ...product, id: 2, produto: "BLAZE H S 26W", potencia: "26W" },
      { ...product, id: 3, familia: "LUNA", categoria: "DOWNLIGHTS", instalacao: "EMBUTIR", potencia: null },
      { ...product, id: 4, familia: "LUNA", categoria: "DOWNLIGHTS", instalacao: "SOBREPOR", potencia: null },
    ], { familia: "BLAZE H" });
    expect(options.instalacoes).toEqual(["PENDENTE"]);
    expect(options.categorias).toEqual(["PERFIS"]);
    expect(options.potencias).toEqual(["18W", "26W"]);
  });
});
