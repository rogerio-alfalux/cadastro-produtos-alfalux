export type OtherEquipmentReference = {
  componentId: number;
  qtd: number;
};

export type ComponentSummary = {
  id: number;
  modelo: string;
  codigo: string | null;
  tipo: string;
};

export type AccessorySummary = {
  id: number;
  codigo: string | null;
  sku: string | null;
  produto: string;
  familia: string | null;
};

function parseUnknownJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseOtherEquipmentReferences(raw: unknown): OtherEquipmentReference[] {
  const parsed = parseUnknownJson(raw);
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<number>();
  return parsed
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const componentId = Number(row.componentId);
      const qtd = Math.max(0.01, Number(row.qtd) || 1);
      return {
        componentId: Number.isInteger(componentId) ? componentId : 0,
        qtd: Math.round(qtd * 1000) / 1000,
      };
    })
    .filter((item) => {
      if (item.componentId <= 0 || seen.has(item.componentId)) return false;
      seen.add(item.componentId);
      return true;
    });
}

export function normalizeOtherEquipmentReferences(raw: unknown): OtherEquipmentReference[] | null {
  const items = parseOtherEquipmentReferences(raw);
  return items.length > 0 ? items : null;
}

export type ProductLightingSource = {
  moduloRgbw?: number | boolean | null;
  moduloLampada?: number | boolean | null;
  moduloTunableWhite?: number | boolean | null;
  semModuloLed?: number | boolean | null;
  moduloLedTunableWhite?: string | null;
  qtdModuloLedTunableWhite?: string | number | null;
  lampadaAcessorioId?: number | null;
  outrosEquipamentos?: unknown;
};

export function getLightingMode(source: ProductLightingSource): "CCT" | "RGBW" | "TUNABLE_WHITE" | "LAMPADA" | "SEM_MODULO_LED" {
  if (Boolean(source.semModuloLed)) return "SEM_MODULO_LED";
  if (Boolean(source.moduloLampada)) return "LAMPADA";
  if (Boolean(source.moduloTunableWhite)) return "TUNABLE_WHITE";
  if (Boolean(source.moduloRgbw)) return "RGBW";
  return "CCT";
}

export function buildSpecialLightingContract(
  source: ProductLightingSource,
  componentsById: Map<number, ComponentSummary>,
  accessoriesById: Map<number, AccessorySummary>,
) {
  const modoIluminacao = getLightingMode(source);
  const tunableModel = String(source.moduloLedTunableWhite ?? "").trim();
  const tunableQtd = tunableModel ? Math.max(0.01, Number(source.qtdModuloLedTunableWhite) || 1) : null;
  const lampada = modoIluminacao === "LAMPADA" && source.lampadaAcessorioId
    ? accessoriesById.get(Number(source.lampadaAcessorioId)) ?? null
    : null;

  const outrosEquipamentos = parseOtherEquipmentReferences(source.outrosEquipamentos)
    .map((reference) => {
      const component = componentsById.get(reference.componentId);
      if (!component) return null;
      return {
        componentId: component.id,
        modelo: component.modelo,
        codigo: component.codigo,
        tipo: component.tipo,
        qtd: reference.qtd,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    modoIluminacao,
    semModuloLed: modoIluminacao === "SEM_MODULO_LED",
    moduloTunableWhite: modoIluminacao === "TUNABLE_WHITE",
    moduloLedTunableWhite: modoIluminacao === "TUNABLE_WHITE" && tunableModel ? tunableModel : null,
    moduloLedTunableWhiteCode:
      modoIluminacao === "TUNABLE_WHITE" && tunableModel
        ? Array.from(componentsById.values()).find((component) => component.modelo.trim().toUpperCase() === tunableModel.toUpperCase())?.codigo ?? null
        : null,
    qtdModuloLedTunableWhite: modoIluminacao === "TUNABLE_WHITE" ? tunableQtd : null,
    lampadaAcessorioId: modoIluminacao === "LAMPADA" && lampada ? lampada.id : null,
    lampada: lampada
      ? {
          id: lampada.id,
          codigo: lampada.codigo,
          sku: lampada.sku,
          produto: lampada.produto,
          familia: lampada.familia,
        }
      : null,
    outrosEquipamentos,
  };
}
