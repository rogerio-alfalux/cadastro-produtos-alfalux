import { describe, expect, it } from "vitest";
import { getReportFilterOptions } from "./reporting";

const products = [
  { categoria: "PERFIS", instalacao: "PENDENTE", familia: "BLAZE H", potencia: "18W" },
  { categoria: "PERFIS", instalacao: "PENDENTE", familia: "BLAZE H", potencia: "26W" },
  { categoria: "PERFIS", instalacao: "PENDENTE", familia: "HIT", potencia: "18W" },
  { categoria: "DOWNLIGHTS", instalacao: "EMBUTIR", familia: "LUNA", potencia: null },
  { categoria: "PAINÉIS", instalacao: "SOBREPOR", familia: "EASY", potencia: null },
] as any;

describe("product filter options", () => {
  it("shows only the BLAZE H family, its installation and its powers after category selection", () => {
    expect(getReportFilterOptions(products, { categoria: "PERFIS" })).toMatchObject({
      familias: ["BLAZE H", "HIT"],
      instalacoes: ["PENDENTE"],
      potencias: ["18W", "26W"],
    });
  });

  it("shows only the compatible category and installation when a family is selected", () => {
    expect(getReportFilterOptions(products, { familia: "BLAZE H" })).toEqual({
      familias: ["BLAZE H", "EASY", "HIT", "LUNA"],
      categorias: ["PERFIS"],
      instalacoes: ["PENDENTE"],
      potencias: ["18W", "26W"],
    });
  });

  it("keeps family options conditional to a selected installation", () => {
    expect(getReportFilterOptions(products, { instalacao: "EMBUTIR" })).toMatchObject({
      familias: ["LUNA"],
      categorias: ["DOWNLIGHTS"],
    });
  });
});
