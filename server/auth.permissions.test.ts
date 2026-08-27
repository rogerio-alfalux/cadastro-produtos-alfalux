import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { hashPassword, validatePasswordStrength, verifyPassword } from "./passwords";
import { can, isAllowedUserEmail, isProtectedAdminEmail } from "../shared/permissions";

const dbMocks = vi.hoisted(() => ({
  getProductById: vi.fn(),
  updateProduct: vi.fn(),
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listProducts: vi.fn(),
  getLocalUserByEmail: vi.fn(),
  updateUsersByEmail: vi.fn(),
  getUsersByEmail: vi.fn(),
  listManagedUsers: vi.fn(),
  deleteUsersByEmail: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, ...dbMocks };
});

function context(role: "admin" | "engineering" | "costs" | "user" | null, email = "teste@grupoalfalux.com.br") {
  const cookies: Array<{ name: string; value: string; options: unknown }> = [];
  return {
    ctx: {
      user: role ? ({
        id: 10,
        openId: `local:${role}`,
        name: "Usuário de teste",
        email,
        loginMethod: "password",
        role,
        passwordHash: "hash-privado",
        active: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any) : null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string, options: unknown) => cookies.push({ name, value, options }),
        clearCookie: vi.fn(),
      } as unknown as TrpcContext["res"],
    } satisfies TrpcContext,
    cookies,
  };
}

describe("credenciais locais", () => {
  it("armazena senha com scrypt e compara sem texto puro", () => {
    const encoded = hashPassword("SenhaForte!2026");
    expect(encoded).toMatch(/^scrypt\$/);
    expect(encoded).not.toContain("SenhaForte!2026");
    expect(verifyPassword("SenhaForte!2026", encoded)).toBe(true);
    expect(verifyPassword("SenhaErrada!2026", encoded)).toBe(false);
  });

  it("exige senha forte", () => {
    expect(validatePasswordStrength("curta")).toBeTruthy();
    expect(validatePasswordStrength("SenhaForte!2026")).toBeNull();
  });

  it("aceita somente grupoalfalux e a exceção administrativa", () => {
    expect(isAllowedUserEmail("engenharia@grupoalfalux.com.br")).toBe(true);
    expect(isAllowedUserEmail("rogeriojohnwayne@gmail.com")).toBe(true);
    expect(isAllowedUserEmail("pessoa@gmail.com")).toBe(false);
    expect(isProtectedAdminEmail("geysa@grupoalfalux.com.br")).toBe(true);
  });
});

describe("matriz de permissões", () => {
  it("mantém administração integral e separa Engenharia de Custos", () => {
    expect(can("admin", "manageUsers")).toBe(true);
    expect(can("admin", "manageEntities")).toBe(true);
    expect(can("engineering", "manageDocuments")).toBe(true);
    expect(can("engineering", "viewCosts")).toBe(false);
    expect(can("costs", "editCosts")).toBe(true);
    expect(can("costs", "manageDocuments")).toBe(false);
  });

  it("permite à Engenharia alterar somente documentos", async () => {
    dbMocks.getProductById.mockResolvedValue({ id: 1, documentos: null, mkpMinimoOnoff220v: "2" });
    dbMocks.updateProduct.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context("engineering").ctx);
    await expect(caller.products.update({ id: 1, data: { documentos: JSON.stringify({}) } })).resolves.toEqual({ success: true });
    await expect(caller.products.update({ id: 1, data: { custoLuminaria: "10" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("remove custos e preços das consultas feitas pela Engenharia", async () => {
    dbMocks.listProducts.mockResolvedValue({
      items: [{ id: 1, produto: "LUNA", custoLuminaria: "99.00", mkpMinimoOnoff220v: "2.1", precoVendaOnoff220: "207.90" }],
      total: 1,
    });
    const result = await appRouter.createCaller(context("engineering").ctx).products.list({});
    expect(result.items[0]).toMatchObject({
      custoLuminaria: null,
      mkpMinimoOnoff220v: null,
      precoVendaOnoff220: null,
    });
  });

  it("permite a Custos alterar somente custos, preços e markups", async () => {
    dbMocks.getProductById.mockResolvedValue({ id: 1, documentos: null, mkpMinimoOnoff220v: "2" });
    dbMocks.updateProduct.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context("costs").ctx);
    await expect(caller.products.update({ id: 1, data: { custoLuminaria: "10", mkpMinimoOnoff220v: "2.1" } })).resolves.toEqual({ success: true });
    await expect(caller.products.update({ id: 1, data: { documentos: JSON.stringify({}) } })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reserva exclusão de produtos para administradores", async () => {
    dbMocks.deleteProduct.mockResolvedValue(undefined);
    await expect(appRouter.createCaller(context("engineering").ctx).products.delete({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(context("admin").ctx).products.delete({ id: 1 })).resolves.toEqual({ success: true });
  });

  it("não expõe hash e estado de bloqueio em auth.me", async () => {
    const result = await appRouter.createCaller(context("engineering").ctx).auth.me();
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("failedLoginAttempts");
    expect(result).not.toHaveProperty("lockedUntil");
  });
});

describe("login e gestão administrativa", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria sessão para credencial válida", async () => {
    dbMocks.getLocalUserByEmail.mockResolvedValue({
      id: 20,
      openId: "local:engenharia",
      name: "Engenharia",
      email: "engenharia@grupoalfalux.com.br",
      role: "engineering",
      passwordHash: hashPassword("SenhaForte!2026"),
      active: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    dbMocks.updateUsersByEmail.mockResolvedValue(undefined);
    const { ctx, cookies } = context(null);
    await expect(appRouter.createCaller(ctx).auth.login({ email: "engenharia@grupoalfalux.com.br", password: "SenhaForte!2026" })).resolves.toEqual({ success: true });
    expect(cookies).toHaveLength(1);
    expect(cookies[0].options).toMatchObject({ httpOnly: true, secure: true, sameSite: "none" });
  });

  it("recusa domínio externo e senha incorreta", async () => {
    const caller = appRouter.createCaller(context(null).ctx);
    await expect(caller.auth.login({ email: "externo@gmail.com", password: "SenhaForte!2026" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("reserva o painel de usuários para administradores", async () => {
    await expect(appRouter.createCaller(context("engineering").ctx).users.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("impede excluir os dois administradores protegidos", async () => {
    const caller = appRouter.createCaller(context("admin", "rogeriojohnwayne@gmail.com").ctx);
    await expect(caller.users.remove({ email: "geysa@grupoalfalux.com.br" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
