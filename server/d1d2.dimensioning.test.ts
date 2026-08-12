import { describe, expect, it } from "vitest";
import { driverCapacity, requiredDriverQuantity } from "../scripts/d1d2-dimensioning-utils.mjs";

describe("dimensionamento D1+D2 por número de barras", () => {
  it("reconhece a capacidade confirmada de oito barras dos drivers 65W/60W", () => {
    expect(driverCapacity("LED DRIVER XITANIUM 65W 200-350MA 120-185VDC DS 230V")).toBe(8);
    expect(driverCapacity("LED DRIVER 60W 200-350MA 80-200VDC BIV DIP SWITCH SLIM")).toBe(8);
  });

  it("calcula a quantidade de drivers pelo limite de barras", () => {
    const driver65W = "LED DRIVER XITANIUM 65W 200-350MA 120-185VDC DS 230V";
    expect(requiredDriverQuantity(4, driver65W)).toBe(1);
    expect(requiredDriverQuantity(8, driver65W)).toBe(1);
    expect(requiredDriverQuantity(8.2, driver65W)).toBe(2);
    expect(requiredDriverQuantity(12, driver65W)).toBe(2);
  });

  it("preserva as faixas dos drivers menores", () => {
    expect(driverCapacity("LED DRIVER XITANIUM 44W 200-350MA")).toBe(5);
    expect(driverCapacity("LED DRIVER 20W 200-350MA")).toBe(2);
  });
});
