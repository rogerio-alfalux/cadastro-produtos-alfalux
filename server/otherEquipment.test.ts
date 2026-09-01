import { describe, expect, it } from "vitest";
import { hydrateOtherEquipmentRecords, parseStoredOtherEquipment } from "../shared/otherEquipment";

describe("Other Equipment form hydration", () => {
  it("restores the selected component label from an ID-only stored reference", () => {
    const stored = parseStoredOtherEquipment(JSON.stringify([{ componentId: 42, qtd: 2 }]));
    const hydrated = hydrateOtherEquipmentRecords(stored, [
      { id: 42, modelo: "CONTROLADOR SHIFT", tipo: "CONTROLADOR" },
    ]);

    expect(hydrated).toEqual([
      { componentId: 42, modelo: "CONTROLADOR SHIFT", tipo: "CONTROLADOR", qtd: 2 },
    ]);
  });

  it("preserves a saved item until its matching component is available", () => {
    const stored = parseStoredOtherEquipment([{ componentId: 7, qtd: 1.5 }]);
    expect(hydrateOtherEquipmentRecords(stored, [])).toEqual([
      { componentId: 7, modelo: "", tipo: "", qtd: 1.5 },
    ]);
  });
});
