import type { Request, Response } from "express";
import JSZip from "jszip";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { storagePut } from "./storage";
import {
  backups,
  products,
  components,
  revendaProducts,
  accessories,
  users,
} from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";

/**
 * Gera um dump SQL de INSERT statements para um conjunto de linhas.
 * Produz INSERTs compatíveis com MySQL/TiDB.
 */
function buildInsertDump(tableName: string, rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return `-- Tabela ${tableName}: sem registros\n\n`;

  const lines: string[] = [
    `-- ─── Tabela: ${tableName} (${rows.length} registros) ───────────────────────────`,
  ];

  for (const row of rows) {
    const cols = Object.keys(row)
      .map((c) => `\`${c}\``)
      .join(", ");
    const vals = Object.values(row)
      .map((v) => {
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "boolean") return v ? "1" : "0";
        if (typeof v === "number") return String(v);
        if (v instanceof Date) return `'${v.toISOString().replace("T", " ").slice(0, 19)}'`;
        // Escapar aspas simples e barras
        return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
      })
      .join(", ");
    lines.push(`INSERT INTO \`${tableName}\` (${cols}) VALUES (${vals});`);
  }

  return lines.join("\n") + "\n\n";
}

/**
 * Coleta todas as URLs de imagens do banco (produtos, componentes, revenda, acessórios).
 */
function collectImageUrls(
  allProducts: Record<string, unknown>[],
  allComponents: Record<string, unknown>[],
  allRevenda: Record<string, unknown>[],
  allAccessories: Record<string, unknown>[],
): string[] {
  const urls = new Set<string>();

  for (const p of allProducts) {
    if (p.fotoUrl && typeof p.fotoUrl === "string") urls.add(p.fotoUrl);
  }
  for (const c of allComponents) {
    if (c.fotoUrl && typeof c.fotoUrl === "string") urls.add(c.fotoUrl);
  }
  for (const r of allRevenda) {
    if (r.fotoUrl && typeof r.fotoUrl === "string") urls.add(r.fotoUrl);
  }
  for (const a of allAccessories) {
    if (a.fotoUrl && typeof a.fotoUrl === "string") urls.add(a.fotoUrl);
  }

  return Array.from(urls).sort();
}

/**
 * Gera um arquivo ZIP em memória contendo:
 *  - README.txt          → instruções de restauração
 *  - backup.json         → todos os dados de todas as tabelas em JSON
 *  - backup.sql          → dump SQL com INSERT statements para restauração
 *  - imagens_urls.txt    → lista de todas as URLs de imagens
 *
 * Retorna o Buffer do ZIP.
 */
