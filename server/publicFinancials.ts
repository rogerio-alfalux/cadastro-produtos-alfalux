export function toPublicMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function buildPublicAccessoryFinancials(custo: unknown, precoVenda: unknown) {
  return {
    custo: toPublicMoney(custo),
    precoVenda: toPublicMoney(precoVenda),
  };
}

export function buildPublicRevendaFinancials(
  custo: unknown,
  precoVenda: unknown,
  fornecedor: string | null,
  calculateSalePrice: (cost: number, supplier: string | null) => number,
) {
  const publicCost = toPublicMoney(custo);
  const storedSalePrice = toPublicMoney(precoVenda);
  return {
    custo: publicCost,
    precoVenda: storedSalePrice ?? (publicCost === null ? null : calculateSalePrice(publicCost, fornecedor)),
  };
}
