import { describe, expect, it } from "vitest";
import { lookupModelo, specsModelo } from "../model-specs";

describe("specsModelo", () => {
  it.each(["DTS 31X5", "DTS31X5", "DTS-31X5", "dts 31x5"])("normalizes %s", (query) => {
    const specs = specsModelo(query);
    expect(specs?.matchedModel).toBe("DTS 31X5");
    expect(specs?.capacity).toMatchObject({ min: 5_000, max: 7_000, unit: "Btu/h" });
    expect(specs?.mounting).toBe("side");
    expect(specs?.dimensions).toMatchObject({ heightMm: 914, widthMm: 305, depthMm: 304 });
    expect(specs?.nemaRatings).toEqual(expect.arrayContaining(["12", "4X"]));
    expect(specs?.washdown).toBe(true);
    expect(specs?.citations.length).toBeGreaterThan(0);
  });

  it.each(["DTS 32X1", "DTS 31X1 SL"])("returns another documented DTS model: %s", (query) => {
    expect(specsModelo(query)?.matchedModel).toBe(query);
  });

  it("keeps DTT electrical variants and amperes separate", () => {
    const specs = specsModelo("DTT 6301");
    expect(specs?.mounting).toBe("top");
    expect(specs?.washdown).toBe(false);
    expect(specs?.articleNumbers).toHaveLength(4);
    expect(specs?.articleNumbers.map((item) => item.currentA)).toEqual([5.73, 3.75, 7, 3.6]);
    expect(JSON.stringify(specs)).not.toMatch(/currentKW|powerKW/i);
  });

  it("reports not-found and ambiguous lookups without guessing", () => {
    expect(lookupModelo("DTS 31")).toMatchObject({ status: "ambiguous" });
    expect(lookupModelo("NOT A MODEL")).toEqual({ status: "not_found", query: "NOT A MODEL" });
    expect(specsModelo("NOT A MODEL")).toBeNull();
  });
});
