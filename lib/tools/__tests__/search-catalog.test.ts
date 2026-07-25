import { describe, expect, it } from "vitest";
import { buscarCatalogo } from "../search-catalog";

describe("buscarCatalogo", () => {
  it.each([
    "ambient temperature greater than internal temperature",
    "NEMA 4X closed loop",
    "washdown",
    "10 percent refrigeration capacity",
    "DIN 35/35",
    "DTT Type 12",
    "air water heat exchanger",
  ])("finds cited results for %s", (query) => {
    const results = buscarCatalogo(query);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.score).toBeGreaterThan(0);
    expect(results[0]?.pagina).toBeGreaterThan(0);
    expect(results[0]?.citation.texto_citado).toBe(results[0]?.fragmento);
  });

  it("normalizes case, accents and punctuation variants", () => {
    expect(buscarCatalogo("WASH-DOWN")[0]?.documento).toBe(buscarCatalogo("washdown")[0]?.documento);
    expect(buscarCatalogo("AIR/WATER")[0]?.documento).toBe(buscarCatalogo("air-water")[0]?.documento);
    expect(buscarCatalogo("TENSIÓN")[0]?.score).toBeGreaterThan(0);
  });

  it("abstains for empty and unrelated queries", () => {
    expect(buscarCatalogo("")).toEqual([]);
    expect(buscarCatalogo("zyxwvutsrqponmlkjihg")).toEqual([]);
  });
});
