/**
 * B4 · Tests del shortlist de Cooling Units (B3).
 *
 * El caso de §5 del spec es **regresión gratis**: ya está resuelto a mano en el
 * documento de diseño, con los cinco modelos y su veredicto.
 *
 * El test que más importa no es ninguno de los positivos: es
 * "nunca convierte los 22 kW nominales del variador en disipación térmica".
 */

import { describe, expect, it } from "vitest";

import {
  applyCapacityMargin,
  buildCoolingUnitShortlist,
  evaluateCoolingUnitShortlist,
  resolveTotalDissipationW,
  wattsToBtuPerHour,
} from "../shortlist";
import { CAPACITY_MARGIN_FACTOR, CITATIONS, WATTS_TO_BTU_PER_HOUR } from "../catalog-data";
import type { CoolingUnitCandidate } from "../types";
import { emptyProjectSpec } from "../../project-spec";
import { barranquillaConRespuesta, barranquillaSinRespuesta, makeSpec } from "./fixtures";

function bySeries(candidates: CoolingUnitCandidate[], series: string): CoolingUnitCandidate {
  const c = candidates.find((x) => x.series === series);
  expect(c, `falta el candidato de la serie ${series}`).toBeDefined();
  return c!;
}

/* ================================================================== *
 * 1 · Aritmética
 * ================================================================== */

describe("conversión y margen", () => {
  it("1 · convierte W a Btu/h con la constante declarada 3.412142", () => {
    expect(WATTS_TO_BTU_PER_HOUR).toBe(3.412142);
    expect(wattsToBtuPerHour(1)).toBeCloseTo(3.412142, 6);
    expect(wattsToBtuPerHour(1000)).toBeCloseTo(3412.142, 3);
    expect(wattsToBtuPerHour(0)).toBe(0);
  });

  it("2 · aplica el margen documentado del 10 %", () => {
    expect(CAPACITY_MARGIN_FACTOR).toBe(1.1);
    expect(applyCapacityMargin(1350)).toBeCloseTo(1485, 6);
    expect(applyCapacityMargin(1000)).toBeCloseTo(1100, 6);
  });

  it("la cadena completa del caso §5 da 1485 W ≈ 5067 Btu/h", () => {
    const requiredW = applyCapacityMargin(1350);
    const requiredBtuH = wattsToBtuPerHour(requiredW);
    expect(requiredW).toBeCloseTo(1485, 6);
    expect(Math.round(requiredBtuH)).toBe(5067);
  });
});

/* ================================================================== *
 * 2 · Resolución de la disipación — el guardrail central
 * ================================================================== */

describe("resolución de PD", () => {
  it("3 · sin disipación declarada, la selección se detiene y el campo sale bloqueante", () => {
    const result = evaluateCoolingUnitShortlist(barranquillaSinRespuesta());
    expect(result.blockingFields).toContain("total_dissipation_w");
    expect(result.candidates).toEqual([]);
    expect(result.requiredCapacityW).toBeUndefined();
    expect(result.requiredCapacityBtuH).toBeUndefined();
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.notAsserted.join(" ")).toContain("No se estima");
  });

  it("la firma del plan devuelve [] cuando falta PD, sin inventar candidatos", () => {
    expect(buildCoolingUnitShortlist(barranquillaSinRespuesta())).toEqual([]);
  });

  it("suma la lista de componentes — es suma, no estimación", () => {
    const spec = emptyProjectSpec();
    spec.component_list = [
      { name: "Variador", w: 650, qty: 2 },
      { name: "PLC", w: 50, qty: 1 },
    ];
    const { totalDissipationW, source } = resolveTotalDissipationW(spec);
    expect(totalDissipationW).toBe(1350);
    expect(source).toBe("component_sum");
  });

  it("12 · NUNCA convierte los 22 kW nominales del variador en disipación térmica", () => {
    // El correo del cliente dice "2 variadores de 22 kW". El extractor no lo pone en
    // ningún campo de disipación, así que el motor no tiene de dónde sacarlo.
    const spec = barranquillaSinRespuesta();
    const { totalDissipationW } = resolveTotalDissipationW(spec);
    expect(totalDissipationW).toBeUndefined();

    const result = evaluateCoolingUnitShortlist(spec);
    expect(result.blockingFields).toContain("total_dissipation_w");

    // Ningún número derivado de 22 kW puede aparecer en la salida.
    const serializado = JSON.stringify(result);
    for (const prohibido of ["22000", "44000", "22 000", "44 000", "660", "1320"]) {
      expect(serializado).not.toContain(prohibido);
    }
  });
});

