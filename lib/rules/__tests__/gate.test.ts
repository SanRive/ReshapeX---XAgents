/**
 * B4 · Tests de la compuerta de tecnología (B2).
 *
 * Tabla de casos sobre la matriz §4.1 del spec: cada `(ambient vs internal, air_quality,
 * location)` da la familia esperada **y** la cita presente. Más los descartes citados y
 * el trato de los datos faltantes.
 *
 * Sin mocks: el motor es código puro, así que se ejecuta de verdad.
 */

import { describe, expect, it } from "vitest";

import { TECHNOLOGY_FAMILIES } from "../types";
import type { TechnologyFamily, TechnologyVerdict } from "../types";
import { evaluateTechnologyGate, gateThresholdMet } from "../gate";
import { CITATIONS, DEFAULT_INTERNAL_TEMP_MAX_C } from "../catalog-data";
import { barranquillaSinRespuesta, makeSpec } from "./fixtures";

function verdictFor(verdicts: TechnologyVerdict[], family: TechnologyFamily): TechnologyVerdict {
  const v = verdicts.find((x) => x.family === family);
  expect(v, `falta el veredicto de ${family}`).toBeDefined();
  return v!;
}

describe("evaluateTechnologyGate · forma del resultado", () => {
  it("devuelve exactamente un veredicto por familia, siempre las cuatro", () => {
    const verdicts = evaluateTechnologyGate(makeSpec({}));
    expect(verdicts).toHaveLength(TECHNOLOGY_FAMILIES.length);
    expect(verdicts.map((v) => v.family)).toEqual([...TECHNOLOGY_FAMILIES]);
  });

  it("todos los veredictos llevan cita y razón no vacía — incluidos los negativos", () => {
    const escenarios = [
      makeSpec({}),
      makeSpec({ ambient_temp_max_c: 25, location: "indoor", air_quality: "clean_or_slightly_dirty" }),
      makeSpec({ ambient_temp_max_c: 25, location: "indoor", air_quality: "dirty" }),
      makeSpec({ ambient_temp_max_c: 45, location: "indoor", air_quality: "clean_or_slightly_dirty" }),
      makeSpec({ ambient_temp_max_c: 45, location: "outdoor", air_quality: "very_harsh" }),
      barranquillaSinRespuesta(),
    ];

    for (const spec of escenarios) {
      for (const v of evaluateTechnologyGate(spec)) {
        expect(v.citations.length, `${v.family} sin cita`).toBeGreaterThan(0);
        expect(v.reason.trim().length, `${v.family} sin razón`).toBeGreaterThan(20);
        for (const c of v.citations) {
          expect(c.documento).toBeTruthy();
          expect(c.pagina).toBeGreaterThan(0);
          expect(c.texto_citado.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it("es determinista: la misma entrada produce exactamente el mismo texto", () => {
    const spec = barranquillaSinRespuesta();
    expect(JSON.stringify(evaluateTechnologyGate(spec))).toEqual(
      JSON.stringify(evaluateTechnologyGate(spec)),
    );
  });
});

describe("matriz §4.1 · las cuatro filas del catálogo", () => {
  it("1 · ambiente fresco y limpio → Filterfan recomendado", () => {
    const v = evaluateTechnologyGate(
      makeSpec({
        ambient_temp_max_c: 25,
        location: "indoor",
        air_quality: "clean_or_slightly_dirty",
      }),
    );
    expect(verdictFor(v, "filterfan_exhaust").status).toBe("recommended");
    expect(verdictFor(v, "filterfan_exhaust").citations).toContainEqual(
      CITATIONS.MATRIZ_TECNOLOGIA,
    );
    // Y las otras tres no se quedan sin explicación.
    expect(verdictFor(v, "pks_air_air").status).toBe("possible");
    expect(verdictFor(v, "dts_cooling_units").status).toBe("possible");
  });

  it("2 · ambiente fresco y sucio → PKS recomendado, Filterfan rechazado", () => {
    const v = evaluateTechnologyGate(
      makeSpec({ ambient_temp_max_c: 25, location: "indoor", air_quality: "dirty" }),
    );
    expect(verdictFor(v, "pks_air_air").status).toBe("recommended");

    const ff = verdictFor(v, "filterfan_exhaust");
    expect(ff.status).toBe("rejected");
    expect(ff.reason).toContain("sucio");
  });

  it("3 · ambiente alto y limpio → Cooling Units recomendado", () => {
    const v = evaluateTechnologyGate(
      makeSpec({
        ambient_temp_max_c: 45,
        location: "indoor",
        air_quality: "clean_or_slightly_dirty",
      }),
    );
    expect(verdictFor(v, "dts_cooling_units").status).toBe("recommended");
    expect(verdictFor(v, "dts_cooling_units").citations).toContainEqual(
      CITATIONS.COOLING_ACTIVO_REQUERIDO,
    );
  });

  it("4 · ambiente alto y hostil → PWS recomendado si hay agua; Cooling Units avisa", () => {
    const v = evaluateTechnologyGate(
      makeSpec({
        ambient_temp_max_c: 48,
        location: "indoor",
        air_quality: "very_harsh",
        process_water_available: true,
      }),
    );
    const pws = verdictFor(v, "pws_air_water");
    expect(pws.status).toBe("recommended");
    expect(pws.citations).toContainEqual(CITATIONS.PWS_SIN_DERATING);

    const cu = verdictFor(v, "dts_cooling_units");
    expect(cu.status).toBe("recommended");
    expect(cu.warnings.join(" ")).toContain("muy hostil");
  });
});

describe("reglas de descarte citadas", () => {
  it("5 · ambiente > temperatura interna → cooling activo; filterfan y PKS rechazados", () => {
    const v = evaluateTechnologyGate(
      makeSpec({
        ambient_temp_max_c: 38,
        internal_temp_max_c: 35,
        location: "indoor",
        air_quality: "clean_or_slightly_dirty",
      }),
    );

    const ff = verdictFor(v, "filterfan_exhaust");
    expect(ff.status).toBe("rejected");
    expect(ff.citations).toContainEqual(CITATIONS.COOLING_ACTIVO_REQUERIDO);
    expect(ff.citations).toContainEqual(CITATIONS.PSS_COMPUERTA_CONFIRMADA);

    const pks = verdictFor(v, "pks_air_air");
    expect(pks.status).toBe("rejected");
    expect(pks.reason).toContain("no puede llevar el interior por debajo");

    expect(verdictFor(v, "dts_cooling_units").status).toBe("recommended");
  });

  it("6 · Filterfan rechazado con NEMA 4X aunque el ambiente sea fresco", () => {
    const v = evaluateTechnologyGate(
      makeSpec({
        ambient_temp_max_c: 25,
        internal_temp_max_c: 35,
        location: "washdown",
        air_quality: "clean_or_slightly_dirty",
      }),
    );
    const ff = verdictFor(v, "filterfan_exhaust");
    expect(ff.status).toBe("rejected");
    expect(ff.reason).toContain("4/4X");
    expect(ff.citations).toContainEqual(CITATIONS.LAZO_CERRADO_CONSERVA_NEMA);
    expect(ff.citations).toContainEqual(CITATIONS.FILTERFAN_TYPE_12);
  });

  it("7 · PKS rechazado cuando hay que enfriar por debajo del ambiente", () => {
    const v = evaluateTechnologyGate(
      makeSpec({
        ambient_temp_max_c: 40,
        internal_temp_max_c: 30,
        location: "indoor",
        air_quality: "dirty",
      }),
    );
    const pks = verdictFor(v, "pks_air_air");
    expect(pks.status).toBe("rejected");
    expect(pks.citations).toContainEqual(CITATIONS.COOLING_ACTIVO_REQUERIDO);
    expect(pks.blockingFields).toEqual([]);
  });

  it("8 · PWS queda condicionado cuando no se sabe si hay agua, y rechazado si no la hay", () => {
    const sinDato = evaluateTechnologyGate(
      makeSpec({ ambient_temp_max_c: 45, location: "indoor", air_quality: "dirty" }),
    );
    const bloqueado = verdictFor(sinDato, "pws_air_water");
    expect(bloqueado.status).toBe("blocked");
    expect(bloqueado.blockingFields).toContain("process_water_available");
    expect(bloqueado.citations).toContainEqual(CITATIONS.PWS_REQUIERE_AGUA);

    const sinAgua = evaluateTechnologyGate(
      makeSpec({
        ambient_temp_max_c: 45,
        location: "indoor",
        air_quality: "dirty",
        process_water_available: false,
      }),
    );
    expect(verdictFor(sinAgua, "pws_air_water").status).toBe("rejected");
  });
});

describe("datos faltantes", () => {
  it("9 · sin ambiente, ninguna familia se rechaza: quedan bloqueadas con el campo que falta", () => {
    const v = evaluateTechnologyGate(
      makeSpec({ location: "indoor", air_quality: "clean_or_slightly_dirty" }),
    );

    expect(v.every((x) => x.status !== "rejected")).toBe(true);
    for (const familia of TECHNOLOGY_FAMILIES) {
      const x = verdictFor(v, familia);
      expect(x.status).toBe("blocked");
      expect(x.blockingFields).toContain("ambient_temp_max_c");
      // La razón nombra el campo que falta, en lenguaje que el cliente entiende.
      expect(x.reason).toContain("temperatura ambiente máxima");
    }
  });

  it("el spec vacío no rechaza nada y nombra todos los campos que faltan", () => {
    const v = evaluateTechnologyGate(makeSpec({}));
    expect(v.every((x) => x.status === "blocked")).toBe(true);
    const campos = new Set(v.flatMap((x) => x.blockingFields));
    expect(campos).toContain("ambient_temp_max_c");
    expect(campos).toContain("location");
    expect(campos).toContain("air_quality");
  });

  it("aplica el default citado de temperatura interna y lo avisa", () => {
    const v = evaluateTechnologyGate(
      makeSpec({
        ambient_temp_max_c: 38,
        location: "indoor",
        air_quality: "clean_or_slightly_dirty",
      }),
    );
    const ff = verdictFor(v, "filterfan_exhaust");
    expect(ff.reason).toContain(String(DEFAULT_INTERNAL_TEMP_MAX_C));
    expect(ff.citations).toContainEqual(CITATIONS.TEMPERATURA_INTERNA_OBJETIVO);
    expect(ff.warnings.join(" ")).toContain("default documentado");
  });

  it("gateThresholdMet exige los tres datos del umbral 1 (§3.6)", () => {
    expect(gateThresholdMet(makeSpec({ ambient_temp_max_c: 38, location: "indoor" }))).toBe(false);
    expect(
      gateThresholdMet(
        makeSpec({ ambient_temp_max_c: 38, location: "indoor", air_quality: "dirty" }),
      ),
    ).toBe(true);
  });
});

describe("caso §5 · Barranquilla — los cuatro veredictos del spec", () => {
  const verdicts = evaluateTechnologyGate(barranquillaSinRespuesta());

  it("Filterfan ❌ por temperatura, con la cita de la regla de cooling activo", () => {
    const ff = verdictFor(verdicts, "filterfan_exhaust");
    expect(ff.status).toBe("rejected");
    expect(ff.reason).toContain("38 °C");
    expect(ff.reason).toContain("35 °C");
    expect(ff.citations).toContainEqual(CITATIONS.COOLING_ACTIVO_REQUERIDO);
  });

  it("PKS Air/Air ❌ porque no puede bajar del ambiente", () => {
    expect(verdictFor(verdicts, "pks_air_air").status).toBe("rejected");
  });

  it("PWS Air/Water ⚠ como alternativa: falta saber si hay agua de proceso", () => {
    const pws = verdictFor(verdicts, "pws_air_water");
    expect(pws.status).toBe("blocked");
    expect(pws.blockingFields).toEqual(["process_water_available"]);
    expect(pws.reason).toContain("alternativa");
  });

  it("Cooling Units ✅ por cooling activo + lazo cerrado exigido por el Type 4/4X", () => {
    const cu = verdictFor(verdicts, "dts_cooling_units");
    expect(cu.status).toBe("recommended");
    expect(cu.reason).toContain("4/4X");
    expect(cu.citations).toContainEqual(CITATIONS.COOLING_ACTIVO_REQUERIDO);
    expect(cu.citations).toContainEqual(CITATIONS.LAZO_CERRADO_CONSERVA_NEMA);
  });

  it("avisa de que el punto de operación es más severo que la base DIN 35/35", () => {
    const cu = verdictFor(verdicts, "dts_cooling_units");
    expect(cu.warnings.join(" ")).toContain("DIN 35/35");
    expect(cu.citations).toContainEqual(CITATIONS.BASE_DIN_35_35);
  });
});
