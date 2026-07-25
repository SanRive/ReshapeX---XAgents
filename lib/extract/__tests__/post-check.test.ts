/**
 * Tests del post-check numérico — tarea A6.
 *
 *   npx tsx --test lib/extract/__tests__/post-check.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildAllowedValues, postCheckProse, numbersIn, parseNumberForms } from "../post-check";
import { BARRANQUILLA_SPEC } from "../../fixtures/barranquilla";
import { emptySpec } from "../../project-spec";

const FALLBACK = "[respuesta sustituida por el guardrail]";
const check = (prose: string, allowed: Set<number>) => postCheckProse(prose, allowed, FALLBACK);

describe("parseNumberForms — ambigüedad es/en", () => {
  test("1.350 se lee como 1350 y como 1.35", () => {
    const f = parseNumberForms("1.350");
    assert.ok(f.includes(1350), "lectura española");
    assert.ok(f.includes(1.35), "lectura inglesa");
  });
  test("35,5 se lee como 35.5", () => {
    assert.ok(parseNumberForms("35,5").includes(35.5));
  });
});

describe("numbersIn", () => {
  test("saca los números de un texto", () => {
    const n = numbersIn("El DTS 31X5 da 5000 – 7000 Btu/h a 460 V");
    for (const v of [5000, 7000, 460]) assert.ok(n.includes(v), `falta ${v}`);
  });
});

describe("EL FALLO QUE EXISTE PARA IMPEDIR", () => {
  test("bloquea la disipación inventada a partir de los kW nominales", () => {
    const allowed = buildAllowedValues(BARRANQUILLA_SPEC);
    const r = check(
      "Un variador de 22 kW típicamente disipa un 3% de su potencia nominal, así que unos 660 W por unidad.",
      allowed,
    );
    assert.equal(r.ok, false);
    assert.equal(r.substituted, true);
    assert.equal(r.safe, FALLBACK);
    assert.ok(
      r.offenders.some((o) => o.value === 660 && o.unit === "w"),
      `esperaba 660 W entre los infractores, hubo: ${JSON.stringify(r.offenders)}`,
    );
  });

  test("bloquea una capacidad de catálogo que nadie devolvió", () => {
    const r = check("Te recomiendo el DTS 32X5, que da 9500 Btu/h.", buildAllowedValues(BARRANQUILLA_SPEC));
    assert.equal(r.ok, false);
  });
});

describe("NO debe dar falsos positivos", () => {
  const allowed = buildAllowedValues(BARRANQUILLA_SPEC);

  test("números sin unidad son prosa, no afirmaciones técnicas", () => {
    const r = check(
      "Hay 4 familias de tecnología y necesito 3 datos para descartar las que no aplican.",
      allowed,
    );
    assert.equal(r.ok, true, `no debía bloquear: ${JSON.stringify(r.offenders)}`);
  });

  test("deja pasar los valores declarados por el propio cliente", () => {
    const r = check(
      "Con 38 °C de ambiente y un objetivo interno de 35 °C, el gabinete de 2000 mm de alto necesita refrigeración activa.",
      allowed,
    );
    assert.equal(r.ok, true, `no debía bloquear: ${JSON.stringify(r.offenders)}`);
  });

  test("deja pasar el margen documentado del 10%", () => {
    const r = check("El catálogo pide superar la disipación en aproximadamente un 10%.", allowed);
    assert.equal(r.ok, true);
  });

  test("deja pasar lo que devolvió una herramienta este turno", () => {
    const toolOut = "DTS 31X5 · 5000 – 7000 Btu/h · 115 / 230 / 400-460 V · 914 x 305 x 304 mm";
    const r = check(
      "El DTS 31X5 cubre de 5000 a 7000 Btu/h y existe en 460 V.",
      buildAllowedValues(BARRANQUILLA_SPEC, [toolOut]),
    );
    assert.equal(r.ok, true, `no debía bloquear: ${JSON.stringify(r.offenders)}`);
  });

  test("tolera el separador de miles español", () => {
    const spec = { ...emptySpec() };
    spec.derived = { ...spec.derived, required_w: 1485 };
    const r = check("Necesitas al menos 1.485 W de capacidad.", buildAllowedValues(spec));
    assert.equal(r.ok, true);
  });
});

describe("la suma declarada sí es citable", () => {
  test("1350 W procedente de la lista de componentes pasa", () => {
    const spec = { ...emptySpec() };
    spec.component_list = [
      { name: "variador", w: 650, qty: 2 },
      { name: "PLC", w: 50, qty: 1 },
    ];
    const r = check("Sumando lo que declaraste son 1350 W.", buildAllowedValues(spec));
    assert.equal(r.ok, true);
  });

  test("pero 1400 W, que nadie declaró, no", () => {
    const spec = { ...emptySpec() };
    spec.component_list = [{ name: "variador", w: 650, qty: 2 }];
    const r = check("Serían unos 1400 W.", buildAllowedValues(spec));
    assert.equal(r.ok, false);
  });
});

describe("el resultado es utilizable por la UI", () => {
  test("cuando pasa, devuelve la prosa intacta", () => {
    const prose = "Necesitas refrigeración activa de lazo cerrado.";
    const r = check(prose, buildAllowedValues(BARRANQUILLA_SPEC));
    assert.equal(r.safe, prose);
    assert.equal(r.substituted, false);
  });

  test("cuando falla, informa qué fragmento lo provocó", () => {
    const r = check("Serían unos 660 W.", buildAllowedValues(BARRANQUILLA_SPEC));
    assert.match(r.offenders[0]!.text, /660/);
  });
});
