export type PublicDriver = { model: string; code: string | null };
export type PublicDriverExtra = PublicDriver & { qtd: number; custo: number | null };

export function parsePublicDriverExtras(
  raw: unknown,
  makeDriver: (model: string | null | undefined) => PublicDriver | null,
): PublicDriverExtra[] {
  try {
    let parsed = raw;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = [{ modelo: raw, qtd: 1, custo: null }];
      }
    }
    const extras = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? [parsed] : [];
    return extras.flatMap((extra) => {
      const driver = makeDriver(extra?.modelo);
      if (!driver) return [];
      const custo = extra?.custo;
      return [{
        ...driver,
        qtd: Number(extra?.qtd) || 1,
        custo: custo !== undefined && custo !== null && custo !== "" ? Number(custo) : null,
      }];
    });
  } catch {
    return [];
  }
}
