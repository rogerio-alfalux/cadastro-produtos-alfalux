import { describe, expect, it } from "vitest";
import {
  buildSpecialLightingContract,
  getLightingMode,
  normalizeOtherEquipmentReferences,
  parseOtherEquipmentReferences,
  type AccessorySummary,
  type ComponentSummary,
} from "./productLighting";

const components = new Map<number, ComponentSummary>([
  [10, { id: 10, modelo: "CONTROLADOR SHIFT", codigo: "EQ01000", tipo: "DRIVER_ONOFF_220" }],
  [20, { id: 20, modelo: "MÓDULO TW", codigo: "EQ02000", tipo: "MODULO_LED" }],
]);

const accessories = new Map<number, AccessorySummary>([
  [30, { id: 30, codigo: "AC030", sku: "LAMP-030", produto: "LÂMPADA GU10", familia: "LÂMPADAS" }],
]);

describe("productLighting", () => {
  it("normalizes and deduplicates other equipment references", () => {
    expect(parseOtherEquipmentReferences(JSON.stringify([
      { componentId: 10, qtd: 2.5 },
      { componentId: 10, qtd: 8 },
      { componentId: 0, qtd: 1 },
    ]))).toEqual([{ componentId: 10, qtd: 2.5 }]);
    expect(normalizeOtherEquipmentReferences("[]")).toBeNull();
  });

  it("builds a Tunable White contract without CCT semantics", () => {
    const contract = buildSpecialLightingContract({
      moduloTunableWhite: true,
      moduloLedTunableWhite: "MÓDULO TW",
      qtdModuloLedTunableWhite: "2.00",
    }, components, accessories);

    expect(getLightingMode({ moduloTunableWhite: true })).toBe("TUNABLE_WHITE");
    expect(contract).toMatchObject({
      modoIluminacao: "TUNABLE_WHITE",
      moduloTunableWhite: true,
      moduloLedTunableWhite: "MÓDULO TW",
      moduloLedTunableWhiteCode: "EQ02000",
      qtdModuloLedTunableWhite: 2,
      lampada: null,
    });
  });

  it("resolves an optional accessory lamp and registered extra components", () => {
    const contract = buildSpecialLightingContract({
      moduloLampada: 1,
      lampadaAcessorioId: 30,
      outrosEquipamentos: [{ componentId: 10, qtd: 3 }],
    }, components, accessories);

    expect(contract.modoIluminacao).toBe("LAMPADA");
    expect(contract.lampada).toMatchObject({ id: 30, produto: "LÂMPADA GU10", codigo: "AC030" });
    expect(contract.outrosEquipamentos).toEqual([
      { componentId: 10, modelo: "CONTROLADOR SHIFT", codigo: "EQ01000", tipo: "DRIVER_ONOFF_220", qtd: 3 },
    ]);
  });

  it("omits module semantics while preserving other equipment for products without LED module", () => {
    const contract = buildSpecialLightingContract({
      semModuloLed: true,
      outrosEquipamentos: [{ componentId: 10, qtd: 1 }],
    }, components, accessories);

    expect(contract.modoIluminacao).toBe("SEM_MODULO_LED");
    expect(contract.semModuloLed).toBe(true);
    expect(contract.moduloLedTunableWhite).toBeNull();
    expect(contract.outrosEquipamentos).toHaveLength(1);
  });
});
