import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

// As URLs assinadas atuais duram aproximadamente 60 minutos. Mantemos margem
// de segurança para nunca devolver uma URL próxima do vencimento.
export const PUBLIC_CATALOG_CACHE_TTL_MS = 45 * 60 * 1000;
export const PUBLIC_CATALOG_ETAG_WINDOW_MS = 40 * 60 * 1000;
// O catálogo pode ser armazenado pelo cliente, mas nunca reutilizado sem
// revalidar o ETag. Assim, qualquer alteração de custo ou produto aparece na
// próxima leitura, enquanto respostas sem mudança continuam leves via 304.
export const PUBLIC_CATALOG_CACHE_CONTROL = "public, no-cache, max-age=0, must-revalidate";

export type PublicCatalogCacheEntry = {
  sourceVersion: string;
  body: string;
  gzipBody: Buffer;
  etag: string;
  createdAt: number;
  expiresAt: number;
};

export function createPublicCatalogEtag(sourceVersion: string): string {
  const hash = createHash("sha256").update(sourceVersion).digest("hex");
  // Duas instâncias podem gerar assinaturas temporárias diferentes para o mesmo
  // cadastro. O ETag é fraco de propósito: a representação é semanticamente a
  // mesma enquanto a versão das fontes não mudar.
  return `W/"${hash}"`;
}

export function createPublicCatalogRepresentationVersion(
  sourceVersion: string,
  now = Date.now(),
): string {
  // A janela faz o ETag mudar antes de as URLs assinadas (cerca de 60 min)
  // vencerem, mesmo quando o cadastro em si não recebeu alterações.
  return `${sourceVersion}|url-window:${Math.floor(now / PUBLIC_CATALOG_ETAG_WINDOW_MS)}`;
}

export function createPublicCatalogCacheEntry(
  sourceVersion: string,
  body: string,
  now = Date.now(),
): PublicCatalogCacheEntry {
  return {
    sourceVersion,
    body,
    gzipBody: gzipSync(body, { level: 6 }),
    etag: createPublicCatalogEtag(sourceVersion),
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
  const normalizedEtag = etag.replace(/^W\//, "");
  return value
    .split(",")
    .map((item) => item.trim().replace(/^W\//, ""))
    .some((item) => item === "*" || item === normalizedEtag);
}

export function canServePublicCatalogFallback(
  entry: PublicCatalogCacheEntry | null,
  now = Date.now(),
): entry is PublicCatalogCacheEntry {
  return !!entry && entry.expiresAt > now;
}

export function acceptsGzipEncoding(value: string | undefined): boolean {
  if (!value) return false;
  let gzipQuality: number | null = null;
  let wildcardQuality: number | null = null;
  for (const part of value.split(",")) {
    const [rawEncoding, ...parameters] = part.trim().toLowerCase().split(";");
    const qParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const quality = qParameter ? Number(qParameter.trim().slice(2)) : 1;
    const normalizedQuality = Number.isFinite(quality) ? quality : 0;
    if (rawEncoding === "gzip") gzipQuality = normalizedQuality;
    if (rawEncoding === "*") wildcardQuality = normalizedQuality;
  }
  return (gzipQuality ?? wildcardQuality ?? 0) > 0;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("A concorrência deve ser um inteiro maior que zero");
  }
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

export function createKeyedSingleFlight<T>() {
  const inFlight = new Map<string, Promise<T>>();
  return {
    has(key: string): boolean {
      return inFlight.has(key);
    },
    run(key: string, builder: () => Promise<T>): Promise<T> {
      const existing = inFlight.get(key);
      if (existing) return existing;

      const promise = Promise.resolve().then(builder);
      inFlight.set(key, promise);
      void promise
        .finally(() => {
          if (inFlight.get(key) === promise) inFlight.delete(key);
        })
        .catch(() => undefined);
      return promise;
    },
  };
}
