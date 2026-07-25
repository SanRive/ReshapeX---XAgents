import { describe, expect, it } from "vitest";
import { explicarVeredicto, guiaDeCampo } from "../explain";

describe("explicarVeredicto", () => {
  it.each([
    ["Filterfan", "Filterfan"],
    ["PKS", "PKS"],
    ["Cooling Units", "DTS"],
    ["PWS", "PWS"],
    ["air air", "PKS"],
    ["air/water", "PWS"],
  ])("resolves family alias %s", (alias, label) => {
    const result = explicarVeredicto(alias);
    expect(result?.family).toContain(label);
    expect(result?.applicableRules.length).toBeGreaterThan(0);
    expect(result?.applicableRules.every((rule) => rule.citation.texto_citado.length > 0)).toBe(true);
  });

  it("uses an already-calculated verdict without rerunning the gate", () => {
    const result = explicarVeredicto("DTS", [{
      family: "dts_cooling_units",
      familyLabel: "DTS Cooling Units",
      status: "recommended",
      reason: "Razón calculada por el motor.",
      blockingFields: [],
      citations: [{ documento: "doc.pdf", pagina: 2, texto_citado: "texto" }],
      warnings: [],
    }]);
    expect(result?.summary).toContain("Razón calculada por el motor.");
    expect(result?.applicableRules[0]?.citation.documento).toBe("doc.pdf");
  });

  it("returns null for an unknown family", () => {
    expect(explicarVeredicto("chiller")).toBeNull();
  });
});

describe("guiaDeCampo", () => {
  it.each([
    ["disipación térmica", "total_dissipation_w"],
    ["voltaje", "supply_voltage"],
    ["NEMA", "location"],
    ["washdown", "location"],
    ["material", "housing_material"],
    ["temperatura ambiente", "ambient_temp_max_c"],
    ["montaje", "installation"],
  ])("resolves %s to %s", (alias, field) => {
    const result = guiaDeCampo(alias);
    expect(result?.field).toBe(field);
    expect(result?.citation.texto_citado).toBeTruthy();
  });

  it("returns null for a field outside FIELD_GUIDE", () => {
    expect(guiaDeCampo("precio")).toBeNull();
  });
});
