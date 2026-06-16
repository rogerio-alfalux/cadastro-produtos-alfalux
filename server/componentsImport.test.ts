import { describe, it, expect } from "vitest";

// ─── Tipos válidos replicados do componentsRoutes ────────────────────────────
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

function normalizeType(raw: string): string | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase().replace(/[\s\-]/g, "_");
  if (VALID_TYPES.has(upper)) return upper;
  for (const [key, label] of Object.entries(TYPE_LABELS)) {
    if (label.toUpperCase() === raw.trim().toUpperCase()) return key;
  }
  return null;
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe("normalizeType — tipos válidos", () => {
  it("aceita DRIVER_ONOFF_220 exato", () => {
    expect(normalizeType("DRIVER_ONOFF_220")).toBe("DRIVER_ONOFF_220");
  });

  it("aceita DRIVER_DIM_TRIAC_110V exato", () => {
    expect(normalizeType("DRIVER_DIM_TRIAC_110V")).toBe("DRIVER_DIM_TRIAC_110V");
  });

  it("aceita DRIVER_DIM_TRIAC_220V exato", () => {
    expect(normalizeType("DRIVER_DIM_TRIAC_220V")).toBe("DRIVER_DIM_TRIAC_220V");
  });

  it("aceita label legível 'Driver Dim Triac 110V'", () => {
    expect(normalizeType("Driver Dim Triac 110V")).toBe("DRIVER_DIM_TRIAC_110V");
  });

  it("aceita label legível 'Driver Dim Triac 220V'", () => {
    expect(normalizeType("Driver Dim Triac 220V")).toBe("DRIVER_DIM_TRIAC_220V");
  });

  it("aceita MODULO_LED", () => {
    expect(normalizeType("MODULO_LED")).toBe("MODULO_LED");
  });

  it("aceita OTICA", () => {
    expect(normalizeType("OTICA")).toBe("OTICA");
  });
});

describe("normalizeType — tipos inválidos", () => {
  it("rejeita string vazia", () => {
    expect(normalizeType("")).toBeNull();
  });

  it("rejeita tipo desconhecido", () => {
    expect(normalizeType("DRIVER_INEXISTENTE")).toBeNull();
  });

  it("rejeita label parcial", () => {
    expect(normalizeType("Triac")).toBeNull();
  });
});

describe("VALID_TYPES — cobertura de todos os tipos", () => {
  const expected = [
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
  ];

  it("contém exatamente 10 tipos", () => {
    expect(VALID_TYPES.size).toBe(10);
  });

  for (const tipo of expected) {
    it(`contém o tipo ${tipo}`, () => {
      expect(VALID_TYPES.has(tipo)).toBe(true);
    });
  }
});

describe("TYPE_LABELS — novos tipos TRIAC têm labels corretos", () => {
  it("DRIVER_DIM_TRIAC_110V tem label 'Driver Dim Triac 110V'", () => {
    expect(TYPE_LABELS["DRIVER_DIM_TRIAC_110V"]).toBe("Driver Dim Triac 110V");
  });

  it("DRIVER_DIM_TRIAC_220V tem label 'Driver Dim Triac 220V'", () => {
    expect(TYPE_LABELS["DRIVER_DIM_TRIAC_220V"]).toBe("Driver Dim Triac 220V");
  });
});
