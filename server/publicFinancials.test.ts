import { describe, expect, it } from "vitest";
import {
  buildPublicAccessoryFinancials,
  buildPublicRevendaFinancials,
  toPublicMoney,
} from "./publicFinancials";

describe("campos financeiros das APIs públicas", () => {
  it("transmite custo e preço numéricos de acessórios sem alterar os valores", () => {
    expect(buildPublicAccessoryFinancials("10.50", "16.80")).toEqual({
      custo: 10.5,
      precoVenda: 16.8,
    });
  });

  it("transmite custo de revenda e preserva o preço de venda já armazenado", () => {
    const calculate = () => 999;
    expect(buildPublicRevendaFinancials("125.40", "214.90", "FORNECEDOR", calculate)).toEqual({
      custo: 125.4,
      precoVenda: 214.9,
    });
  });

  it("mantém o cálculo legado do preço quando a revenda tem custo mas não tem preço salvo", () => {
    const calculate = (cost: number) => cost * 1.6;
    expect(buildPublicRevendaFinancials("100.00", null, "FORNECEDOR", calculate)).toEqual({
      custo: 100,
      precoVenda: 160,
    });
  });

  it("retorna null para custos ausentes e preserva custo zero", () => {
    expect(toPublicMoney(null)).toBeNull();
    expect(toPublicMoney("")).toBeNull();
    expect(toPublicMoney("0.00")).toBe(0);
    expect(buildPublicRevendaFinancials(null, null, null, () => 999)).toEqual({
      custo: null,
      precoVenda: null,
    });
  });
});
