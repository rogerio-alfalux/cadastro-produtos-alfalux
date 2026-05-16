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
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  createProduct: vi.fn().mockResolvedValue({ insertId: 2 }),
  updateProduct: vi.fn().mockResolvedValue(undefined),
  deleteProduct: vi.fn().mockResolvedValue(undefined),
  bulkInsertProducts: vi.fn().mockResolvedValue(5),
  countProducts: vi.fn().mockResolvedValue(208),
}));

// ─── Context ──────────────────────────────────────────────────────────────────

function createCtx(): TrpcContext {
  return {
    user: null,
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
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.products.list({
      search: "LUNA",
      categoria: "DOWNLIGHTS",
      instalacao: "EMBUTIR",
      limit: 10,
      offset: 0,
    });
    expect(result).toBeDefined();
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

  it("rejects create when driverOnoffBivolt is empty and NaoAplicavel is false", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.products.create({
        ...baseProduct,
        driverOnoffBivolt: "",
        driverOnoffBivoltNaoAplicavel: false,
      })
    ).rejects.toThrow();
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
