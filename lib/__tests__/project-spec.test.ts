import { describe, expect, it } from "vitest";

import {
  BLOCKING_FIELDS,
  BTU_PER_W,
  FieldSchema,
  GATE_FIELDS,
  MARGIN_FACTOR,
  NEMA_BY_LOCATION,
  ProjectSpecSchema,
  SHORTLIST_FIELDS,
  countSatisfied,
  emptyField,
  gateReady,
  isSatisfied,
  requiredWatts,
  shortlistReady,
  wattsToBtuh,
  type ProjectSpec,
} from "../project-spec";
import { emptySpec } from "../fixtures/conversation";

/**
 * El contrato (T0.2). Es la frontera entre las cuatro pistas, así que lo que se
 * comprueba aquí no es "el código corre" sino que las reglas que el resto del
 * equipo da por ciertas siguen siendo ciertas.
 */

describe("el sobre por campo", () => {
  it("acepta un declared con evidencia literal", () => {
    const parsed = FieldSchema.safeParse({
      status: "declared",
      value: 38,
      evidence: "hasta 38 °C de ambiente",
      basis: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("acepta un inferred con su cita de catálogo", () => {
    const parsed = FieldSchema.safeParse({
      status: "inferred",
      value: 35,
      evidence: null,
      basis: { documento: "cat", pagina: "p. 2", texto_citado: "…" },
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza un status que no sea uno de los tres", () => {
    const parsed = FieldSchema.safeParse({
      status: "guessed",
      value: 1,
      evidence: null,
      basis: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("rechaza una cita a medias", () => {
    const parsed = FieldSchema.safeParse({
      status: "inferred",
      value: 35,
      evidence: null,
      basis: { documento: "cat" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("umbrales · §3.6", () => {
  it("son tres para la compuerta y cinco para el shortlist", () => {
    expect(GATE_FIELDS).toHaveLength(3);
    expect(SHORTLIST_FIELDS).toHaveLength(5);
    expect(BLOCKING_FIELDS).toHaveLength(8);
  });

  it("la compuerta pide ambiente, ubicación y calidad del aire", () => {
    expect([...GATE_FIELDS].sort()).toEqual([
      "air_quality",
      "ambient_temp_max_c",
      "location",
    ]);
  });

  it("la temperatura interna NO está en el umbral: ya tiene default citado", () => {
    expect(GATE_FIELDS as readonly string[]).not.toContain("internal_temp_max_c");
  });

  it("un campo cuenta como resuelto si está declarado o inferido con valor", () => {
    expect(isSatisfied({ status: "declared", value: 38, evidence: "38", basis: null })).toBe(true);
    expect(isSatisfied({ status: "inferred", value: 35, evidence: null, basis: null })).toBe(true);
    expect(isSatisfied({ status: "missing", value: null, evidence: null, basis: null })).toBe(false);
    // Un declared sin valor no cuenta: el validador tendría que haberlo degradado.
    expect(isSatisfied({ status: "declared", value: null, evidence: "x", basis: null })).toBe(false);
    expect(isSatisfied(undefined)).toBe(false);
  });
});

describe("derivados · conversión de unidades, no ingeniería", () => {
  it("el margen del 10 % es el citado en DTS_2017", () => {
    expect(MARGIN_FACTOR).toBe(1.1);
    expect(requiredWatts(1350)).toBeCloseTo(1485, 6);
  });

  it("la conversión a Btu/h usa el factor estándar", () => {
    expect(BTU_PER_W).toBe(3.412);
    expect(wattsToBtuh(1485)).toBeCloseTo(5066.82, 2);
  });

  it("el caso de §5 da 5 067 Btu/h redondeando", () => {
    expect(Math.round(wattsToBtuh(requiredWatts(1350)))).toBe(5067);
  });

  it("el mapeo de rating copia el del tutorial de PSS", () => {
    expect(NEMA_BY_LOCATION.indoor).toBe("12");
    expect(NEMA_BY_LOCATION.outdoor).toBe("3R_4");
    expect(NEMA_BY_LOCATION.washdown).toBe("4_4X");
  });
});

describe("spec en blanco", () => {
  const spec: ProjectSpec = emptySpec();

  it("valida contra el schema", () => {
    expect(ProjectSpecSchema.safeParse(spec).success).toBe(true);
  });

  it("arranca con todo en missing y sin valores", () => {
    for (const key of BLOCKING_FIELDS) {
      expect(spec[key].status, key).toBe("missing");
      expect(spec[key].value, key).toBeNull();
    }
    expect(spec.component_list).toBeNull();
  });

  it("no abre ni la compuerta ni el shortlist", () => {
    expect(gateReady(spec)).toBe(false);
    expect(shortlistReady(spec)).toBe(false);
    expect(countSatisfied(spec, BLOCKING_FIELDS)).toBe(0);
  });

  it("emptyField admite la razón de la traba sin dar valor", () => {
    const f = emptyField("Shortlist");
    expect(f.status).toBe("missing");
    expect(f.value).toBeNull();
    expect(f.blocks).toBe("Shortlist");
  });
});
