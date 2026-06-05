import express from "express";
import multer from "multer";
import { getDb } from "./db";
import { revendaProducts } from "../drizzle/schema";
import { asc, eq } from "drizzle-orm";
import { storagePut, storageGetSignedUrl } from "./storage";

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

// Extrai a chave do storage a partir de um fotoUrl (/manus-storage/<key>)
function extractStorageKey(fotoUrl: string): string | null {
  const match = fotoUrl.match(/^\/manus-storage\/(.+)$/);
  return match ? match[1] : null;
}

// ─── Multer para upload de imagem ────────────────────────────────────────────
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos JPEG, JPG, PNG e WEBP são aceitos"));
    }
  },
});

// ─── Endpoint: Upload de foto de produto de revenda ──────────────────────────
// POST /api/revenda/upload-foto
router.post("/upload-foto", uploadImage.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "jpg";
    const key = `revenda/photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);

    return res.json({ url, key });
  } catch (err) {
    console.error("[revenda/upload-foto]", err);
    return res.status(500).json({ error: "Erro ao fazer upload da imagem" });
  }
});

// ─── Endpoint: Excluir foto de produto de revenda ────────────────────────────
// DELETE /api/revenda/:id/foto
router.delete("/:id/foto", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Banco de dados indisponível" });

    await db
      .update(revendaProducts)
      .set({ fotoUrl: null, fotoKey: null })
      .where(eq(revendaProducts.id, id));

    return res.json({ success: true });
  } catch (err) {
    console.error("[revenda/delete-foto]", err);
    return res.status(500).json({ error: "Erro ao excluir foto" });
  }
});

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

    // Gerar URLs assinadas para todas as imagens em paralelo
    const formattedPromises = items.map(async (p) => {
      // Preço de venda: usa o valor já armazenado (calculado na importação)
      // Se não houver precoVenda salvo mas houver custo, recalcula na hora
      let precoVenda: number | null = null;
      if (p.precoVenda != null) {
        precoVenda = Number(p.precoVenda);
      } else if (p.custo != null) {
        precoVenda = calcularPrecoVenda(Number(p.custo), p.fornecedor);
      }

      // Gerar URL assinada S3 pública para a imagem (funciona em qualquer origem)
      let fotoUrl: string | null = null;
      if (p.fotoUrl) {
        const key = extractStorageKey(p.fotoUrl);
        if (key) {
          try {
            fotoUrl = await storageGetSignedUrl(key);
          } catch {
            fotoUrl = p.fotoUrl;
          }
        } else {
          fotoUrl = p.fotoUrl;
        }
      }

      return {
        codigo:     p.codigo,
        descricao:  p.descricao,
        referencia: p.referencia ?? null,
        fornecedor: p.fornecedor ?? null,
        precoVenda,
        fotoUrl,
      };
    });

    const formatted = await Promise.all(formattedPromises);

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
