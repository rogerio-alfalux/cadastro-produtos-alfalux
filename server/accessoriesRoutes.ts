import express from "express";
import multer from "multer";
import { getDb } from "./db";
import { accessories, components as componentsTable } from "../drizzle/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { storagePut, storageGetSignedUrl } from "./storage";

const router = express.Router();

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

// ─── Endpoint: Upload de foto de acessório ───────────────────────────────────
// POST /api/acessorios/upload-foto
router.post("/upload-foto", uploadImage.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "jpg";
    const key = `accessories/photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);

    return res.json({ url, key });
  } catch (err) {
    console.error("[acessorios/upload-foto]", err);
    return res.status(500).json({ error: "Erro ao fazer upload da imagem" });
  }
});

// ─── Endpoint: Excluir foto de acessório ─────────────────────────────────────
// DELETE /api/acessorios/:id/foto
router.delete("/:id/foto", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Banco de dados indisponível" });

    await db
      .update(accessories)
      .set({ fotoUrl: null, fotoKey: null })
      .where(eq(accessories.id, id));

    return res.json({ success: true });
  } catch (err) {
    console.error("[acessorios/delete-foto]", err);
    return res.status(500).json({ error: "Erro ao excluir foto" });
  }
});

// ─── Endpoint público para o Configurador ───────────────────────────────────
// GET /api/acessorios/all  (sem autenticação — consumido pelo Configurador)
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
      .from(accessories)
      .orderBy(asc(accessories.familia), asc(accessories.codigo));

    // Buscar drivers e fontes da tabela components para incluir como acessórios
    const DRIVER_TIPOS = [
      "DRIVER_ONOFF_220",
      "DRIVER_ONOFF_BIVOLT",
      "DRIVER_DIM_110V",
      "DRIVER_DIM_DALI",
      "DRIVER_DIM_TRIAC_110V",
      "DRIVER_DIM_TRIAC_220V",
    ] as const;
    const drivers = await db
      .select()
      .from(componentsTable)
      .where(inArray(componentsTable.tipo, DRIVER_TIPOS as any))
      .orderBy(asc(componentsTable.tipo), asc(componentsTable.modelo));

    // Mapear tipo do componente para família legível
    const tipoToFamilia: Record<string, string> = {
      DRIVER_ONOFF_220:      "Driver ON/OFF 220V",
      DRIVER_ONOFF_BIVOLT:   "Driver ON/OFF Bivolt",
      DRIVER_DIM_110V:       "Driver DIM 1-10V",
      DRIVER_DIM_DALI:       "Driver DIM DALI",
      DRIVER_DIM_TRIAC_110V: "Driver DIM TRIAC 110V",
      DRIVER_DIM_TRIAC_220V: "Driver DIM TRIAC 220V",
    };

    // Gerar URLs assinadas para acessórios com foto em paralelo
    const formattedPromises = items.map(async (a) => {
      let fotoUrl: string | null = null;
      if (a.fotoUrl) {
        const key = extractStorageKey(a.fotoUrl);
        if (key) {
          try {
            fotoUrl = await storageGetSignedUrl(key);
          } catch {
            fotoUrl = a.fotoUrl;
          }
        } else {
          fotoUrl = a.fotoUrl;
        }
      }

      return {
        id:         a.id,
        source:     "accessories" as const,
        codigo:     a.codigo ?? null,
        sku:        a.sku ?? null,
        produto:    a.produto ?? null,
        familia:    a.familia ?? null,
        dimensao:   a.dimensao ?? null,
        precoVenda: a.precoVenda != null ? Number(a.precoVenda) : null,
        custo:      a.custo != null ? Number(a.custo) : null,
        observacoes: a.observacoes ?? null,
        fotoUrl,
      };
    });

    const formattedAccessories = await Promise.all(formattedPromises);

    // Mapear drivers como acessórios (sem foto por enquanto)
    const formattedDrivers = drivers.map((d) => ({
      id:         `driver-${d.id}`,
      source:     "driver" as const,
      codigo:     d.codigo ?? null,
      sku:        d.codigo ?? null,   // usa o código EQ como SKU
      produto:    d.modelo,
      familia:    tipoToFamilia[d.tipo] ?? d.tipo,
      dimensao:   null,
      precoVenda: null,
      custo:      d.custo != null ? Number(d.custo) : null,
      observacoes: d.observacao ?? null,
      fotoUrl:    null,
    }));

    const formatted = [...formattedAccessories, ...formattedDrivers];

    return res.json({
      count: formatted.length,
      items: formatted,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[acessorios/all]", err);
    return res.status(500).json({ error: "Erro ao buscar acessórios" });
  }
});

export default router;