/* ================================================================== *
 * 3 · Filtros
 * ================================================================== */

describe("filtros del shortlist", () => {
  const base = {
    location: "indoor",
    air_quality: "clean_or_slightly_dirty",
    installation: "free_standing",
    height_mm: 2000,
    width_mm: 800,
    depth_mm: 600,
  } as const;

  it("4 · capacidad insuficiente: se rechaza y se dice por qué", () => {
    const candidates = buildCoolingUnitShortlist(
      makeSpec({ ...base, total_dissipation_w: 1350, supply_voltage: "400_460V_3ph" }),
    );
    const insuficiente = bySeries(candidates, "DTS 31X1"); // 3000 – 4000 Btu/h
    expect(insuficiente.status).toBe("rejected");
    expect(insuficiente.rejectionReasons.join(" ")).toContain("Capacidad máxima");
    expect(insuficiente.citations).toContainEqual(CITATIONS.MARGEN_10_PCT);
  });

  it("5 · voltaje incompatible: se rechaza la serie que no lo publica", () => {
    // DTT 6601 solo existe en 400/460 V.
    const candidates = buildCoolingUnitShortlist(
      makeSpec({ ...base, total_dissipation_w: 2500, supply_voltage: "115V" }),
    );
    const dtt6601 = bySeries(candidates, "DTT 6601");
    expect(dtt6601.status).toBe("rejected");
    expect(dtt6601.rejectionReasons.join(" ")).toContain("no disponible en 115 V");
    expect(dtt6601.citations).toContainEqual(CITATIONS.PSS_VOLTAJE_BLOQUEANTE);
  });

  it("6 · montaje incompatible: encajonado en fila descarta el montaje lateral", () => {
    const candidates = buildCoolingUnitShortlist(
      makeSpec({
        ...base,
        installation: "recessed_in_line",
        total_dissipation_w: 1350,
        supply_voltage: "400_460V_3ph",
      }),
    );
    const lateral = bySeries(candidates, "DTS 31X5");
    expect(lateral.status).toBe("rejected");
    expect(lateral.rejectionReasons.join(" ")).toContain("montaje lateral");
    expect(lateral.citations).toContainEqual(CITATIONS.PSS_INSTALACION);

    // Y el montaje superior sí sobrevive en el mismo escenario.
    expect(bySeries(candidates, "DTT 6401").status).not.toBe("rejected");
  });

  it("7 · NEMA incompatible: outdoor descarta las series que solo publican Type 12", () => {
    const candidates = buildCoolingUnitShortlist(
      makeSpec({
        ...base,
        location: "outdoor",
        total_dissipation_w: 1350,
        supply_voltage: "400_460V_3ph",
      }),
    );
    const dtt = bySeries(candidates, "DTT 6301");
    expect(dtt.status).toBe("rejected");
    expect(dtt.rejectionReasons.join(" ")).toContain("NEMA Type 12");
    expect(dtt.citations).toContainEqual(CITATIONS.PSS_LOCATION_A_NEMA);

    // El DTS sí tiene variante outdoor documentada.
    const dts = bySeries(candidates, "DTS 31X5");
    expect(dts.status).not.toBe("rejected");
    expect(dts.model).toContain("Outdoor");
  });

  it("8 · washdown incompatible: se exige variante 4/4X documentada", () => {
    const candidates = buildCoolingUnitShortlist(
      makeSpec({
        ...base,
        location: "washdown",
        housing_material: "stainless_steel",
        total_dissipation_w: 1350,
        supply_voltage: "400_460V_3ph",
      }),
    );
    const dts = bySeries(candidates, "DTS 31X5");
    expect(dts.model).toBe("DTS 31X5 Washdown");
    expect(dts.designacionComercial).toBe("DTS 3185");
    expect(dts.status).toBe("verify");
  });

  it("9 · DTT se descarta para washdown por rating, no por capacidad", () => {
    const candidates = buildCoolingUnitShortlist(
      makeSpec({
        ...base,
        location: "washdown",
        housing_material: "stainless_steel",
        total_dissipation_w: 1350,
        supply_voltage: "400_460V_3ph",
      }),
    );
    // DTT 6301 cubre 4000 – 5500 Btu/h, así que 5067 le entra de sobra.
    const dtt = bySeries(candidates, "DTT 6301");
    expect(dtt.capacidadMinBtuH).toBe(4000);
    expect(dtt.capacidadMaxBtuH).toBe(5500);
    expect(dtt.status).toBe("rejected");
    expect(dtt.reason).toContain("La capacidad alcanzaría");
    expect(dtt.rejectionReasons.join(" ")).toContain("no hay variante washdown documentada");
    expect(dtt.citations).toContainEqual(CITATIONS.DTT_SOLO_TYPE_12);
  });

  it("el DTI se descarta cuando hace falta un rating y el catálogo no lo publica", () => {
    const candidates = buildCoolingUnitShortlist(
      makeSpec({
        ...base,
        location: "washdown",
        housing_material: "stainless_steel",
        total_dissipation_w: 1350,
        supply_voltage: "400_460V_3ph",
      }),
    );
    const dti = bySeries(candidates, "DTI 6301 C");
    expect(dti.status).toBe("rejected");
    expect(dti.rejectionReasons.join(" ")).toContain("no publica rating NEMA");
  });

  it("faltan voltaje y dimensiones: son bloqueantes, pero no rechazan nada", () => {
    const spec = makeSpec({
      location: "indoor",
      air_quality: "clean_or_slightly_dirty",
      installation: "free_standing",
      total_dissipation_w: 1350,
    });
    const result = evaluateCoolingUnitShortlist(spec);
    expect(result.blockingFields).toContain("supply_voltage");
    expect(result.blockingFields).toContain("enclosure_dimensions_mm");
    expect(result.candidates.some((c) => c.status !== "rejected")).toBe(true);

    const elegido = result.candidates.find((c) => c.status === "verify" || c.status === "recommended");
    expect(elegido!.verificationWarnings.join(" ")).toContain("voltaje de alimentación");
  });
});

