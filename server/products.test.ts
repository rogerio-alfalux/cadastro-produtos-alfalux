import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB ──────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  listProducts: vi.fn().mockResolvedValue({
    items: [
      {
        id: 1,
        categoria: "DOWNLIGHTS",
        instalacao: "EMBUTIR",
        familia: "LUNA",
        sku: "LDE 1400.120.19B",
        produto: "LUNA PP LED 6,5W RE ABS",
        moduloLed: "TRACE CIRCULAR 6 LEDS Ø50MM [CCT]",
        otica: "NÃO APLICÁVEL",
        oticaNaoAplicavel: true,
        holder: "NÃO APLICÁVEL",
        holderNaoAplicavel: true,
        dissipador: "NÃO APLICÁVEL",
        dissipadorNaoAplicavel: true,
        driverOnoff220: "LIFUD 13W 350MA BIVOLT (EQ00236)",
        driverOnoffBivolt: "LIFUD 13W 350MA BIVOLT (EQ00236)",
        driverDim110v: null,
        driverDimDali: null,
        temperaturasCor: '["2700","3000","4000","5000"]',
        fotoUrl: null,
        fotoKey: null,
        custoLuminaria: null,
        custoDriverOnoff220: null,
        custoDriverOnoffBivolt: null,
        custoDriverDim110v: null,
        custoDriverDimDali: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    total: 1,
  }),
  getProductById: vi.fn().mockResolvedValue({
    id: 1,
    categoria: "DOWNLIGHTS",
    instalacao: "EMBUTIR",
    familia: "LUNA",
    sku: "LDE 1400.120.19B",
    produto: "LUNA PP LED 6,5W RE ABS",
    moduloLed: "TRACE CIRCULAR 6 LEDS Ø50MM [CCT]",
    otica: "NÃO APLICÁVEL",
    oticaNaoAplicavel: true,
    holder: "NÃO APLICÁVEL",
    holderNaoAplicavel: true,
    dissipador: "NÃO APLICÁVEL",
    dissipadorNaoAplicavel: true,
    driverOnoff220: "LIFUD 13W 350MA BIVOLT (EQ00236)",
    driverOnoffBivolt: "LIFUD 13W 350MA BIVOLT (EQ00236)",
    driverDim110v: null,
    driverDimDali: null,
    temperaturasCor: '["2700","3000","4000","5000"]',
    fotoUrl: null,
    fotoKey: null,
    custoLuminaria: null,
    custoDriverOnoff220: null,
    custoDriverOnoffBivolt: null,
    custoDriverDim110v: null,
    custoDriverDimDali: null,
    mkpMinimoOnoff220v: "2",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  createProduct: vi.fn().mockResolvedValue({ insertId: 2 }),
  updateProduct: vi.fn().mockResolvedValue(undefined),
  deleteProduct: vi.fn().mockResolvedValue(undefined),
  bulkInsertProducts: vi.fn().mockResolvedValue({ inserted: 5, skipped: 0 }),
  countProducts: vi.fn().mockResolvedValue(208),
}));

// ─── Context ──────────────────────────────────────────────────────────────────

function createCtx(role: "user" | "admin" | "engineering" | "costs" | null = "admin"): TrpcContext {
  return {
    user: role ? ({ id: 2, role } as any) : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("products.list", () => {
  it("returns a list of products", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.list({});
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].sku).toBe("LDE 1400.120.19B");
  });

  it("accepts search and filter params", async () => {
    const { listProducts } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.list({
      search: "LUNA",
      categoria: "DOWNLIGHTS",
      instalacao: "EMBUTIR",
      familia: "LUNA",
      potencia: "18W",
      limit: 10,
      offset: 0,
    });
    expect(result).toBeDefined();
    expect(listProducts).toHaveBeenLastCalledWith(expect.objectContaining({
      categoria: "DOWNLIGHTS",
      instalacao: "EMBUTIR",
      familia: "LUNA",
      potencia: "18W",
    }));
  });
});

describe("products.getById", () => {
  it("returns a product by id", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.getById({ id: 1 });
    expect(result.id).toBe(1);
    expect(result.familia).toBe("LUNA");
  });
});

