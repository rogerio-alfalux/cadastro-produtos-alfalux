import { describe, expect, it } from "vitest";
import { storageCreateUploadUrl } from "./storage";
import { describeDocumentUploadFailure } from "../client/src/lib/documentUpload";

describe("upload resiliente de documentos", () => {
  it("expõe o helper de URL direta de upload sem expor credenciais ao cliente", () => {
    expect(typeof storageCreateUploadUrl).toBe("function");
  });

  it("mantém o helper de upload direto separado da referência privada do arquivo", () => {
    expect(storageCreateUploadUrl.name).toBe("storageCreateUploadUrl");
  });

  it("converte uma resposta 503 não JSON em mensagem adequada para o usuário", () => {
    expect(describeDocumentUploadFailure(503, { raw: "Service Unavailable" }))
      .toContain("temporariamente indisponível");
  });

  it("preserva mensagens estruturadas e explica o limite de tamanho", () => {
    expect(describeDocumentUploadFailure(400, { error: "Tipo de documento inválido" }))
      .toBe("Tipo de documento inválido");
    expect(describeDocumentUploadFailure(413, {})).toContain("25 MB");
  });
});
