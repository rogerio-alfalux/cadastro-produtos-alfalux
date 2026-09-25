export type PersistedDriverExtra = {
  modelo: string;
  qtd: number;
  custo: string;
};

/**
 * Always serialize the collection, including an empty one.
 * Sending `undefined` during an update means "leave the stored value unchanged",
 * which would make a removed last driver reappear when the product is reopened.
 */
export function serializeDriverExtras(
  extras: readonly PersistedDriverExtra[],
): string {
  return JSON.stringify(extras.filter((driver) => driver.modelo.trim()));
}
