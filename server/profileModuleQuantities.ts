export const PROFILE_MODULE_QUANTITY_FIELDS = [
  ["moduloLed", "qtdModuloLed"],
  ["moduloLed2700", "qtdModuloLed2700"],
  ["moduloLed3000", "qtdModuloLed3000"],
  ["moduloLed3500", "qtdModuloLed3500"],
  ["moduloLed4000", "qtdModuloLed4000"],
  ["moduloLed5000", "qtdModuloLed5000"],
] as const;

type ProfileModuleProduct = {
  categoria?: string | null;
  produto?: string | null;
  potencia?: string | null;
  moduloLed?: string | null;
  moduloLed2700?: string | null;
  moduloLed3000?: string | null;
  moduloLed3500?: string | null;
  moduloLed4000?: string | null;
  moduloLed5000?: string | null;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export function isAvailableModule(value: unknown): boolean {
  const normalized = normalize(value);
  return normalized !== "" && normalized !== "NÃO APLICÁVEL" && normalized !== "NAO APLICAVEL";
}

export function isEligibleProfileModuleProduct(product: ProfileModuleProduct): boolean {
  if (normalize(product.categoria) !== "PERFIS") return false;
  const modules = PROFILE_MODULE_QUANTITY_FIELDS.map(([moduleField]) => normalize(product[moduleField]));
  const joined = modules.join(" ");
  return (joined.includes("STRIPFLEX") || joined.includes("STRIPLINE")) && !joined.includes("FITA LED");
}

export function calculateProfileModuleQuantity(productName: unknown, potencia?: unknown): number | null {
  const normalizedName = normalize(productName).replace(/,/g, ".");
  const match = normalizedName.match(/(?:^|\s)(\d+(?:\.\d+)?)B(?:\s|$)/);
  if (!match) return null;

  const bars = Number(match[1]);
  if (!Number.isFinite(bars) || bars <= 0) return null;

  const is36wSf = /(?:^|\s)36W\s+SF(?:\s|$)/.test(normalizedName) || normalize(potencia) === "36W-SF";
  return Number((bars * (is36wSf ? 2 : 1)).toFixed(2));
}

export function buildProfileModuleQuantityChanges(product: ProfileModuleProduct) {
  if (!isEligibleProfileModuleProduct(product)) return null;
  const quantity = calculateProfileModuleQuantity(product.produto, product.potencia);
  if (quantity === null) return null;

  return Object.fromEntries(
    PROFILE_MODULE_QUANTITY_FIELDS
      .filter(([moduleField]) => isAvailableModule(product[moduleField]))
      .map(([, quantityField]) => [quantityField, quantity]),
  );
}
