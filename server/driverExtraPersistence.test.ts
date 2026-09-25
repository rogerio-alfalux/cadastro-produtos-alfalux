import { describe, expect, it } from "vitest";
import { serializeDriverExtras } from "@shared/driverExtraPersistence";

describe("serializeDriverExtras", () => {
  it("serializa uma coleção vazia como [] para persistir a remoção do último driver", () => {
    expect(serializeDriverExtras([])).toBe("[]");
  });

  it("remove linhas sem modelo e preserva os drivers extras preenchidos", () => {
    expect(serializeDriverExtras([
      { modelo: "   ", qtd: 1, custo: "" },
      { modelo: "LED DRIVER 35W 200-700MA 220V PRG DIM DALI", qtd: 1, custo: "92.0000" },
    ])).toBe(JSON.stringify([
      { modelo: "LED DRIVER 35W 200-700MA 220V PRG DIM DALI", qtd: 1, custo: "92.0000" },
    ]));
  });
});