/* ================================================================== *
 * 4 · Regresión obligatoria — el caso §5 de Barranquilla
 * ================================================================== */

describe("10 · caso completo de Barranquilla (§5 del spec)", () => {
  const result = evaluateCoolingUnitShortlist(barranquillaConRespuesta());
  const c = result.candidates;

  it("PD 1350 W → 1485 W → ≈ 5067 Btu/h", () => {
    expect(result.totalDissipationW).toBe(1350);
    expect(result.totalDissipationSource).toBe("declared");
    expect(result.requiredCapacityW).toBeCloseTo(1485, 6);
    expect(Math.round(result.requiredCapacityBtuH!)).toBe(5067);
    expect(result.blockingFields).toEqual([]);
  });

  it("DTS 31X5 Washdown → verificar, por caer dentro del rango y depender del voltaje", () => {
    const dts = bySeries(c, "DTS 31X5");
    expect(dts.status).toBe("verify");
    expect(dts.model).toBe("DTS 31X5 Washdown");
    expect(dts.designacionComercial).toBe("DTS 3185");
    expect(dts.verificationWarnings.join(" ")).toContain("400/460 V 3~");
    expect(dts.verificationWarnings.join(" ")).toContain("varía por voltaje y configuración");
    expect(dts.citations).toContainEqual(CITATIONS.CAPACIDAD_VARIA_POR_VOLTAJE);
    expect(dts.citations).toContainEqual(CITATIONS.DTS_3185_INOXIDABLE);
  });

  it("DTS 32X1 → alternativa con margen, con la advertencia de sobredimensionamiento", () => {
    const alt = bySeries(c, "DTS 32X1");
    expect(alt.status).toBe("alternative");
    expect(alt.model).toBe("DTS 32X1 Washdown");
    expect(Math.round(alt.margenSobreRequeridoPct!)).toBe(38);
    expect(alt.verificationWarnings.join(" ")).toContain("sobredimensionamiento");
    expect(alt.citations).toContainEqual(CITATIONS.EVITAR_SOBREDIMENSIONAR);
  });

  it("DTS 31X1 SL → rechazado por capacidad insuficiente", () => {
    const r = bySeries(c, "DTS 31X1 SL");
    expect(r.status).toBe("rejected");
    expect(r.capacidadMaxBtuH).toBe(5000);
    expect(r.rejectionReasons.join(" ")).toContain("Capacidad máxima");
  });

  it("DTS 31X1 → rechazado por capacidad insuficiente", () => {
    const r = bySeries(c, "DTS 31X1");
    expect(r.status).toBe("rejected");
    expect(r.capacidadMaxBtuH).toBe(4000);
  });

  it("DTT 6301 → rechazado por rating, aunque su rango bastara", () => {
    const r = bySeries(c, "DTT 6301");
    expect(r.status).toBe("rejected");
    expect(r.rejectionReasons.join(" ")).toContain("washdown");
  });

  it("los rechazados no se ocultan: van en el mismo array con su razón", () => {
    const rechazados = c.filter((x) => x.status === "rejected");
    expect(rechazados.length).toBeGreaterThanOrEqual(4);
    for (const r of rechazados) {
      expect(r.rejectionReasons.length).toBeGreaterThan(0);
      expect(r.citations.length).toBeGreaterThan(0);
    }
  });

  it("la verificación mecánica pasa: 914 mm de unidad contra 2000 mm de gabinete", () => {
    const dts = bySeries(c, "DTS 31X5");
    expect(dts.status).not.toBe("rejected");
    expect(dts.rejectionReasons).toEqual([]);
  });
});

