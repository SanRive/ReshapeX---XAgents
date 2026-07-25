import { describe, expect, it } from "vitest";

import {
  STATUS_CHIP,
  STATUS_GLYPH,
  STATUS_WORD,
  VERDICT_CHIP,
  VERDICT_GLYPH,
  VERDICT_WORD,
  enumLabel,
  formatFieldValue,
  num,
} from "../format";
import { evidenceStrings, segmentByEvidence } from "../highlight";
import { EMAIL_INTAKE, SPEC_TURNO_1, SPEC_TURNO_2 } from "../fixtures/barranquilla";
import { emptySpec } from "../fixtures/conversation";
import type { Field } from "../project-spec";

/**
 * La capa de presentación (pista D). No decide nada, pero sí es donde un número
 * bien calculado se puede pintar mal.
 */

const f = (over: Partial<Field>): Field => ({
  status: "declared",
  value: null,
  evidence: null,
  basis: null,
  ...over,
});

/** El separador de millar es un ESPACIO FINO (U+2009), no uno normal. Es una
 *  decisión de tipografía —así se compone una hoja de datos— y es invisible al
 *  leer el código, así que aquí se escribe con escape para que no se pierda en
 *  un copiar y pegar. */
const THIN = " ";

describe("formato de cifras", () => {
  it("usa espacio fino de millar, como una hoja de datos", () => {
    expect(num(5067)).toBe(`5${THIN}067`);
    expect(num(1350)).toBe(`1${THIN}350`);
    expect(num(999)).toBe("999");
  });

  it("el separador es fino de verdad, no un espacio normal", () => {
    expect(num(5067)).not.toBe("5 067");
    expect(num(5067).charCodeAt(1)).toBe(0x2009);
  });

  it("no mete comas ni puntos de miles al estilo de otra locale", () => {
    expect(num(20000)).not.toContain(",");
    expect(num(20000)).not.toContain(".");
    expect(num(20000)).toBe(`20${THIN}000`);
  });

  it("respeta los decimales que se le piden", () => {
    expect(num(1.32, 1)).toBe("1.3");
  });
});

describe("valor de campo", () => {
  it("pega la unidad correcta a cada numérico", () => {
    expect(formatFieldValue("ambient_temp_max_c", f({ value: 38 }))).toBe("38 °C");
    expect(formatFieldValue("height_mm", f({ value: 2000 }))).toBe(`2${THIN}000 mm`);
    expect(formatFieldValue("total_dissipation_w", f({ value: 1350 }))).toBe(
      `1${THIN}350 W`,
    );
  });

  it("no inventa unidad donde no la hay", () => {
    expect(formatFieldValue("enclosure_count", f({ value: 4 }))).toBe("4");
  });

  it("traduce el vocabulario del catálogo a lo que lee el cliente", () => {
    expect(formatFieldValue("location", f({ value: "washdown" }))).toBe("Zona de lavado");
    expect(formatFieldValue("air_quality", f({ value: "very_harsh" }))).toBe(
      "Muy hostil, sucio",
    );
    expect(formatFieldValue("supply_voltage", f({ value: "400_460V_3ph" }))).toBe(
      "400-460 V 3~",
    );
    expect(formatFieldValue("housing_material", f({ value: "stainless_steel" }))).toBe(
      "Acero inoxidable",
    );
  });

  it("un campo sin valor se pinta como raya, nunca como cero", () => {
    expect(formatFieldValue("total_dissipation_w", f({ status: "missing" }))).toBe("—");
    expect(formatFieldValue("ambient_temp_max_c", f({ status: "missing" }))).not.toBe(
      "0 °C",
    );
  });

  it("los booleanos van en palabras", () => {
    expect(formatFieldValue("solar_load", f({ value: false }))).toBe("No");
    expect(formatFieldValue("solar_load", f({ value: true }))).toBe("Sí");
  });

  it("un enum desconocido se muestra tal cual en vez de romper", () => {
    expect(enumLabel("algo_nuevo")).toBe("algo_nuevo");
  });
});

describe("vocabulario de estado", () => {
  it("cada estado tiene glifo, palabra y chip: nunca solo color", () => {
    for (const s of ["declared", "inferred", "missing"] as const) {
      expect(STATUS_GLYPH[s]).toBeTruthy();
      expect(STATUS_WORD[s]).toBeTruthy();
      expect(STATUS_CHIP[s]).toBeTruthy();
    }
  });

  it("los tres veredictos comparten escala con los tres estados", () => {
    expect(VERDICT_CHIP.viable).toBe(STATUS_CHIP.declared);
    expect(VERDICT_CHIP.conditional).toBe(STATUS_CHIP.inferred);
    expect(VERDICT_CHIP.rejected).toBe(STATUS_CHIP.missing);
    expect(VERDICT_GLYPH.viable).toBe(STATUS_GLYPH.declared);
    expect(VERDICT_WORD.conditional).toBe("verificar");
  });
});

describe("resaltado de evidencia", () => {
  it("recoge las evidencias declaradas, sin repetir", () => {
    const evs = evidenceStrings(SPEC_TURNO_1);
    expect(evs).toContain("hemos medido hasta 38 °C de ambiente");
    // Tres campos comparten la misma frase de dimensiones: se cuenta una vez.
    expect(evs.filter((e) => e === "2000 x 800 x 600 mm")).toHaveLength(1);
  });

  it("las ordena de mayor a menor: la más larga gana al solaparse", () => {
    const evs = evidenceStrings(SPEC_TURNO_1);
    for (let i = 1; i < evs.length; i++) {
      expect(evs[i - 1].length).toBeGreaterThanOrEqual(evs[i].length);
    }
  });

  it("ignora los inferidos: no tienen evidencia que resaltar", () => {
    const evs = evidenceStrings(SPEC_TURNO_1);
    expect(evs).not.toContain(SPEC_TURNO_1.internal_temp_max_c.basis?.texto_citado);
  });

  it("un spec vacío no resalta nada", () => {
    expect(evidenceStrings(emptySpec())).toEqual([]);
  });

  it("los segmentos reconstruyen el texto original sin perder un carácter", () => {
    const segs = segmentByEvidence(EMAIL_INTAKE, evidenceStrings(SPEC_TURNO_1));
    expect(segs.map((s) => s.text).join("")).toBe(EMAIL_INTAKE);
  });

  it("marca de verdad el correo de Barranquilla", () => {
    const segs = segmentByEvidence(EMAIL_INTAKE, evidenceStrings(SPEC_TURNO_1));
    const marked = segs.filter((s) => s.marked);
    expect(marked.length).toBeGreaterThan(3);
    expect(marked.map((s) => s.text)).toContain("2000 x 800 x 600 mm");
  });

  it("no solapa dos marcas", () => {
    const segs = segmentByEvidence("aaa bbb ccc", ["aaa bbb", "bbb ccc"]);
    expect(segs.map((s) => s.text).join("")).toBe("aaa bbb ccc");
    expect(segs.filter((s) => s.marked).map((s) => s.text)).toEqual(["aaa bbb"]);
  });

  it("una evidencia que no aparece no marca nada", () => {
    const segs = segmentByEvidence("texto llano", ["inventado"]);
    expect(segs).toEqual([{ text: "texto llano", marked: false }]);
  });

  it("marca las tres frases nuevas de la respuesta del cliente", () => {
    const evs = evidenceStrings(SPEC_TURNO_2);
    expect(evs).toContain("La alimentación en planta es 460 V trifásico");
    expect(evs).toContain("los gabinetes son en acero inoxidable");
  });
});
