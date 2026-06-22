/**
 * Endpoint público para o Sistema Luna (configurador de orçamentos).
 * GET /api/componentes/all
 *
 * Retorna todos os componentes disponíveis para montagem de Itens Especiais,
 * com campos enriquecidos (potencia, tensaoEntrada, corrente) extraídos do
 * campo "modelo" via regex, e precoVenda mapeado a partir do campo "custo".
 */
import express from "express";
import { getDb } from "./db";
import { components } from "../drizzle/schema";
import { asc } from "drizzle-orm";
import { storageGetSignedUrl } from "./storage";

const router = express.Router();

// ─── Mapa tipo → família legível ──────────────────────────────────────────────
const TIPO_FAMILIA: Record<string, string> = {
  DRIVER_ONOFF_220: "DRIVERS",
  DRIVER_ONOFF_BIVOLT: "DRIVERS",
  DRIVER_DIM_110V: "DRIVERS",
  DRIVER_DIM_DALI: "DRIVERS",
  DRIVER_DIM_TRIAC_110V: "DRIVERS",
  DRIVER_DIM_TRIAC_220V: "DRIVERS",
  OTICA: "ÓPTICAS",
  HOLDER: "HOLDERS",
  DISSIPADOR: "DISSIPADORES",
  MODULO_LED: "MÓDULOS LED",
};

// ─── Extrair potência do modelo (ex: "44W", "100W") ──────────────────────────
function extractPotencia(modelo: string): string | null {
  const m = modelo.match(/\b(\d+(?:[.,]\d+)?)\s*W\b/i);
  return m ? `${m[1]}W` : null;
}

// ─── Extrair tensão de entrada do modelo ─────────────────────────────────────
function extractTensaoEntrada(modelo: string, tipo: string): string | null {
  // Bivolt tem precedência para tipos bivolt
  if (tipo === "DRIVER_ONOFF_BIVOLT" || /\bBIVOLT\b/i.test(modelo)) return "BIVOLT";
  // Tensão explícita: 220V, 127V, 110V, 24V, 12V etc.
  const m = modelo.match(/\b(220|127|110|24|12)\s*V(?:AC|DC)?\b/i);
  return m ? `${m[1]}V` : null;
}

// ─── Extrair corrente do modelo (ex: "350mA", "700mA", "1050mA") ─────────────
function extractCorrente(modelo: string): string | null {
  const m = modelo.match(/\b(\d+(?:[.,]\d+)?)\s*MA\b/i);
  return m ? `${m[1]}mA` : null;
}

// ─── Extrair chave S3 de uma fotoUrl ─────────────────────────────────────────
function extractKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^\/manus-storage\/(.+)$/);
  return match ? match[1] : url.startsWith("http") ? null : url;
}

// ─── GET /all ─────────────────────────────────────────────────────────────────
router.get("/all", async (_req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Cache-Control", "no-cache");

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Banco de dados indisponível" });

    const rows = await db
      .select()
      .from(components)
      .orderBy(asc(components.tipo), asc(components.modelo));

    // Resolver URLs públicas do S3 para componentes com foto
    const signedUrlMap = new Map<string, string>();
    const uniqueKeys = Array.from(
      new Set(rows.map((c) => extractKey(c.fotoUrl)).filter((k): k is string => !!k))
    );
    await Promise.all(
      uniqueKeys.map(async (key) => {
        try {
          signedUrlMap.set(key, await storageGetSignedUrl(key));
        } catch {
          // Não bloqueia — fotoUrl ficará null para esse item
        }
      })
    );

    // Formatar cada componente no schema esperado pelo Sistema Luna
    const items = rows.map((c) => {
      const rawKey = extractKey(c.fotoUrl);
      const resolvedFotoUrl = rawKey ? (signedUrlMap.get(rawKey) ?? null) : null;
      const modelo = c.modelo ?? "";
      return {
        codigo: c.codigo ?? null,
        descricao: modelo,
        tipo: c.tipo,
        familia: TIPO_FAMILIA[c.tipo] ?? c.tipo,
        potencia: extractPotencia(modelo),
        tensaoEntrada: extractTensaoEntrada(modelo, c.tipo),
        corrente: extractCorrente(modelo),
        precoVenda: c.custo ? Number(c.custo) : null,
        fotoUrl: resolvedFotoUrl,
        observacoes: c.observacao ?? null,
        disponivel: true,
      };
    });

    // Agrupar por tipo
    const byTipo: Record<string, typeof items> = {};
    for (const item of items) {
      if (!byTipo[item.tipo]) byTipo[item.tipo] = [];
      byTipo[item.tipo].push(item);
    }

    return res.json({
      total: items.length,
      tipos: Object.keys(byTipo),
      items,
      byTipo,
    });
  } catch (err) {
    console.error("[componentes/all]", err);
    return res.status(500).json({ error: "Erro ao buscar componentes" });
  }
});

// ─── OPTIONS /all — preflight CORS ───────────────────────────────────────────
router.options("/all", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});

export default router;
