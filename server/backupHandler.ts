import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { storagePut, storageGetSignedUrl } from "./storage";
import { backups, products, components, revendaProducts, accessories, users } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";

/**
 * Gera um backup completo do banco de dados em formato JSON
 * e salva no storage. Registra o resultado na tabela `backups`.
 */
export async function runBackup(): Promise<{ ok: boolean; backupId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { ok: false, error: "Database not available" };

  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "-"); // HH-MM-SS
    const filename = `backup_${dateStr}_${timeStr}.json`;

    // Buscar todos os dados das tabelas principais
    const [
      allProducts,
      allComponents,
      allRevenda,
      allAccessories,
    ] = await Promise.all([
      db.select().from(products),
      db.select().from(components),
      db.select().from(revendaProducts),
      db.select().from(accessories),
    ]);

    const counts = {
      products: allProducts.length,
      components: allComponents.length,
      revendaProducts: allRevenda.length,
      accessories: allAccessories.length,
      total: allProducts.length + allComponents.length + allRevenda.length + allAccessories.length,
    };

    const backupData = {
      version: "1.0",
      generatedAt: now.toISOString(),
      counts,
      data: {
        products: allProducts,
        components: allComponents,
        revendaProducts: allRevenda,
        accessories: allAccessories,
      },
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const buffer = Buffer.from(jsonStr, "utf-8");
    const sizeBytes = buffer.length;

    // Fazer upload para o storage
    const { key: storageKey } = await storagePut(
      `backups/${filename}`,
      buffer,
      "application/json"
    );

    // Registrar o backup na tabela
    const [result] = await db.insert(backups).values({
      filename,
      storageKey,
      sizeBytes,
      counts: JSON.stringify(counts),
      status: "success",
    });

    // Manter apenas os últimos 30 backups — apagar registros mais antigos
    // (os arquivos no storage ficam, apenas o registro é removido)
    const allBackups = await db.select({ id: backups.id })
      .from(backups)
      .where(eq(backups.status, "success"))
      .orderBy(desc(backups.createdAt));

    if (allBackups.length > 30) {
      const toDelete = allBackups.slice(30);
      for (const b of toDelete) {
        await db.delete(backups).where(eq(backups.id, b.id));
      }
    }

    console.log(`[Backup] Sucesso: ${filename} (${(sizeBytes / 1024).toFixed(1)} KB, ${counts.total} registros)`);
    return { ok: true, backupId: (result as any).insertId };

  } catch (err: any) {
    console.error("[Backup] Erro:", err);
    // Registrar falha na tabela
    try {
      const db2 = await getDb();
      if (db2) {
        await db2.insert(backups).values({
          filename: `backup_error_${Date.now()}.json`,
          storageKey: "",
          sizeBytes: 0,
          status: "error",
          errorMessage: String(err?.message || err),
        });
      }
    } catch (_) {}
    return { ok: false, error: String(err?.message || err) };
  }
}

/**
 * Handler Express para o endpoint /api/scheduled/backup
 * Chamado pelo cron diário da plataforma Manus.
 */
export async function backupCronHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    const result = await runBackup();

    if (result.ok) {
      return res.json({ ok: true, backupId: result.backupId });
    } else {
      return res.status(500).json({
        error: result.error,
        timestamp: new Date().toISOString(),
        context: { taskUid: user.taskUid },
      });
    }
  } catch (err: any) {
    console.error("[Backup Handler] Erro:", err);
    return res.status(500).json({
      error: String(err?.message || err),
      stack: err?.stack,
      timestamp: new Date().toISOString(),
    });
  }
}
