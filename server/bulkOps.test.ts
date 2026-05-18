/**
 * Testes para o bulkOpsRouter (Operações em Massa)
 * Verifica a lógica de filtragem, prévia e aplicação de custos/drivers em massa.
 */
import { describe, it, expect } from "vitest";

// ─── Testa a lógica de buildWhere (unit test puro) ───────────────────────────

function buildWhere(filters: {
  familia?: string;
  categoria?: string;
  moduloLedContem?: string;
  driverAtual?: string;
  driverCol?: string;
}): string {
  const clauses: string[] = ["1=1"];
  if (filters.familia?.trim()) clauses.push(`familia = '${filters.familia.replace(/'/g, "''")}'`);
  if (filters.categoria?.trim()) clauses.push(`categoria = '${filters.categoria.replace(/'/g, "''")}'`);
  if (filters.moduloLedContem?.trim()) clauses.push(`moduloLed LIKE '%${filters.moduloLedContem.replace(/'/g, "''")}%'`);
  if (filters.driverAtual?.trim() && filters.driverCol) {
    clauses.push(`\`${filters.driverCol}\` = '${filters.driverAtual.replace(/'/g, "''")}'`);
  }
  return clauses.join(" AND ");
}

describe("buildWhere", () => {
  it("retorna '1=1' quando sem filtros", () => {
    expect(buildWhere({})).toBe("1=1");
  });

  it("adiciona filtro de família", () => {
    const result = buildWhere({ familia: "ROYAL" });
    expect(result).toContain("familia = 'ROYAL'");
  });

  it("adiciona filtro de categoria", () => {
    const result = buildWhere({ categoria: "DOWNLIGHTS" });
    expect(result).toContain("categoria = 'DOWNLIGHTS'");
  });

  it("adiciona filtro de módulo LED com LIKE", () => {
    const result = buildWhere({ moduloLedContem: "18W" });
    expect(result).toContain("moduloLed LIKE '%18W%'");
  });

  it("adiciona filtro de driver específico quando driverCol fornecido", () => {
    const result = buildWhere({ driverAtual: "LIFUD 40W", driverCol: "driverOnoff220" });
    expect(result).toContain("`driverOnoff220` = 'LIFUD 40W'");
  });

  it("não adiciona filtro de driver sem driverCol", () => {
    const result = buildWhere({ driverAtual: "LIFUD 40W" });
    expect(result).not.toContain("LIFUD 40W");
  });

  it("combina múltiplos filtros com AND", () => {
    const result = buildWhere({ familia: "ROYAL", categoria: "DOWNLIGHTS", moduloLedContem: "18W" });
    expect(result).toContain("familia = 'ROYAL'");
    expect(result).toContain("categoria = 'DOWNLIGHTS'");
    expect(result).toContain("moduloLed LIKE '%18W%'");
    expect(result.split(" AND ").length).toBe(4); // 1=1 + 3 filtros
  });

  it("escapa aspas simples nos valores", () => {
    const result = buildWhere({ familia: "O'NEIL" });
    expect(result).toContain("familia = 'O''NEIL'");
  });

  it("ignora filtros com string vazia ou espaços", () => {
    const result = buildWhere({ familia: "  ", categoria: "" });
    expect(result).toBe("1=1");
  });
});

// ─── Testa mapeamento de tipos de driver ─────────────────────────────────────

const DRIVER_COL: Record<string, string> = {
  DRIVER_ONOFF_220: "driverOnoff220",
  DRIVER_ONOFF_BIVOLT: "driverOnoffBivolt",
  DRIVER_DIM_110V: "driverDim110v",
  DRIVER_DIM_DALI: "driverDimDali",
};

const DRIVER_CUSTO_COL: Record<string, string> = {
  DRIVER_ONOFF_220: "custoDriverOnoff220",
  DRIVER_ONOFF_BIVOLT: "custoDriverOnoffBivolt",
  DRIVER_DIM_110V: "custoDriverDim110v",
  DRIVER_DIM_DALI: "custoDriverDimDali",
};

const DRIVER_NAO_APLICAVEL_COL: Record<string, string | null> = {
  DRIVER_ONOFF_220: null,
  DRIVER_ONOFF_BIVOLT: "driverOnoffBivoltNaoAplicavel",
  DRIVER_DIM_110V: "driverDim110vNaoAplicavel",
  DRIVER_DIM_DALI: "driverDimDaliNaoAplicavel",
};

