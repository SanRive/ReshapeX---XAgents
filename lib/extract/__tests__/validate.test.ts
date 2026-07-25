/**
 * Tests del validador de sobres — tarea A5.
 *
 * Los nueve primeros son los casos verificados el 2026-07-25 contra
 * `tools/smoke_test_providers.py`, portados al validador real.
 *
 *   node --test --experimental-strip-types lib/extract/__tests__/validate.test.ts
 */

import { describe, test } from "vitest";
import assert from "node:assert/strict";

import { validateExtraction, sumComponentList, norm, evidenceHasNumber } from "../validate";
import { emptySpec, type ExtractedSpec, type AnyField } from "../../project-spec";
import { BARRANQUILLA_INPUT } from "../../fixtures/barranquilla";

/** Construye un spec con un único campo poblado, el resto en missing. */
function specWith(key: string, f: AnyField): ExtractedSpec {
  const s = emptySpec() as unknown as Record<string, unknown>;
  s[key] = f;
  return s as unknown as ExtractedSpec;
}

const statusOf = (s: ExtractedSpec, k: string) => (s[k as keyof ExtractedSpec] as AnyField).status;
const valueOf = (s: ExtractedSpec, k: string) => (s[k as keyof ExtractedSpec] as AnyField).value;

// ---------------------------------------------------------------------------

describe("normalización", () => {
  test("colapsa espacios y baja a minúsculas", () => {
    assert.equal(norm("  La   ZONA\n se lava  "), "la zona se lava");
  });
});

describe("evidenceHasNumber — los bordes en ambas direcciones", () => {
  test("38 está en '38 °C'", () => {
    assert.equal(evidenceHasNumber("llega a 38 °C", 38), true);
  });
  test("380 NO está en '38 °C' — el caso que da nombre a la regla", () => {
    assert.equal(evidenceHasNumber("llega a 38 °C", 380), false);
  });
  test("38 NO cuela dentro de '380 V'", () => {
    assert.equal(evidenceHasNumber("alimentación de 380 V", 38), false);
  });
  test("acepta coma decimal española", () => {
    assert.equal(evidenceHasNumber("un ambiente de 35,5 grados", 35.5), true);
  });
});

// ---------------------------------------------------------------------------

describe("DEBEN PASAR", () => {
  test("cita que cruza un salto de línea del correo", () => {
    const input = "La planta trabaja 24/7 y la\ntemperatura ambiente llega a 38 °C.";
    const { spec, degraded } = validateExtraction(
      specWith("ambient_temp_max_c", {
        status: "declared",
        value: 38,
        evidence: "la temperatura ambiente llega a 38 °C",
        basis: null,
      }),
      input,
    );
    assert.equal(degraded, 0, "una cita correcta no se degrada por un \\n");
    assert.equal(statusOf(spec, "ambient_temp_max_c"), "declared");
  });

  test("cita corta dentro de una sola línea", () => {
    const { spec, degraded } = validateExtraction(
      specWith("ambient_temp_max_c", {
        status: "declared",
        value: 38,
        evidence: "llega a 38 °C",
        basis: null,
      }),
      BARRANQUILLA_INPUT,
    );
    assert.equal(degraded, 0);
    assert.equal(valueOf(spec, "ambient_temp_max_c"), 38);
  });

  test("inferred con basis en la lista blanca aplica el valor documentado", () => {
    const { spec, degraded } = validateExtraction(
      specWith("internal_temp_max_c", {
        status: "inferred",
        value: null,
        evidence: null,
        basis: "internal_temp_max_c",
      }),
      BARRANQUILLA_INPUT,
    );
    assert.equal(degraded, 0);
    assert.equal(statusOf(spec, "internal_temp_max_c"), "inferred");
    assert.equal(valueOf(spec, "internal_temp_max_c"), 35);
  });
});

// ---------------------------------------------------------------------------

