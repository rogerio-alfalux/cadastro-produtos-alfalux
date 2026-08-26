import { describe, expect, it } from "vitest";
import { extractStorageKey, resolveStoredDocumentKey } from "./productRoutes";

describe("product document storage keys", () => {
  it("extracts the real hashed key from a local storage URL", () => {
    expect(
      extractStorageKey(
        "/manus-storage/products/documents/datasheet/file_ab12cd34.pdf",
      ),
    ).toBe("products/documents/datasheet/file_ab12cd34.pdf");
  });

  it("prefers the hashed URL key over a stale pre-upload key", () => {
    expect(
      resolveStoredDocumentKey({
        key: "products/documents/fotometria/file.ies",
        url: "/manus-storage/products/documents/fotometria/file_12ab34cd.ies",
      }),
    ).toBe("products/documents/fotometria/file_12ab34cd.ies");
  });

  it("extracts a document key from a legacy CloudFront URL", () => {
    expect(
      extractStorageKey(
        "https://cdn.example.com/account/project/products/documents/desenhoTecnico/file_99aa88bb.pdf?Expires=9999999999",
      ),
    ).toBe("products/documents/desenhoTecnico/file_99aa88bb.pdf");
  });

  it("falls back to the stored key when no usable URL exists", () => {
    expect(
      resolveStoredDocumentKey({
        key: "products/documents/datasheet/file_abcdef12.pdf",
        url: "",
      }),
    ).toBe("products/documents/datasheet/file_abcdef12.pdf");
  });
});
