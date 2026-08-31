import { describe, expect, it } from "vitest";
import { bulkDocumentsInputSchema, getBulkDocumentFilterOptions, mergeSharedDocuments, type ProductDocuments } from "./routers/documentsBulk";

const datasheet = { url: "/manus-storage/products/documents/datasheet/original.pdf", key: "products/documents/datasheet/original.pdf", nome: "datasheet.pdf", mimeType: "application/pdf" };
const ies = { url: "/manus-storage/products/documents/fotometria/original.ies", key: "products/documents/fotometria/original.ies", nome: "fotometria.ies", mimeType: "application/octet-stream" };
const technical = { url: "/manus-storage/products/documents/desenho/original.pdf", key: "products/documents/desenho/original.pdf", nome: "desenho.pdf", mimeType: "application/pdf" };
const manual = { url: "/manus-storage/products/documents/manualInstalacao/original.pdf", key: "products/documents/manualInstalacao/original.pdf", nome: "manual.pdf", mimeType: "application/pdf" };

describe("mergeSharedDocuments", () => {
  it("reutiliza as mesmas chaves de storage sem criar cópias dos arquivos", () => {
    const source: ProductDocuments = { datasheet, fotometria: ies };
    const result = mergeSharedDocuments({}, source, ["datasheet", "fotometria"], false);
    expect(result.changed).toBe(true);
    expect(result.documents.datasheet).toEqual(datasheet);
    expect(result.documents.fotometria).toEqual(ies);
    expect(result.documents.datasheet?.key).toBe(source.datasheet?.key);
    expect(result.documents.fotometria?.key).toBe(source.fotometria?.key);
  });

  it("preserva documentos já existentes quando a substituição não for autorizada", () => {
    const current: ProductDocuments = { datasheet: technical };
    const result = mergeSharedDocuments(current, { datasheet, fotometria: ies }, ["datasheet", "fotometria"], false);
    expect(result.changed).toBe(true);
    expect(result.documents.datasheet).toEqual(technical);
    expect(result.documents.fotometria).toEqual(ies);
  });

  it("substitui somente os tipos selecionados quando solicitado", () => {
    const current: ProductDocuments = { datasheet: technical, desenhoTecnico: technical };
    const result = mergeSharedDocuments(current, { datasheet, fotometria: ies }, ["datasheet"], true);
    expect(result.changed).toBe(true);
    expect(result.documents.datasheet).toEqual(datasheet);
    expect(result.documents.desenhoTecnico).toEqual(technical);
    expect(result.documents.fotometria).toBeUndefined();
  });

  it("substitui um arquivo atualizado e preserva os demais anexos do produto", () => {
    const updatedDatasheet = { ...datasheet, key: "products/documents/datasheet/atualizado_hash.pdf", url: "/manus-storage/products/documents/datasheet/atualizado_hash.pdf", nome: "datasheet-revisado.pdf" };
    const current: ProductDocuments = { datasheet, fotometria: ies, desenhoTecnico: technical };
    const result = mergeSharedDocuments(current, { datasheet: updatedDatasheet }, ["datasheet"], true);
    expect(result.changed).toBe(true);
    expect(result.documents.datasheet).toEqual(updatedDatasheet);
    expect(result.documents.fotometria).toEqual(ies);
    expect(result.documents.desenhoTecnico).toEqual(technical);
  });

  it("não marca alteração quando o produto já referencia o mesmo arquivo", () => {
    const current: ProductDocuments = { datasheet };
    const result = mergeSharedDocuments(current, { datasheet }, ["datasheet"], true);
    expect(result.changed).toBe(false);
    expect(result.documents).toEqual(current);
  });

  it("aplica o Manual de Instalação sem substituir os demais documentos", () => {
    const current: ProductDocuments = { datasheet, desenhoTecnico: technical };
    const result = mergeSharedDocuments(current, { manualInstalacao: manual }, ["manualInstalacao"], false);
    expect(result.changed).toBe(true);
    expect(result.documents).toEqual({ datasheet, desenhoTecnico: technical, manualInstalacao: manual });
  });

  it("oferece somente a categoria e a instalação reais da família LUNA", () => {
    const options = getBulkDocumentFilterOptions([
      { familia: "LUNA", categoria: "DOWNLIGHTS", instalacao: "EMBUTIR", potencia: null },
      { familia: "LUNA", categoria: "DOWNLIGHTS", instalacao: "SOBREPOR", potencia: null },
      { familia: "BLAZE H", categoria: "PERFIS", instalacao: "PENDENTE", potencia: "18W" },
    ], { familia: "LUNA" });
    expect(options.categorias).toEqual(["DOWNLIGHTS"]);
    expect(options.instalacoes).toEqual(["EMBUTIR", "SOBREPOR"]);
    expect(options.potencias).toEqual([]);
  });

  it("exige produtos marcados quando a aplicação individual é selecionada", () => {
    const base = {
      familia: "LUNA",
      tipos: ["datasheet"] as const,
      documentos: { datasheet },
    };
    expect(bulkDocumentsInputSchema.safeParse({ ...base, modoSelecao: "selecionados", produtosSelecionados: [] }).success).toBe(false);
    expect(bulkDocumentsInputSchema.safeParse({ ...base, modoSelecao: "selecionados", produtosSelecionados: [101, 102] }).success).toBe(true);
    expect(bulkDocumentsInputSchema.safeParse({ ...base, modoSelecao: "todos", produtosSelecionados: [] }).success).toBe(true);
  });
});
