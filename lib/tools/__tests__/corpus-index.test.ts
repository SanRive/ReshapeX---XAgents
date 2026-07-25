import { describe, expect, it } from "vitest";
import { buildCorpusIndex, getIndexedDocuments } from "../corpus-index";

describe("corpus index", () => {
  it("indexes only the explicit thermal-management corpus", () => {
    const documents = getIndexedDocuments();
    expect(documents.length).toBeGreaterThan(20);
    expect(documents.some((document) => /Thermal_Management_Catalog/i.test(document))).toBe(true);
    expect(documents.some((document) => /Compact_catalogue/i.test(document))).toBe(true);
    expect(documents.some((document) => /PSS-Tutorial/i.test(document))).toBe(true);
    expect(documents.some((document) => /chiller/i.test(document))).toBe(false);
    expect(documents.some((document) => /signal|siren|beacon/i.test(document))).toBe(false);
  });

  it("builds complete, unique and deterministic chunks", () => {
    const first = buildCorpusIndex();
    const second = buildCorpusIndex();
    expect(first.length).toBeGreaterThan(0);
    expect(first.map((chunk) => chunk.id)).toEqual(second.map((chunk) => chunk.id));
    expect(new Set(first.map((chunk) => chunk.id)).size).toBe(first.length);
    for (const chunk of first) {
      expect(chunk.documento).toBeTruthy();
      expect(chunk.pagina).toBeGreaterThan(0);
      expect(chunk.texto).toBeTruthy();
      expect(chunk.tokens.length).toBeGreaterThan(0);
    }
  });
});
