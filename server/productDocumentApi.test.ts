import { describe, expect, it } from "vitest";
import { buildPublicProductDocuments, productDocumentTypes } from "./productRoutes";

describe("contrato público de documentos de produto", () => {
  it("inclui o Manual de Instalação entre os tipos suportados", () => {
    expect(productDocumentTypes).toContain("manualInstalacao");
  });

  it("expõe o manual no objeto documentos e no alias manualInstalacaoUrl", () => {
    const key = "products/documents/manualInstalacao/manual_hash.pdf";
    const signedUrl = "https://files.example/manual.pdf?signature=valida";
    const payload = buildPublicProductDocuments(JSON.stringify({
      manualInstalacao: {
        url: `/manus-storage/${key}`,
        key,
        nome: "manual-de-instalacao.pdf",
        mimeType: "application/pdf",
      },
    }), new Map([[key, signedUrl]]));

    expect(payload.documentos.manualInstalacao).toEqual({
      nome: "manual-de-instalacao.pdf",
      mimeType: "application/pdf",
      url: signedUrl,
    });
    expect(payload.manualInstalacaoUrl).toBe(signedUrl);
    expect(payload.datasheetUrl).toBeNull();
    expect(payload.fotometriaIesUrl).toBeNull();
    expect(payload.desenhoTecnicoUrl).toBeNull();
  });
});
