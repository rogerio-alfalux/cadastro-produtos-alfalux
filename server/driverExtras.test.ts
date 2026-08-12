import { describe, expect, it } from "vitest";
import { parsePublicDriverExtras } from "./driverExtras";

const makeDriver = (model: string | null | undefined) =>
  model?.trim() ? { model: model.trim(), code: "EQ00001" } : null;

describe("parsePublicDriverExtras", () => {
  it("expõe modelo, código, quantidade e custo de cada driver extra válido", () => {
    const extras = parsePublicDriverExtras(
      JSON.stringify([{ modelo: " Driver adicional 44W ", qtd: 2, custo: "18.50" }]),
      makeDriver,
    );

    expect(extras).toEqual([{ model: "Driver adicional 44W", code: "EQ00001", qtd: 2, custo: 18.5 }]);
  });

  it("ignora modelos vazios", () => {
    expect(parsePublicDriverExtras('[{"modelo":"","qtd":1}]', makeDriver)).toEqual([]);
  });

  it("mantém compatibilidade com extras legados salvos como texto simples", () => {
    expect(parsePublicDriverExtras("REGULADOR DE VOLTAGEM 20X20MM", makeDriver)).toEqual([
      { model: "REGULADOR DE VOLTAGEM 20X20MM", code: "EQ00001", qtd: 1, custo: null },
    ]);
  });
});
