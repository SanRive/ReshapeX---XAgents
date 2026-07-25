/**
 * B4 · Tests de `FIELD_GUIDE` (B5).
 *
 * La guía es una tabla estática, así que lo que hay que proteger es su forma: ocho
 * campos, todos con cita, y el antipatrón que sostiene la demo.
 */

import { describe, expect, it } from "vitest";

import { FIELD_GUIDE, blockingFieldNames, fieldGuideFor } from "../field-guide";

describe("FIELD_GUIDE", () => {
  it("tiene exactamente los ocho campos bloqueantes de §3.6", () => {
    expect(FIELD_GUIDE).toHaveLength(8);
    expect(blockingFieldNames()).toEqual([
      "ambient_temp_max_c",
      "location",
      "air_quality",
      "total_dissipation_w",
      "supply_voltage",
      "enclosure_dimensions_mm",
      "installation",
      "housing_material",
    ]);
  });

  it("cada fila trae las cinco columnas con contenido y una cita válida", () => {
    for (const e of FIELD_GUIDE) {
      expect(e.whyItMatters.length, `${e.field}: whyItMatters`).toBeGreaterThan(40);
      expect(e.whereToFindIt.length, `${e.field}: whereToFindIt`).toBeGreaterThan(40);
      expect(e.alternativeEvidence.length, `${e.field}: alternativeEvidence`).toBeGreaterThan(20);
      expect(e.antiPattern.length, `${e.field}: antiPattern`).toBeGreaterThan(20);
      expect(e.citation.documento, `${e.field}: documento`).toBeTruthy();
      expect(e.citation.pagina, `${e.field}: pagina`).toBeGreaterThan(0);
      expect(e.citation.texto_citado.length, `${e.field}: texto_citado`).toBeGreaterThan(10);
    }
  });

  it("el antipatrón de la disipación prohíbe explícitamente derivarla de los kW nominales", () => {
    const e = fieldGuideFor("total_dissipation_w");
    expect(e).toBeDefined();
    expect(e!.antiPattern).toContain("22 kW");
    expect(e!.antiPattern).toContain("22 000 W");
    expect(e!.alternativeEvidence).toContain("suma, no una estimación");
  });

  it("devuelve undefined para un campo que no es bloqueante", () => {
    expect(fieldGuideFor("housing_color")).toBeUndefined();
  });

  it("no hay campos duplicados", () => {
    expect(new Set(blockingFieldNames()).size).toBe(FIELD_GUIDE.length);
  });
});
