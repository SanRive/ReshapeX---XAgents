/**
 * Tests del post-check numerico — A6.
 *
 * La pregunta que responden: ¿bloquea lo inventado SIN bloquear lo legitimo?
 * Un guardrail que da falsos positivos acaba desactivado, que es peor que no
 * tenerlo.
 */

import { describe, test, expect } from "vitest";

import { postCheck, buildAllowedValues, numbersIn, parseNumberForms } from "../post-check";
import { SPEC_TURNO_1, SPEC_TURNO_2 } from "../../fixtures/barranquilla";
import { emptyField, type ProjectSpec } from "../../project-spec";

const blank = (): ProjectSpec => {
  const base = { ...SPEC_TURNO_1 } as unknown as Record<string, unknown>;
  for (const k of Object.keys(base)) {
    if (base[k] && typeof base[k] === "object" && "status" in (base[k] as object)) {
      base[k] = emptyField();
    }
  }
  base.component_list = null;
  return base as unknown as ProjectSpec;
};

describe("parseNumberForms — ambiguedad es/en", () => {
  test("1.350 se lee como 1350 y como 1.35", () => {
    const f = parseNumberForms("1.350");
    expect(f).toContain(1350);
    expect(f).toContain(1.35);
  });
  test("35,5 se lee como 35.5", () => {
    expect(parseNumberForms("35,5")).toContain(35.5);
  });
});

describe("numbersIn", () => {
  test("no parte los numeros de cuatro cifras", () => {
    const n = numbersIn("El DTS 31X5 da 5000 – 7000 Btu/h a 460 V");
    for (const v of [5000, 7000, 460]) expect(n).toContain(v);
  });
});

describe("EL FALLO QUE EXISTE PARA IMPEDIR", () => {
  test("bloquea la disipacion inventada a partir de los kW nominales", () => {
    const r = postCheck(
      "Un variador de 22 kW tipicamente disipa un 3% de su potencia nominal, asi que unos 660 W por unidad.",
      SPEC_TURNO_1,
    );
    expect(r.replaced).toBe(true);
    expect(r.offenders.some((o) => o.value === 660 && o.unit === "w")).toBe(true);
  });

  test("bloquea una capacidad de catalogo que ninguna tool devolvio", () => {
    const r = postCheck("Te recomiendo el DTS 32X5, que da 9500 Btu/h.", SPEC_TURNO_1);
    expect(r.replaced).toBe(true);
  });

  test("el texto sustituido no inventa: deriva al ingeniero", () => {
    const r = postCheck("Serian unos 660 W.", SPEC_TURNO_1);
    expect(r.text).toMatch(/ingeniero de aplicacion/);
    expect(r.text).not.toMatch(/660/);
  });
});

describe("NO debe dar falsos positivos", () => {
  test("numeros sin unidad son prosa, no afirmaciones tecnicas", () => {
    const r = postCheck(
      "Hay 4 familias de tecnologia y necesito 3 datos para descartar las que no aplican.",
      SPEC_TURNO_1,
    );
    expect(r.replaced, JSON.stringify(r.offenders)).toBe(false);
  });

  test("deja pasar los valores que declaro el propio cliente", () => {
    const r = postCheck(
      "Con 38 °C de ambiente y un objetivo interno de 35 °C, el gabinete de 2000 mm de alto necesita refrigeracion activa.",
      SPEC_TURNO_1,
    );
    expect(r.replaced, JSON.stringify(r.offenders)).toBe(false);
  });

  test("deja pasar el margen documentado del 10%", () => {
    const r = postCheck(
      "El catalogo pide superar la disipacion en aproximadamente un 10%.",
      SPEC_TURNO_1,
    );
    expect(r.replaced).toBe(false);
  });

  test("deja pasar lo que devolvio una tool este turno", () => {
    const tool = "DTS 31X5 · 5000 – 7000 Btu/h · 115 / 230 / 400-460 V · 914 x 305 x 304 mm";
    const r = postCheck(
      "El DTS 31X5 cubre de 5000 a 7000 Btu/h y existe en 460 V.",
      SPEC_TURNO_1,
      [tool],
    );
    expect(r.replaced, JSON.stringify(r.offenders)).toBe(false);
  });

  test("acepta un resultado de tool que no sea string", () => {
    const r = postCheck("La unidad mide 914 mm de alto.", SPEC_TURNO_1, [
      { model: "DTS 31X5", dimensions_mm: { h: 914, w: 305, d: 304 } },
    ]);
    expect(r.replaced, JSON.stringify(r.offenders)).toBe(false);
  });

  test("el turno 2 puede citar sus propios datos: 650 W, 460 V, 1350 W", () => {
    const r = postCheck(
      "Con 650 W por variador y el PLC, son 1350 W en total, alimentados a 460 V.",
      SPEC_TURNO_2,
    );
    expect(r.replaced, JSON.stringify(r.offenders)).toBe(false);
  });
});

describe("la suma declarada es citable, lo redondeado a ojo no", () => {
  test("1350 W procedente de la lista de componentes pasa", () => {
    const spec = blank();
    spec.component_list = [
      { name: "variador", w: 650, qty: 2 },
      { name: "PLC", w: 50, qty: 1 },
    ];
    expect(postCheck("Sumando lo que declaraste son 1350 W.", spec).replaced).toBe(false);
  });

  test("y el requerido con el margen del 10% tambien: 1485 W", () => {
    const spec = blank();
    spec.component_list = [
      { name: "variador", w: 650, qty: 2 },
      { name: "PLC", w: 50, qty: 1 },
    ];
    expect(postCheck("Con el margen del catalogo, 1485 W.", spec).replaced).toBe(false);
  });

  test("pero 1400 W, que nadie declaro ni se deriva de nada, no", () => {
    const spec = blank();
    spec.component_list = [{ name: "variador", w: 650, qty: 2 }];
    expect(postCheck("Serian unos 1400 W.", spec).replaced).toBe(true);
  });
});

describe("buildAllowedValues", () => {
  test("incluye el total sumado, no solo los subtotales", () => {
    const spec = blank();
    spec.component_list = [
      { name: "variador", w: 650, qty: 2 },
      { name: "PLC", w: 50, qty: 1 },
    ];
    const allowed = buildAllowedValues(spec);
    expect(allowed.has(1300)).toBe(true); // subtotal
    expect(allowed.has(1350)).toBe(true); // total — el que el agente cita
  });
});