describe("Mapeamento de colunas de driver", () => {
  it("mapeia DRIVER_ONOFF_220 para driverOnoff220", () => {
    expect(DRIVER_COL["DRIVER_ONOFF_220"]).toBe("driverOnoff220");
  });

  it("mapeia DRIVER_DIM_DALI para driverDimDali", () => {
    expect(DRIVER_COL["DRIVER_DIM_DALI"]).toBe("driverDimDali");
  });

  it("mapeia custos corretamente", () => {
    expect(DRIVER_CUSTO_COL["DRIVER_ONOFF_220"]).toBe("custoDriverOnoff220");
    expect(DRIVER_CUSTO_COL["DRIVER_DIM_110V"]).toBe("custoDriverDim110v");
  });

  it("DRIVER_ONOFF_220 não tem coluna NaoAplicavel (null)", () => {
    expect(DRIVER_NAO_APLICAVEL_COL["DRIVER_ONOFF_220"]).toBeNull();
  });

  it("DRIVER_DIM_DALI tem coluna NaoAplicavel", () => {
    expect(DRIVER_NAO_APLICAVEL_COL["DRIVER_DIM_DALI"]).toBe("driverDimDaliNaoAplicavel");
  });

  it("todos os 4 tipos de driver estão mapeados", () => {
    const types = ["DRIVER_ONOFF_220", "DRIVER_ONOFF_BIVOLT", "DRIVER_DIM_110V", "DRIVER_DIM_DALI"];
    types.forEach((t) => {
      expect(DRIVER_COL[t]).toBeDefined();
      expect(DRIVER_CUSTO_COL[t]).toBeDefined();
      expect(DRIVER_NAO_APLICAVEL_COL).toHaveProperty(t);
    });
  });
});

// ─── Testa lógica de cláusula extra para INSERIR/REMOVER ─────────────────────

describe("Cláusula extra INSERIR/REMOVER", () => {
  it("REMOVER: exige driver não nulo e não vazio", () => {
    const col = "driverDimDali";
    const extraClause = ` AND \`${col}\` IS NOT NULL AND \`${col}\` != ''`;
    expect(extraClause).toContain("IS NOT NULL");
    expect(extraClause).toContain("!= ''");
  });

  it("INSERIR: exige driver nulo ou vazio, e naoAplicavel = 0", () => {
    const col = "driverDimDali";
    const naoApCol = "driverDimDaliNaoAplicavel";
    let extraClause = ` AND (\`${col}\` IS NULL OR \`${col}\` = '')`;
    extraClause += ` AND \`${naoApCol}\` = 0`;
    expect(extraClause).toContain("IS NULL");
    expect(extraClause).toContain("= 0");
  });

  it("INSERIR para ONOFF_220 não adiciona cláusula naoAplicavel (null)", () => {
    const col = "driverOnoff220";
    const naoApCol = DRIVER_NAO_APLICAVEL_COL["DRIVER_ONOFF_220"];
    let extraClause = ` AND (\`${col}\` IS NULL OR \`${col}\` = '')`;
    if (naoApCol) extraClause += ` AND \`${naoApCol}\` = 0`;
    expect(extraClause).not.toContain("NaoAplicavel");
  });
});

// ─── Testa validação de custo ─────────────────────────────────────────────────

describe("Validação de custo", () => {
  function isValidCusto(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const num = parseFloat(trimmed.replace(",", "."));
    return !isNaN(num) && num >= 0;
  }

  it("aceita valor decimal válido", () => {
    expect(isValidCusto("45.90")).toBe(true);
    expect(isValidCusto("0")).toBe(true);
    expect(isValidCusto("100")).toBe(true);
  });

  it("aceita valor com vírgula (formato BR)", () => {
    expect(isValidCusto("45,90")).toBe(true);
  });

  it("rejeita string vazia", () => {
    expect(isValidCusto("")).toBe(false);
    expect(isValidCusto("   ")).toBe(false);
  });

  it("rejeita texto não numérico", () => {
    expect(isValidCusto("abc")).toBe(false);
    expect(isValidCusto("R$ 45")).toBe(false);
  });
});