/* ================================================================== *
 * 5 · Invariantes de salida
 * ================================================================== */

describe("11 · citas y razones en todos los candidatos", () => {
  const escenarios = [
    barranquillaConRespuesta(),
    makeSpec({
      location: "indoor",
      air_quality: "clean_or_slightly_dirty",
      installation: "free_standing",
      total_dissipation_w: 5000,
      supply_voltage: "230V",
      height_mm: 2000,
      width_mm: 800,
      depth_mm: 600,
    }),
    makeSpec({
      location: "outdoor",
      air_quality: "dirty",
      installation: "free_standing",
      total_dissipation_w: 300,
      supply_voltage: "115V",
      height_mm: 1200,
      width_mm: 600,
      depth_mm: 400,
    }),
  ];

  it("todo candidato lleva cita, razón, y el requerido con el que se le juzgó", () => {
    for (const spec of escenarios) {
      const candidates = buildCoolingUnitShortlist(spec);
      expect(candidates.length).toBeGreaterThan(0);
      for (const cand of candidates) {
        expect(cand.citations.length, `${cand.model} sin cita`).toBeGreaterThan(0);
        expect(cand.reason.trim().length, `${cand.model} sin razón`).toBeGreaterThan(20);
        expect(cand.requiredCapacityBtuH).toBeGreaterThan(0);
        if (cand.status === "rejected") {
          expect(cand.rejectionReasons.length, `${cand.model} rechazado sin motivo`).toBeGreaterThan(0);
        } else {
          expect(cand.rejectionReasons).toEqual([]);
        }
      }
    }
  });

  it("hay como mucho un recomendado o un a-verificar, y es la serie más ajustada", () => {
    for (const spec of escenarios) {
      const candidates = buildCoolingUnitShortlist(spec);
      const primeros = candidates.filter((x) => x.status === "recommended" || x.status === "verify");
      expect(primeros.length).toBeLessThanOrEqual(1);

      if (primeros.length === 1) {
        const otros = candidates.filter((x) => x.status === "alternative");
        for (const o of otros) {
          expect(o.capacidadMinBtuH).toBeGreaterThanOrEqual(primeros[0]!.capacidadMinBtuH);
        }
      }
    }
  });

  it("es determinista: dos ejecuciones producen exactamente la misma salida", () => {
    const spec = barranquillaConRespuesta();
    expect(JSON.stringify(evaluateCoolingUnitShortlist(spec))).toEqual(
      JSON.stringify(evaluateCoolingUnitShortlist(spec)),
    );
  });
});