describe("products.create", () => {
  it("creates a product with all required fields", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.create({
      categoria: "DOWNLIGHTS",
      instalacao: "EMBUTIR",
      familia: "LUNA",
      sku: "TEST-001",
      produto: "PRODUTO TESTE",
      moduloLed: "MÓDULO TESTE",
      otica: "NÃO APLICÁVEL",
      oticaNaoAplicavel: true,
      holder: "NÃO APLICÁVEL",
      holderNaoAplicavel: true,
      dissipador: "NÃO APLICÁVEL",
      dissipadorNaoAplicavel: true,
      driverOnoff220: "DRIVER 220V TESTE",
      driverOnoffBivolt: "DRIVER BIVOLT TESTE",
      temperaturasCor: '["2700","3000","4000","5000"]',
    });
    expect(result.success).toBe(true);
  });

  it("converts text fields to uppercase", async () => {
    const { createProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.products.create({
      instalacao: "embutir",
      familia: "luna",
      sku: "test-001",
      produto: "produto teste",
      moduloLed: "módulo teste",
      otica: "NÃO APLICÁVEL",
      oticaNaoAplicavel: true,
      holder: "NÃO APLICÁVEL",
      holderNaoAplicavel: true,
      dissipador: "NÃO APLICÁVEL",
      dissipadorNaoAplicavel: true,
      driverOnoff220: "driver 220v",
      driverOnoffBivolt: "driver bivolt",
      temperaturasCor: '["2700","3000","4000","5000"]',
    });
    const callArgs = (createProduct as any).mock.calls.at(-1)?.[0];
    expect(callArgs?.familia).toBe("LUNA");
    expect(callArgs?.sku).toBe("TEST-001");
    expect(callArgs?.produto).toBe("PRODUTO TESTE");
  });

  it("persists the D1+D2 option flag for profile products", async () => {
    const { createProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.products.create({
      categoria: "PERFIS",
      instalacao: "SOBREPOR",
      familia: "PERFIL TESTE",
      sku: "PERFIL-D1D2",
      produto: "PERFIL COM OPÇÃO D1+D2",
      moduloLed: "MÓDULO TESTE",
      otica: "NÃO APLICÁVEL",
      oticaNaoAplicavel: true,
      holder: "NÃO APLICÁVEL",
      holderNaoAplicavel: true,
      dissipador: "NÃO APLICÁVEL",
      dissipadorNaoAplicavel: true,
      driverOnoff220: "DRIVER 220V",
      driverOnoffBivolt: "DRIVER BIVOLT",
      possuiOpcaoD1D2: true,
      composicaoD1D2: JSON.stringify({
        qtdModuloLed: 2,
        drivers: [{
          tipo: "DRIVER_ONOFF_220",
          modelo: "DRIVER 44W",
          qtd: 1,
          custo: "18.0000",
        }],
      }),
    });
    const callArgs = (createProduct as any).mock.calls.at(-1)?.[0];
    expect(callArgs?.possuiOpcaoD1D2).toBe(true);
    expect(JSON.parse(callArgs?.composicaoD1D2)).toMatchObject({
      qtdModuloLed: 2,
      drivers: [{ modelo: "DRIVER 44W", custo: "18.0000" }],
    });
  });

  it("persists the 3500K LED module and its quantity", async () => {
    const { createProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.products.create({
      categoria: "DOWNLIGHTS",
      instalacao: "EMBUTIR",
      familia: "LUNA",
      sku: "TEST-3500K",
      produto: "PRODUTO COM 3500K",
      moduloLed: "MÓDULO PRINCIPAL",
      moduloLed3500: "módulo led 3500k",
      qtdModuloLed3500: 2.5,
      otica: "NÃO APLICÁVEL",
      oticaNaoAplicavel: true,
      holder: "NÃO APLICÁVEL",
      holderNaoAplicavel: true,
      dissipador: "NÃO APLICÁVEL",
      dissipadorNaoAplicavel: true,
      driverOnoff220: "DRIVER 220V",
      driverOnoffBivolt: "DRIVER BIVOLT",
    });
    const callArgs = (createProduct as any).mock.calls.at(-1)?.[0];
    expect(callArgs?.moduloLed3500).toBe("MÓDULO LED 3500K");
    expect(callArgs?.qtdModuloLed3500).toBe("2.5");
  });

  it("persists additional CCT LED modules for a specific product", async () => {
    const { createProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    const extras = [{ cct: "6500", modelo: "MÓDULO LED 6500K", qtd: 1.5 }];
    await caller.products.create({
      categoria: "DOWNLIGHTS",
      instalacao: "EMBUTIR",
      familia: "LUNA",
      sku: "TEST-CCT-EXTRA",
      produto: "PRODUTO COM CCT EXTRA",
      moduloLed: "MÓDULO PRINCIPAL",
      otica: "NÃO APLICÁVEL",
      oticaNaoAplicavel: true,
      holder: "NÃO APLICÁVEL",
      holderNaoAplicavel: true,
      dissipador: "NÃO APLICÁVEL",
      dissipadorNaoAplicavel: true,
      driverOnoff220: "DRIVER 220V",
      driverOnoffBivolt: "DRIVER BIVOLT",
      moduloLedExtra: JSON.stringify(extras),
    });
    const callArgs = (createProduct as any).mock.calls.at(-1)?.[0];
    expect(callArgs?.moduloLedExtra).toEqual(extras);
  });

  it("persists datasheet, IES, technical drawing and installation manual metadata", async () => {
    const { createProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    const documentos = {
      datasheet: { url: "/manus-storage/products/documents/datasheet/test.pdf", key: "products/documents/datasheet/test.pdf", nome: "datasheet.pdf", mimeType: "application/pdf" },
      fotometria: { url: "/manus-storage/products/documents/fotometria/test.ies", key: "products/documents/fotometria/test.ies", nome: "fotometria.ies", mimeType: "application/octet-stream" },
      desenhoTecnico: { url: "/manus-storage/products/documents/desenhoTecnico/test.dwg", key: "products/documents/desenhoTecnico/test.dwg", nome: "desenho.dwg", mimeType: "application/acad" },
      manualInstalacao: { url: "/manus-storage/products/documents/manualInstalacao/test.pdf", key: "products/documents/manualInstalacao/test.pdf", nome: "manual.pdf", mimeType: "application/pdf" },
    };
    await caller.products.create({
      categoria: "DOWNLIGHTS",
      instalacao: "EMBUTIR",
      familia: "LUNA",
      sku: "TEST-DOCS",
      produto: "PRODUTO COM DOCUMENTOS",
      moduloLed: "MÓDULO PRINCIPAL",
      otica: "NÃO APLICÁVEL",
      oticaNaoAplicavel: true,
      holder: "NÃO APLICÁVEL",
      holderNaoAplicavel: true,
      dissipador: "NÃO APLICÁVEL",
      dissipadorNaoAplicavel: true,
      driverOnoff220: "DRIVER 220V",
      driverOnoffBivolt: "DRIVER BIVOLT",
      documentos: JSON.stringify(documentos),
    });
    const callArgs = (createProduct as any).mock.calls.at(-1)?.[0];
    expect(callArgs?.documentos).toEqual(documentos);
  });
});

describe("products.update", () => {
  it("updates a product successfully", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.update({
      id: 1,
      data: { produto: "PRODUTO ATUALIZADO" },
    });
    expect(result.success).toBe(true);
  });

  it("bloqueia qualquer edição de produto para usuário sem perfil operacional", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(caller.products.update({
      id: 1,
      data: { produto: "PRODUTO ATUALIZADO", mkpMinimoOnoff220v: "2.00" },
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("bloqueia para usuário a alteração real de markup mínimo", async () => {
    const caller = appRouter.createCaller(createCtx("user"));
    await expect(caller.products.update({
      id: 1,
      data: { mkpMinimoOnoff220v: "2.15" },
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("updates the D1+D2 option flag", async () => {
    const { updateProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.products.update({
      id: 1,
      data: {
        possuiOpcaoD1D2: true,
        composicaoD1D2: JSON.stringify({
          qtdModuloLed: 2,
          drivers: [{ tipo: "DRIVER_ONOFF_220", modelo: "DRIVER 44W", qtd: 1, custo: "18.0000" }],
        }),
      },
    });
    const callArgs = (updateProduct as any).mock.calls.at(-1)?.[1];
    expect(callArgs?.possuiOpcaoD1D2).toBe(true);
    expect(JSON.parse(callArgs?.composicaoD1D2)).toMatchObject({
      drivers: [{ modelo: "DRIVER 44W", custo: "18.0000" }],
    });
  });

  it("updates the 3500K LED module and quantity", async () => {
    const { updateProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.products.update({
      id: 1,
      data: { moduloLed3500: "módulo revisão 3500k", qtdModuloLed3500: 3 },
    });
    const callArgs = (updateProduct as any).mock.calls.at(-1)?.[1];
    expect(callArgs?.moduloLed3500).toBe("MÓDULO REVISÃO 3500K");
    expect(callArgs?.qtdModuloLed3500).toBe("3");
  });

  it("updates the additional CCT LED modules", async () => {
    const { updateProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    const extras = [
      { cct: "5700", modelo: "MÓDULO LED 5700K", qtd: 2 },
      { cct: "6500", modelo: "MÓDULO LED 6500K", qtd: 1 },
    ];
    await caller.products.update({
      id: 1,
      data: { moduloLedExtra: JSON.stringify(extras) },
    });
    const callArgs = (updateProduct as any).mock.calls.at(-1)?.[1];
    expect(callArgs?.moduloLedExtra).toEqual(extras);
  });

  it("removes all product documents when the field is cleared", async () => {
    const { updateProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.products.update({ id: 1, data: { documentos: null } });
    const callArgs = (updateProduct as any).mock.calls.at(-1)?.[1];
    expect(callArgs?.documentos).toBeNull();
  });
});

describe("products special lighting modes", () => {
  const requiredFields = {
    categoria: "PERFIS",
    instalacao: "SOBREPOR",
    familia: "SHIFT",
    sku: "SHIFT-TEST",
    produto: "SHIFT TESTE",
    moduloLed: "MÓDULO ANTIGO",
    moduloLed3000: "MÓDULO 3000K",
    otica: "NÃO APLICÁVEL",
    oticaNaoAplicavel: true,
    holder: "NÃO APLICÁVEL",
    holderNaoAplicavel: true,
    dissipador: "NÃO APLICÁVEL",
    dissipadorNaoAplicavel: true,
    driverOnoff220: "DRIVER 220V",
    driverOnoffBivolt: "DRIVER BIVOLT",
  } as const;

  it("persists Tunable White and clears incompatible CCT modules", async () => {
    const { createProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.products.create({
      ...requiredFields,
      moduloTunableWhite: true,
      moduloLedTunableWhite: "módulo tunable white",
      qtdModuloLedTunableWhite: 2,
      outrosEquipamentos: JSON.stringify([{ componentId: 15, qtd: 1.5 }]),
    });

    const callArgs = (createProduct as any).mock.calls.at(-1)?.[0];
    expect(callArgs).toMatchObject({
      moduloLed: "",
      moduloTunableWhite: true,
      moduloLedTunableWhite: "MÓDULO TUNABLE WHITE",
      qtdModuloLedTunableWhite: "2",
      moduloLed3000: null,
      temperaturasCor: "[]",
      outrosEquipamentos: [{ componentId: 15, qtd: 1.5 }],
    });
  });

  it("rejects more than one lighting mode", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.products.create({
      ...requiredFields,
      moduloRgbw: 1,
      moduloTunableWhite: true,
    })).rejects.toThrow("Selecione somente uma modalidade");
  });

  it("stores an optional accessory lamp only in lamp mode", async () => {
    const { createProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.products.create({
      ...requiredFields,
      moduloLampada: 1,
      lampadaAcessorioId: 780009,
    });

    const callArgs = (createProduct as any).mock.calls.at(-1)?.[0];
    expect(callArgs.moduloLampada).toBe(1);
    expect(callArgs.lampadaAcessorioId).toBe(780009);
    expect(callArgs.moduloLed3000).toBeNull();
  });

  it("clears legacy module fields when a product is marked without LED module", async () => {
    const { updateProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.products.update({ id: 1, data: { semModuloLed: true } });

    const callArgs = (updateProduct as any).mock.calls.at(-1)?.[1];
    expect(callArgs).toMatchObject({
      semModuloLed: true,
      moduloLed: "",
      moduloLed2700: null,
      moduloLed3000: null,
      moduloLed3500: null,
      moduloLed4000: null,
      moduloLed5000: null,
      moduloLedExtra: null,
      temperaturasCor: "[]",
    });
  });
});

describe("products.delete", () => {
  it("deletes a product", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

describe("products.count", () => {
  it("returns total product count", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.count();
    expect(result.count).toBe(208);
  });
});

describe("products.create - validation", () => {
  it("rejects create when otica is empty and oticaNaoAplicavel is false", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.products.create({
        instalacao: "EMBUTIR",
        familia: "LUNA",
        sku: "TEST-002",
        produto: "PRODUTO TESTE",
        moduloLed: "MÓDULO TESTE",
        otica: "", // empty, should fail
        oticaNaoAplicavel: false,
        holder: "HOLDER TESTE",
        holderNaoAplicavel: false,
        dissipador: "DISSIPADOR TESTE",
        dissipadorNaoAplicavel: false,
        driverOnoff220: "DRIVER 220V",
        driverOnoffBivolt: "DRIVER BIVOLT",
        temperaturasCor: '["2700","3000","4000","5000"]',
      })
    ).rejects.toThrow();
  });

  it("allows create when otica is empty but oticaNaoAplicavel is true", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.create({
      instalacao: "EMBUTIR",
      familia: "LUNA",
      sku: "TEST-003",
      produto: "PRODUTO TESTE",
      moduloLed: "MÓDULO TESTE",
      otica: "", // empty but NA=true, should pass
      oticaNaoAplicavel: true,
      holder: "HOLDER TESTE",
      holderNaoAplicavel: false,
      dissipador: "DISSIPADOR TESTE",
      dissipadorNaoAplicavel: false,
      driverOnoff220: "DRIVER 220V",
      driverOnoffBivolt: "DRIVER BIVOLT",
      temperaturasCor: '["2700","3000","4000","5000"]',
    });
    expect(result.success).toBe(true);
  });

  it("rejects create when holder is empty and holderNaoAplicavel is false", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.products.create({
        instalacao: "EMBUTIR",
        familia: "LUNA",
        sku: "TEST-004",
        produto: "PRODUTO TESTE",
        moduloLed: "MÓDULO TESTE",
        otica: "ÓTICA TESTE",
        oticaNaoAplicavel: false,
        holder: "", // empty, should fail
        holderNaoAplicavel: false,
        dissipador: "DISSIPADOR TESTE",
        dissipadorNaoAplicavel: false,
        driverOnoff220: "DRIVER 220V",
        driverOnoffBivolt: "DRIVER BIVOLT",
        temperaturasCor: '["2700","3000","4000","5000"]',
      })
    ).rejects.toThrow();
  });
});

describe("products.bulkCreate", () => {
  it("bulk inserts products", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.bulkCreate([
      {
        categoria: "DOWNLIGHTS",
        instalacao: "EMBUTIR",
        familia: "LUNA",
        sku: "BULK-001",
        produto: "PRODUTO BULK 1",
        moduloLed: "MÓDULO BULK",
        otica: "NÃO APLICÁVEL",
        oticaNaoAplicavel: true,
        holder: "NÃO APLICÁVEL",
        holderNaoAplicavel: true,
        dissipador: "NÃO APLICÁVEL",
        dissipadorNaoAplicavel: true,
        driverOnoff220: "DRIVER 220V",
        driverOnoffBivolt: "DRIVER BIVOLT",
        temperaturasCor: '["2700","3000","4000","5000"]',
      },
    ]);
    expect(result.success).toBe(true);
    expect(result.inserted).toBe(5);
    expect(result.skipped).toBe(0);
  });
});

describe("bulkInsertProducts - deduplication by SKU+Ótica", () => {
  it("deduplicates within batch by SKU+Ótica key, not by SKU alone", async () => {
    const { bulkInsertProducts } = await import("./db");
    // Reset mock to track calls
    (bulkInsertProducts as any).mockClear();
    (bulkInsertProducts as any).mockResolvedValue({ inserted: 2, skipped: 1 });

    const caller = appRouter.createCaller(createCtx());
    // Two products with same SKU but different ótica = both should be inserted
    // One product with same SKU+ótica as another = should be skipped
    const result = await caller.products.bulkCreate([
      {
        categoria: "SPOTS",
        instalacao: "SOBREPOR",
        familia: "ZEUS",
        sku: "LDS-2300.1CO.01B",
        produto: "ZEUS 17W 10° TRL",
        moduloLed: "LED COB 13X13MM",
        otica: "REFLETOR 15° (CP00217)",
        oticaNaoAplicavel: false,
        holder: "HOLDER C-1313",
        holderNaoAplicavel: false,
        dissipador: "NÃO APLICÁVEL",
        dissipadorNaoAplicavel: true,
        driverOnoff220: "PHILIPS 20W 500MA",
        driverOnoffBivolt: "NÃO APLICÁVEL",
        driverOnoffBivoltNaoAplicavel: true,
        temperaturasCor: '["2700","3000","4000","5000"]',
      },
      {
        categoria: "SPOTS",
        instalacao: "SOBREPOR",
        familia: "ZEUS",
        sku: "LDS-2300.1CO.01B", // same SKU
        produto: "ZEUS 17W 24° TRL",
        moduloLed: "LED COB 13X13MM",
        otica: "REFLETOR 24° (CP00802)", // different ótica = different product
        oticaNaoAplicavel: false,
        holder: "HOLDER C-1313",
        holderNaoAplicavel: false,
        dissipador: "NÃO APLICÁVEL",
        dissipadorNaoAplicavel: true,
        driverOnoff220: "PHILIPS 20W 500MA",
        driverOnoffBivolt: "NÃO APLICÁVEL",
        driverOnoffBivoltNaoAplicavel: true,
        temperaturasCor: '["2700","3000","4000","5000"]',
      },
    ]);
    expect(result.success).toBe(true);
    // Mock returns inserted:2 meaning both variants were accepted
    expect(result.inserted).toBe(2);
  });
});

describe("products.create - driver NaoAplicavel validation", () => {
  const baseProduct = {
    instalacao: "EMBUTIR",
    familia: "LUNA",
    sku: "TEST-DRV",
    produto: "PRODUTO TESTE",
    moduloLed: "MÓDULO TESTE",
    otica: "NÃO APLICÁVEL",
    oticaNaoAplicavel: true as const,
    holder: "NÃO APLICÁVEL",
    holderNaoAplicavel: true as const,
    dissipador: "NÃO APLICÁVEL",
    dissipadorNaoAplicavel: true as const,
    driverOnoff220: "DRIVER 220V",
    temperaturasCor: '["2700","3000","4000","5000"]',
  };

  it("allows create when driverOnoffBivolt is empty because Bivolt is optional", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.create({
      ...baseProduct,
      driverOnoffBivolt: "",
      driverOnoffBivoltNaoAplicavel: false,
    });
    expect(result.success).toBe(true);
  });

  it("allows create when driverOnoffBivolt is empty but NaoAplicavel is true", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.create({
      ...baseProduct,
      driverOnoffBivolt: "",
      driverOnoffBivoltNaoAplicavel: true,
    });
    expect(result.success).toBe(true);
  });

  it("allows create with driverDim110vNaoAplicavel and driverDimDaliNaoAplicavel set to true", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.create({
      ...baseProduct,
      driverOnoffBivolt: "DRIVER BIVOLT",
      driverOnoffBivoltNaoAplicavel: false,
      driverDim110v: undefined,
      driverDim110vNaoAplicavel: true,
      driverDimDali: undefined,
      driverDimDaliNaoAplicavel: true,
    });
    expect(result.success).toBe(true);
  });

  it("persists driverOnoffBivoltNaoAplicavel=true in createProduct call", async () => {
    const { createProduct } = await import("./db");
    const caller = appRouter.createCaller(createCtx());
    await caller.products.create({
      ...baseProduct,
      driverOnoffBivolt: "",
      driverOnoffBivoltNaoAplicavel: true,
    });
    const callArgs = (createProduct as any).mock.calls.at(-1)?.[0];
    expect(callArgs?.driverOnoffBivoltNaoAplicavel).toBe(true);
  });
});
