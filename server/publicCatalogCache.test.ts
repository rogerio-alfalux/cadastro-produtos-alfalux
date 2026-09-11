import { describe, expect, it } from "vitest";
import {
  PUBLIC_CATALOG_CACHE_TTL_MS,
  createPublicCatalogCacheEntry,
  isFreshPublicCatalogCache,
  matchesIfNoneMatch,
} from "./publicCatalogCache";

describe("cache compatível do catálogo público", () => {
  it("mantém um ETag estável para o mesmo corpo JSON", () => {
    const body = JSON.stringify({ count: 1, products: [{ sku: "ALF-1" }] });
    expect(createPublicCatalogCacheEntry("v1", body, 100).etag)
      .toBe(createPublicCatalogCacheEntry("v1", body, 200).etag);
  });

  it("aceita ETag forte, fraco e lista de condicionais", () => {
    const entry = createPublicCatalogCacheEntry("v1", "{}", 100);
    expect(matchesIfNoneMatch(entry.etag, entry.etag)).toBe(true);
    expect(matchesIfNoneMatch(`W/${entry.etag}, \"outro\"`, entry.etag)).toBe(true);
    expect(matchesIfNoneMatch("\"outro\"", entry.etag)).toBe(false);
  });

  it("só reutiliza cache fresco com a mesma versão das fontes", () => {
    const entry = createPublicCatalogCacheEntry("fontes-1", "{}", 10_000);
    expect(isFreshPublicCatalogCache(entry, "fontes-1", 10_001)).toBe(true);
    expect(isFreshPublicCatalogCache(entry, "fontes-2", 10_001)).toBe(false);
    expect(isFreshPublicCatalogCache(entry, "fontes-1", 10_000 + PUBLIC_CATALOG_CACHE_TTL_MS)).toBe(false);
  });
});
