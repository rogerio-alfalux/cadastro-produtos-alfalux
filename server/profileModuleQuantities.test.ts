import { describe, expect, it } from "vitest";
import {
  buildProfileModuleQuantityChanges,
  calculateProfileModuleQuantity,
  isEligibleProfileModuleProduct,
} from "./profileModuleQuantities";

describe("quantidades de módulos LED para Perfis", () => {
  it.each([
    ["MINI BLAZE S IF 1.6B 950MM 18W", null, 1.6],
    ["MINI BLAZE S IF 1B 575MM 36W SL", "36W-SL", 1],
    ["MINI BLAZE S IF 1B 575MM 36W SF", "36W-SF", 2],
    ["MINI BLAZE S IF 3B 1700MM 36W SF", "36W-SF", 6],
    ["BLAZE A IF 3.7B 2135MM 26W", "26W", 3.7],
  ])("calcula %s", (produto, potencia, esperado) => {
    expect(calculateProfileModuleQuantity(produto, potencia)).toBe(esperado);
  });

  it("não calcula produtos sem token de barras", () => {
    expect(calculateProfileModuleQuantity("GLOW S 37W 1154MM", null)).toBeNull();
  });

  it("aceita Stripflex e Stripline em Perfis, mas exclui qualquer produto com Fita LED", () => {
    expect(isEligibleProfileModuleProduct({ categoria: "PERFIS", moduloLed3000: "STRIPFLEX 3000K" })).toBe(true);
    expect(isEligibleProfileModuleProduct({ categoria: "PERFIS", moduloLed: "STRIPLINE", moduloLed3000: "FITA LED" })).toBe(false);
    expect(isEligibleProfileModuleProduct({ categoria: "PAINÉIS", moduloLed: "STRIPFLEX" })).toBe(false);
  });

  it("preenche somente as quantidades dos CCTs que possuem módulo cadastrado", () => {
    expect(buildProfileModuleQuantityChanges({
      categoria: "PERFIS",
      produto: "BLAZE H P IF 2.5B 1415MM 36W SF",
      potencia: "36W-SF",
      moduloLed: "STRIPFLEX [CCT]",
      moduloLed2700: null,
      moduloLed3000: "STRIPFLEX 3000K",
      moduloLed3500: "",
      moduloLed4000: "STRIPFLEX 4000K",
      moduloLed5000: "STRIPFLEX 5000K",
    })).toEqual({
      qtdModuloLed: 5,
      qtdModuloLed3000: 5,
      qtdModuloLed4000: 5,
      qtdModuloLed5000: 5,
    });
  });
});
