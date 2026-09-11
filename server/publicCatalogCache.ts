import { createHash } from "node:crypto";

// As URLs assinadas atuais duram aproximadamente 60 minutos. Mantemos margem
// de segurança para nunca devolver uma URL próxima do vencimento.
export const PUBLIC_CATALOG_CACHE_TTL_MS = 45 * 60 * 1000;

export type PublicCatalogCacheEntry = {
  sourceVersion: string;
  body: string;
  etag: string;
  createdAt: number;
  expiresAt: number;
};

export function createPublicCatalogCacheEntry(
  sourceVersion: string,
  body: string,
  now = Date.now(),
): PublicCatalogCacheEntry {
  return {
    sourceVersion,
    body,
    etag: `"${createHash("sha256").update(body).digest("hex")}"`,
    createdAt: now,
    expiresAt: now + PUBLIC_CATALOG_CACHE_TTL_MS,
  };
}

export function isFreshPublicCatalogCache(
  entry: PublicCatalogCacheEntry | null,
  sourceVersion: string | null,
  now = Date.now(),
): entry is PublicCatalogCacheEntry {
  return !!entry && !!sourceVersion && entry.sourceVersion === sourceVersion && entry.expiresAt > now;
}

export function matchesIfNoneMatch(value: string | undefined, etag: string): boolean {
  if (!value) return false;
  return value
    .split(",")
    .map((item) => item.trim().replace(/^W\//, ""))
    .some((item) => item === "*" || item === etag);
}
