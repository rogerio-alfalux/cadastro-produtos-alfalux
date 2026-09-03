import { describe, expect, it } from "vitest";
import { resolveInternalProductDocument } from "./productRoutes";

describe("abertura interna de documentos de produto", () => {
  const documentos = JSON.stringify({
    datasheet: {
      key: "products/documents/datasheet/ficha-antiga.pdf",
      url: "/manus-storage/products/documents/datasheet/ficha_1a2b3c4d.pdf",
      nome: "ficha.pdf",
      mimeType: "application/pdf",
    },
    manualInstalacao: {
      key: "products/documents/manualInstalacao/manual_5e6f7a8b.pdf",
      url: "/manus-storage/products/documents/manualInstalacao/manual_5e6f7a8b.pdf",
      nome: "manual.pdf",
      mimeType: "application/pdf",
    },
  });

  it("resolve a chave final armazenada para renovar a assinatura no momento do clique", () => {
    expect(resolveInternalProductDocument(documentos, "datasheet")).toMatchObject({
      key: "products/documents/datasheet/ficha_1a2b3c4d.pdf",
      document: { nome: "ficha.pdf" },
    });
  });

  it("abrange Manual de Instalação e rejeita tipos não reconhecidos", () => {
    expect(resolveInternalProductDocument(documentos, "manualInstalacao")).toMatchObject({
      key: "products/documents/manualInstalacao/manual_5e6f7a8b.pdf",
    });
    expect(resolveInternalProductDocument(documentos, "arquivo-invalido")).toBeNull();
  });

  it("não tenta abrir um documento que não está associado ao produto", () => {
    expect(resolveInternalProductDocument(documentos, "fotometria")).toBeNull();
  });
});
