import { describe, expect, it } from "vitest";
import { extractProductPhotoKey } from "./routers";

describe("resolução de chaves de fotos de produtos", () => {
  it("resolve a chave real de uma URL interna de storage", () => {
    expect(extractProductPhotoKey("/manus-storage/products/photos/luna_abc123.png"))
      .toBe("products/photos/luna_abc123.png");
  });

  it("resolve a chave de uma URL CloudFront assinada sem usar a assinatura como chave", () => {
    expect(extractProductPhotoKey(
      "https://cdn.example.com/tenant/projeto/products/photos/luna_abc123.png?Expires=123&Signature=abc",
    )).toBe("products/photos/luna_abc123.png");
  });

  it("preserva caminhos relativos de storage e ignora valores inválidos", () => {
    expect(extractProductPhotoKey("products/photos/luna_abc123.png"))
      .toBe("products/photos/luna_abc123.png");
    expect(extractProductPhotoKey(null)).toBeNull();
    expect(extractProductPhotoKey("https://cdn.example.com/tenant/projeto/arquivo.png")).toBeNull();
  });
});