async function buildBackupZip(
  allProducts: Record<string, unknown>[],
  allComponents: Record<string, unknown>[],
  allRevenda: Record<string, unknown>[],
  allAccessories: Record<string, unknown>[],
  allUsers: Record<string, unknown>[],
  allBackupRecords: Record<string, unknown>[],
  now: Date,
): Promise<{ buffer: Buffer; counts: Record<string, number> }> {
  const zip = new JSZip();

  const counts = {
    products: allProducts.length,
    components: allComponents.length,
    revendaProducts: allRevenda.length,
    accessories: allAccessories.length,
    users: allUsers.length,
    backups: allBackupRecords.length,
    total:
      allProducts.length +
      allComponents.length +
      allRevenda.length +
      allAccessories.length,
  };

  const brasiliaStr = now.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // ── 1. backup.json ──────────────────────────────────────────────────────────
  const backupJson = {
    version: "2.0",
    generatedAt: now.toISOString(),
    generatedAtBrasilia: brasiliaStr,
    counts,
    data: {
      products: allProducts,
      components: allComponents,
      revendaProducts: allRevenda,
      accessories: allAccessories,
      users: allUsers.map((u) => ({
        // Incluir apenas dados cadastrais (sem tokens de sessão)
        id: u.id,
        openId: u.openId,
        name: u.name,
        email: u.email,
        loginMethod: u.loginMethod,
        role: u.role,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        lastSignedIn: u.lastSignedIn,
      })),
      backups: allBackupRecords,
    },
  };

  zip.file("backup.json", JSON.stringify(backupJson, null, 2));

  // ── 2. backup.sql ───────────────────────────────────────────────────────────
  const sqlHeader = [
    "-- ============================================================",
    "-- Alfalux Cadastro de Produtos — Dump SQL Completo",
    `-- Gerado em: ${now.toISOString()}`,
    `-- Horário de Brasília: ${brasiliaStr}`,
    "-- Banco: MySQL / TiDB",
    "-- ============================================================",
    "",
    "SET NAMES utf8mb4;",
    "SET foreign_key_checks = 0;",
    "",
  ].join("\n");

  const sqlDump =
    sqlHeader +
    buildInsertDump("products", allProducts) +
    buildInsertDump("components", allComponents) +
    buildInsertDump("revenda_products", allRevenda) +
    buildInsertDump("accessories", allAccessories) +
    buildInsertDump("users", allUsers) +
    buildInsertDump("backups", allBackupRecords) +
    "\nSET foreign_key_checks = 1;\n";

  zip.file("backup.sql", sqlDump);

  // ── 3. imagens_urls.txt ─────────────────────────────────────────────────────
  const imageUrls = collectImageUrls(allProducts, allComponents, allRevenda, allAccessories);

  const imagesContent = [
    `# URLs de Imagens — Alfalux Cadastro de Produtos`,
    `# Gerado em: ${now.toISOString()}`,
    `# Total de imagens únicas: ${imageUrls.length}`,
    "",
    ...imageUrls,
  ].join("\n");

  zip.file("imagens_urls.txt", imagesContent);

  // ── 4. README.txt ────────────────────────────────────────────────────────────
  const readme = [
    "ALFALUX — BACKUP COMPLETO DO SISTEMA",
    "=====================================",
    "",
    `Data/Hora: ${brasiliaStr} (horário de Brasília)`,
    `UTC: ${now.toISOString()}`,
    "",
    "Conteúdo deste arquivo ZIP:",
    "",
    "  backup.json        — Todos os dados do banco em formato JSON",
    `                       ${counts.products} produtos`,
    `                       ${counts.components} componentes`,
    `                       ${counts.revendaProducts} produtos de revenda`,
    `                       ${counts.accessories} acessórios`,
    `                       ${counts.users} usuários`,
    `                       ${counts.backups} registros de backup anteriores`,
    "",
    "  backup.sql         — Dump SQL com INSERT statements para restauração",
    "                       Compatível com MySQL / TiDB",
    "                       Execute: mysql -u user -p database < backup.sql",
    "",
    `  imagens_urls.txt   — Lista de ${imageUrls.length} URLs únicas de imagens`,
    "                       (fotos de produtos, componentes, revenda e acessórios)",
    "                       As imagens estão no storage da plataforma Manus",
    "",
    "  README.txt         — Este arquivo",
    "",
    "Para restaurar o banco:",
    "  1. Crie um banco de dados MySQL/TiDB vazio",
    "  2. Execute as migrações do schema (drizzle/schema.ts)",
    "  3. Execute: mysql -u user -p database < backup.sql",
    "",
    "As imagens podem ser baixadas individualmente pelas URLs em imagens_urls.txt.",
  ].join("\n");

  zip.file("README.txt", readme);

  // Gerar ZIP com compressão máxima
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return { buffer, counts };
}

/**
 * Gera um backup completo do banco de dados em formato ZIP
 * e salva no storage. Registra o resultado na tabela `backups`.
 */
export async function runBackup(): Promise<{
  ok: boolean;
  backupId?: number;
  error?: string;
  counts?: Record<string, number>;
}> {
  const db = await getDb();
  if (!db) return { ok: false, error: "Database not available" };

  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "-"); // HH-MM-SS
    const filename = `backup_${dateStr}_${timeStr}.zip`;

    // Buscar todos os dados de todas as tabelas
    const [
      allProducts,
      allComponents,
      allRevenda,
      allAccessories,
      allUsers,
      allBackupRecords,
    ] = await Promise.all([
      db.select().from(products),
      db.select().from(components),
      db.select().from(revendaProducts),
      db.select().from(accessories),
      db.select().from(users),
      db.select().from(backups).orderBy(desc(backups.createdAt)).limit(100),
    ]);

    // Gerar o ZIP em memória
    const { buffer: zipBuffer, counts } = await buildBackupZip(
      allProducts as unknown as Record<string, unknown>[],
      allComponents as unknown as Record<string, unknown>[],
      allRevenda as unknown as Record<string, unknown>[],
      allAccessories as unknown as Record<string, unknown>[],
      allUsers as unknown as Record<string, unknown>[],
      allBackupRecords as unknown as Record<string, unknown>[],
      now,
    );

    const sizeBytes = zipBuffer.length;

    // Fazer upload para o storage
    const { key: storageKey } = await storagePut(
      `backups/${filename}`,
      zipBuffer,
      "application/zip",
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
    const allBackupsRows = await db
      .select({ id: backups.id })
      .from(backups)
      .where(eq(backups.status, "success"))
      .orderBy(desc(backups.createdAt));

    if (allBackupsRows.length > 30) {
      const toDelete = allBackupsRows.slice(30);
      for (const b of toDelete) {
        await db.delete(backups).where(eq(backups.id, b.id));
      }
    }

    console.log(
      `[Backup] Sucesso: ${filename} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB, ${counts.total} registros)`,
    );
    return { ok: true, backupId: (result as any).insertId, counts };
  } catch (err: any) {
    console.error("[Backup] Erro:", err);
    // Registrar falha na tabela
    try {
      const db2 = await getDb();
      if (db2) {
        await db2.insert(backups).values({
          filename: `backup_error_${Date.now()}.zip`,
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
      return res.json({ ok: true, backupId: result.backupId, counts: result.counts });
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
