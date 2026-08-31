import { describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  storageGet: vi.fn(),
  storageGetSignedUrl: vi.fn(),
}));

import { storageGetSignedUrl } from "./storage";
import { extractProductDocumentKey, resolveProductDocumentViewUrls } from "./routers";

describe("URLs de visualização de documentos internos", () => {
  it("extrai a chave final de um desenho técnico salvo no storage", () => {
    expect(extractProductDocumentKey(
      "/manus-storage/products/documents/desenhoTecnico/desenho_4b3c2d1e.pdf",
    )).toBe("products/documents/desenhoTecnico/desenho_4b3c2d1e.pdf");
  });

  it("fornece URL assinada de visualização sem alterar a referência durável", async () => {
    vi.mocked(storageGetSignedUrl).mockResolvedValueOnce("https://files.example/desenho.pdf?signature=valida");
    const documentos = JSON.stringify({
      desenhoTecnico: {
        key: "products/documents/desenhoTecnico/desenho.pdf",
        url: "/manus-storage/products/documents/desenhoTecnico/desenho_4b3c2d1e.pdf",
        nome: "desenho.pdf",
        mimeType: "application/pdf",
      },
    });

    const result = await resolveProductDocumentViewUrls({ documentos });

    expect(storageGetSignedUrl).toHaveBeenCalledWith(
      "products/documents/desenhoTecnico/desenho_4b3c2d1e.pdf",
    );
    expect(result.documentosVisualizacao?.desenhoTecnico).toMatchObject({
      key: "products/documents/desenhoTecnico/desenho.pdf",
      url: "https://files.example/desenho.pdf?signature=valida",
    });
  });
});