describe("DEBEN SER CAZADOS", () => {
  const casos: Array<[string, string, AnyField]> = [
    [
      "22 kW → 22000 W (la trampa principal)",
      "total_dissipation_w",
      { status: "declared", value: 22000, evidence: "dos variadores de 22 kW", basis: null },
    ],
    [
      "38 °C → 380",
      "ambient_temp_max_c",
      { status: "declared", value: 380, evidence: "llega a 38 °C", basis: null },
    ],
    [
      "declared sin evidencia",
      "ambient_temp_max_c",
      { status: "declared", value: 38, evidence: null, basis: null },
    ],
    [
      "declared con evidencia vacía",
      "ambient_temp_max_c",
      { status: "declared", value: 38, evidence: "   ", basis: null },
    ],
    [
      "evidencia inventada (no está en el input)",
      "ambient_temp_max_c",
      { status: "declared", value: 38, evidence: "el ambiente es de 38 grados", basis: null },
    ],
    [
      "inferred con basis fuera de la lista blanca",
      "supply_voltage",
      { status: "inferred", value: "230V", evidence: null, basis: "lo habitual en industria" },
    ],
    [
      "estado desconocido",
      "ambient_temp_max_c",
      { status: "guessed" as AnyField["status"], value: 38, evidence: "38 °C", basis: null },
    ],
  ];

  for (const [nombre, campo, sobre] of casos) {
    test(nombre, () => {
      const { spec, degraded } = validateExtraction(specWith(campo, sobre), BARRANQUILLA_INPUT);
      assert.equal(degraded, 1, `${nombre} debía degradarse`);
      assert.equal(statusOf(spec, campo), "missing");
      assert.equal(valueOf(spec, campo), null);
    });
  }

  test("valor pelado en vez de sobre no revienta, se degrada", () => {
    const { spec, degraded } = validateExtraction(
      specWith("total_dissipation_w", 22000 as unknown as AnyField),
      BARRANQUILLA_INPUT,
    );
    assert.equal(degraded, 1);
    assert.equal(statusOf(spec, "total_dissipation_w"), "missing");
  });

  test("el log explica POR QUÉ se degradó — va al brief", () => {
    const { log } = validateExtraction(
      specWith("total_dissipation_w", {
        status: "declared",
        value: 22000,
        evidence: "dos variadores de 22 kW",
        basis: null,
      }),
      BARRANQUILLA_INPUT,
    );
    assert.equal(log.length, 1);
    assert.equal(log[0]!.action, "degraded");
    assert.equal(log[0]!.proposed, "22000");
    assert.match(log[0]!.reason, /no aparece en su propia evidencia/);
  });
});

// ---------------------------------------------------------------------------

describe("missing se sanea siempre", () => {
  test("un missing con valor colado se limpia", () => {
    const { spec } = validateExtraction(
      specWith("total_dissipation_w", {
        status: "missing",
        value: 1350,
        evidence: "inventado",
        basis: "inventado",
      }),
      BARRANQUILLA_INPUT,
    );
    assert.equal(valueOf(spec, "total_dissipation_w"), null);
  });
});

// ---------------------------------------------------------------------------

describe("sumComponentList — suma, no estimación", () => {
  test("suma la lista declarada y lo deja trazado", () => {
    const base = emptySpec() as unknown as ExtractedSpec;
    const conLista: ExtractedSpec = {
      ...base,
      component_list: [
        { name: "variador", w: 650, qty: 2 },
        { name: "PLC", w: 50, qty: 1 },
      ],
    };
    const { spec, log } = sumComponentList(conLista);
    // El caso de §5: 2 × 650 + 50 = 1350 W
    assert.equal(valueOf(spec, "total_dissipation_w"), 1350);
    assert.equal(log[0]!.action, "summed");
    assert.match(log[0]!.reason, /Suma, no estimación/);
  });

  test("no pisa una disipación ya declarada", () => {
    const base = emptySpec() as unknown as Record<string, unknown>;
    base.total_dissipation_w = { status: "declared", value: 900, evidence: "900 W", basis: null };
    base.component_list = [{ name: "x", w: 100, qty: 1 }];
    const { spec } = sumComponentList(base as unknown as ExtractedSpec);
    assert.equal(valueOf(spec, "total_dissipation_w"), 900);
  });

  test("sin lista no inventa nada", () => {
    const { spec, log } = sumComponentList(emptySpec() as unknown as ExtractedSpec);
    assert.equal(valueOf(spec, "total_dissipation_w"), null);
    assert.equal(log.length, 0);
  });
});
