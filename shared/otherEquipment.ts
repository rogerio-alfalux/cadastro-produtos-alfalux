export interface OtherEquipmentRecord {
  componentId: number | null;
  modelo: string;
  tipo: string;
  qtd: number;
}

type ComponentReference = {
  id: number;
  modelo: string | null;
  tipo: string | null;
};

export const emptyOtherEquipment = (): OtherEquipmentRecord => ({
  componentId: null,
  modelo: "",
  tipo: "",
  qtd: 1,
});

export function parseStoredOtherEquipment(raw: unknown): OtherEquipmentRecord[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const componentId = Number(row.componentId);
      return {
        componentId: Number.isInteger(componentId) && componentId > 0 ? componentId : null,
        modelo: String(row.modelo ?? "").trim(),
        tipo: String(row.tipo ?? "").trim(),
        qtd: Math.max(0.01, Number(row.qtd) || 1),
      };
    }).filter((item) => item.componentId !== null);
  } catch {
    return [];
  }
}

export function hydrateOtherEquipmentRecords(
  items: OtherEquipmentRecord[],
  components: ComponentReference[],
): OtherEquipmentRecord[] {
  return items.map((item) => {
    const component = item.componentId
      ? components.find((candidate) => candidate.id === item.componentId)
      : null;
    return component
      ? { ...item, modelo: component.modelo ?? "", tipo: component.tipo ?? "" }
      : item;
  });
}
