import { describe, expect, it } from "vitest";
import {
  PUBLIC_CATALOG_CACHE_TTL_MS,
  PUBLIC_CATALOG_ETAG_WINDOW_MS,
  acceptsGzipEncoding,
  canServePublicCatalogFallback,
  createKeyedSingleFlight,
  createPublicCatalogCacheEntry,
  createPublicCatalogEtag,
  createPublicCatalogRepresentationVersion,
  isFreshPublicCatalogCache,
  mapWithConcurrency,
  matchesIfNoneMatch,
} from "./publicCatalogCache";

describe("cache compatível do catálogo público", () => {
  it("mantém ETag semântico estável entre instâncias para a mesma versão das fontes", () => {
    expect(createPublicCatalogCacheEntry("v1", '{"updatedAt":"primeira"}', 100).etag)
      .toBe(createPublicCatalogCacheEntry("v1", '{"updatedAt":"segunda"}', 200).etag);
    expect(createPublicCatalogEtag("v1")).not.toBe(createPublicCatalogEtag("v2"));
  });

  it("renova a versão de representação antes de as URLs assinadas vencerem", () => {
    const first = createPublicCatalogRepresentationVersion("fontes-1", 100);
    expect(createPublicCatalogRepresentationVersion("fontes-1", PUBLIC_CATALOG_ETAG_WINDOW_MS - 1)).toBe(first);
    expect(createPublicCatalogRepresentationVersion("fontes-1", PUBLIC_CATALOG_ETAG_WINDOW_MS)).not.toBe(first);
    expect(createPublicCatalogRepresentationVersion("fontes-2", 100)).not.toBe(first);
  });

  it("pré-comprime uma representação completa que volta ao JSON original", async () => {
    const { gunzip } = await import("node:zlib");
    const { promisify } = await import("node:util");
    const body = JSON.stringify({ count: 2, available: 2, products: [{ sku: "A" }, { sku: "B" }] });
    const entry = createPublicCatalogCacheEntry("v1", body, 100);
    await expect(promisify(gunzip)(entry.gzipBody)).resolves.toEqual(Buffer.from(body));
  });

  it("aceita ETag forte, fraco e lista de condicionais", () => {
    const entry = createPublicCatalogCacheEntry("v1", "{}", 100);
    expect(matchesIfNoneMatch(entry.etag, entry.etag)).toBe(true);
    expect(matchesIfNoneMatch(`${entry.etag.replace(/^W\//, "")}, \"outro\"`, entry.etag)).toBe(true);
    expect(matchesIfNoneMatch("\"outro\"", entry.etag)).toBe(false);
  });

  it("só reutiliza cache fresco com a mesma versão das fontes", () => {
    const entry = createPublicCatalogCacheEntry("fontes-1", "{}", 10_000);
    expect(isFreshPublicCatalogCache(entry, "fontes-1", 10_001)).toBe(true);
    expect(isFreshPublicCatalogCache(entry, "fontes-2", 10_001)).toBe(false);
    expect(isFreshPublicCatalogCache(entry, "fontes-1", 10_000 + PUBLIC_CATALOG_CACHE_TTL_MS)).toBe(false);
  });

  it("só permite fallback enquanto o snapshot e suas URLs ainda estão na janela segura", () => {
    const entry = createPublicCatalogCacheEntry("fontes-1", "{}", 10_000);
    expect(canServePublicCatalogFallback(entry, 10_001)).toBe(true);
    expect(canServePublicCatalogFallback(entry, 10_000 + PUBLIC_CATALOG_CACHE_TTL_MS)).toBe(false);
  });

  it("negocia gzip sem aceitar codificação explicitamente desabilitada", () => {
    expect(acceptsGzipEncoding("br, gzip, deflate")).toBe(true);
    expect(acceptsGzipEncoding("gzip;q=0, br")).toBe(false);
    expect(acceptsGzipEncoding("gzip;q=0, *;q=0.5")).toBe(false);
    expect(acceptsGzipEncoding("*;q=0.5")).toBe(true);
    expect(acceptsGzipEncoding(undefined)).toBe(false);
  });

  it("limita operações concorrentes e preserva a ordem dos resultados", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return value * 10;
    });
    expect(peak).toBe(2);
    expect(results).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("coalesce reconstruções simultâneas da mesma versão em uma única Promise", async () => {
    const singleFlight = createKeyedSingleFlight<number>();
    let builds = 0;
    const builder = async () => {
      builds += 1;
      await new Promise((resolve) => setTimeout(resolve, 2));
      return 42;
    };
    const first = singleFlight.run("v1", builder);
    const second = singleFlight.run("v1", builder);
    expect(singleFlight.has("v1")).toBe(true);
    await expect(Promise.all([first, second])).resolves.toEqual([42, 42]);
    expect(builds).toBe(1);
    expect(singleFlight.has("v1")).toBe(false);
  });

  it("libera a coalescência após falha para permitir uma tentativa posterior", async () => {
    const singleFlight = createKeyedSingleFlight<number>();
    await expect(singleFlight.run("v1", async () => { throw new Error("temporário"); })).rejects.toThrow("temporário");
    await expect(singleFlight.run("v1", async () => 7)).resolves.toBe(7);
  });
});
