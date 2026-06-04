import express from "express";
import { getDb } from "./db";
import { revendaProducts } from "../drizzle/schema";
import { asc } from "drizzle-orm";

const router = express.Router();

// ─── Constantes de cálculo de preço de venda ────────────────────────────────
const IPI  = 0.0975;
const ST   = 0.1104;
const MULT = 1.6;

function calcularPrecoVenda(custo: number, fornecedor: string | null): number {
  const forn = (fornecedor ?? "").toUpperCase();
  if (forn.includes("REVOLUZ")) {
    return Math.round(custo * (1 + IPI) * (1 + ST) * MULT * 100) / 100;
  }
  return Math.round(custo * MULT * 100) / 100;
}

// ─── Endpoint público para o Configurador ───────────────────────────────────
// GET /api/revenda/all  (sem autenticação — consumido pelo Configurador)
router.get("/all", async (_req, res) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Cache-Control", "no-cache");

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: "Banco de dados indisponível" });
    }

    const items = await db
      .select()
      .from(revendaProducts)
      .orderBy(asc(revendaProducts.fornecedor), asc(revendaProducts.codigo));

    const formatted = items.map((p) => {
      // Preço de venda: usa o valor já armazenado (calculado na importação)
      // Se não houver precoVenda salvo mas houver custo, recalcula na hora
      let precoVenda: number | null = null;
      if (p.precoVenda != null) {
        precoVenda = Number(p.precoVenda);
      } else if (p.custo != null) {
        precoVenda = calcularPrecoVenda(Number(p.custo), p.fornecedor);
      }

      return {
        codigo:     p.codigo,
        descricao:  p.descricao,
        referencia: p.referencia ?? null,
        fornecedor: p.fornecedor ?? null,
        precoVenda,
        fotoUrl:    p.fotoUrl ?? null,
      };
    });

    return res.json({
      count: formatted.length,
      products: formatted,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[revenda/all]", err);
    return res.status(500).json({ error: "Erro ao buscar produtos de revenda" });
  }
});

export default router;
// fotoUrl fix: re-upload sem espaços Thu Jun  4 21:54:45 UTC 2026
