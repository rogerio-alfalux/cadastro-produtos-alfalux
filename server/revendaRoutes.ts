import express from "express";
import { getDb } from "./db";
import { revendaProducts } from "../drizzle/schema";
import { asc } from "drizzle-orm";

const router = express.Router();

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

    const formatted = items.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      descricao: p.descricao,
      referencia: p.referencia ?? null,
      fornecedor: p.fornecedor ?? null,
      observacoes: p.observacoes ?? null,
      fotoUrl: p.fotoUrl ?? null,
      custo: p.custo != null ? Number(p.custo) : null,
      precoVenda: p.precoVenda != null ? Number(p.precoVenda) : null,
    }));

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
