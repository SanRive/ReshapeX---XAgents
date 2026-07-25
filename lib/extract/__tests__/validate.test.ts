/**
 * Tests del validador de sobres — A5.
 *
 * Los casos vienen de la verificacion hecha el 2026-07-25 contra
 * `tools/smoke_test_providers.py`, portados al validador real y al contrato
 * definitivo. Sin mocks del LLM: se prueba el codigo determinista.
 */

import { describe, test, expect } from "vitest";

import { validate, sumComponentList, norm, evidenceHasNumber } from "../validate";
import { emptyField, type Field, type ProjectSpec } from "../../project-spec";
import { EMAIL_INTAKE, SPEC_TURNO_1 } from "../../fixtures/barranquilla";
import { DEFAULTS } from "../../project-spec";

/** Spec base con todo en missing, y un unico campo poblado. */
function specWith(key: string, f: Field | unknown): ProjectSpec {
  const base = { ...SPEC_TURNO_1 } as unknown as Record<string, unknown>;
  for (const k of Object.keys(base)) {
    if (base[k] && typeof base[k] === "object" && "status" in (base[k] as object)) {
      base[k] = emptyField();
    }
  }
  base.component_list = null;
  base[key] = f;
  return base as unknown as ProjectSpec;
}

const at = (s: ProjectSpec, k: string) => s[k as keyof ProjectSpec] as Field;

// ---------------------------------------------------------------------------

describe("normalizacion", () => {
  test("colapsa espacios, recorta extremos y baja a minusculas", () => {
    expect(norm("  La   ZONA\n se lava  ")).toBe("la zona se lava");
  });
});

describe("evidenceHasNumber — bordes en ambas direcciones", () => {
  test("38 esta en '38 °C'", () => {
    expect(evidenceHasNumber("llega a 38 °C", 38)).toBe(true);
  });
  test("380 NO esta en '38 °C' — el caso que da nombre a la regla", () => {
    expect(evidenceHasNumber("llega a 38 °C", 380)).toBe(false);
  });
  test("38 NO cuela dentro de '380 V'", () => {
    expect(evidenceHasNumber("alimentacion de 380 V", 38)).toBe(false);
  });
  test("acepta coma decimal espanola", () => {
    expect(evidenceHasNumber("un ambiente de 35,5 grados", 35.5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("DEBEN PASAR", () => {
  test("cita que cruza un salto de linea del correo", () => {
    const input = "La planta trabaja 24/7 y la\ntemperatura ambiente llega a 38 °C.";
    const { clean, degraded } = validate(
      specWith("ambient_temp_max_c", {
        status: "declared",
        value: 38,
        evidence: "la temperatura ambiente llega a 38 °C",
        basis: null,
        blocks: null,
      }),
      input,
    );
    expect(degraded).toHaveLength(0);
    expect(at(clean, "ambient_temp_max_c").status).toBe("declared");
  });

  test("inferred con la cita documentada sobrevive y toma el valor de la lista", () => {
    const { clean, degraded } = validate(
      specWith("internal_temp_max_c", {
        status: "inferred",
        value: null,
        evidence: null,
        basis: DEFAULTS.internal_temp_max_c!.citation,
        blocks: null,
      }),
      EMAIL_INTAKE,
    );
    expect(at(clean, "internal_temp_max_c").status).toBe("inferred");
    expect(at(clean, "internal_temp_max_c").value).toBe(35);
    expect(degraded[0]?.kind).toBe("default");
  });

  test("el fixture del turno 1 sobrevive intacto a su propio validador", () => {
    const { clean } = validate(SPEC_TURNO_1, EMAIL_INTAKE);
    for (const k of Object.keys(SPEC_TURNO_1)) {
      const orig = SPEC_TURNO_1[k as keyof ProjectSpec];
      if (!orig || typeof orig !== "object" || !("status" in orig)) continue;
      expect(at(clean, k).status, `${k} cambio de estado`).toBe((orig as Field).status);
    }
  });
});

// ---------------------------------------------------------------------------

describe("DEBEN SER CAZADOS", () => {
  const casos: Array<[string, string, unknown]> = [
    [
      "22 kW → 22000 W (la trampa principal)",
      "total_dissipation_w",
      { status: "declared", value: 22000, evidence: "2 variadores de 22 kW", basis: null, blocks: null },
    ],
    [
      "38 °C → 380",
      "ambient_temp_max_c",
      { status: "declared", value: 380, evidence: "38 °C de ambiente", basis: null, blocks: null },
    ],
    [
      "declared sin evidencia",
      "ambient_temp_max_c",
      { status: "declared", value: 38, evidence: null, basis: null, blocks: null },
    ],
    [
      "declared con evidencia en blanco",
      "ambient_temp_max_c",
      { status: "declared", value: 38, evidence: "   ", basis: null, blocks: null },
    ],
    [
      "evidencia inventada, no esta en el correo",
      "ambient_temp_max_c",
      { status: "declared", value: 38, evidence: "el ambiente es de 38 grados", basis: null, blocks: null },
    ],
    [
      "inferred con cita fabricada",
      "internal_temp_max_c",
      {
        status: "inferred",
        value: 35,
        evidence: null,
        basis: { documento: "Catalogo", pagina: "p. 2", texto_citado: "lo habitual en industria" },
        blocks: null,
      },
    ],
    [
      "inferred sobre un campo que no tiene default documentado",
      "supply_voltage",
      {
        status: "inferred",
        value: "230V",
        evidence: null,
        basis: { documento: "Catalogo", pagina: "p. 3", texto_citado: "230 V es lo comun" },
        blocks: null,
      },
    ],
    [
      "estado desconocido",
      "ambient_temp_max_c",
      { status: "guessed", value: 38, evidence: "38 °C de ambiente", basis: null, blocks: null },
    ],
    ["valor pelado en vez de sobre", "total_dissipation_w", 22000],
  ];

  for (const [nombre, campo, sobre] of casos) {
    test(nombre, () => {
      const { clean, degraded } = validate(specWith(campo, sobre), EMAIL_INTAKE);
      // Un valor pelado no es un sobre: el validador lo ignora y la UI lo ve
      // como missing porque el spec base ya lo tenia asi.
      if (typeof sobre === "object") {
        expect(degraded.length, `${nombre} debia dejar rastro en el log`).toBeGreaterThan(0);
      }
      expect(at(clean, campo)?.status ?? "missing").toBe("missing");
      expect(at(clean, campo)?.value ?? null).toBeNull();
    });
  }

  test("el log explica POR QUE se degrado — ese texto va al brief", () => {
    const { degraded } = validate(
      specWith("total_dissipation_w", {
        status: "declared",
        value: 22000,
        evidence: "2 variadores de 22 kW",
        basis: null,
        blocks: null,
      }),
      EMAIL_INTAKE,
    );
    expect(degraded[0]!.kind).toBe("degraded");
    expect(degraded[0]!.text).toMatch(/no aparece en su propia evidencia/);
  });
});

// ---------------------------------------------------------------------------

describe("missing se sanea siempre", () => {
  test("un missing con valor colado se limpia", () => {
    const { clean } = validate(
      specWith("total_dissipation_w", {
        status: "missing",
        value: 1350,
        evidence: "inventado",
        basis: null,
        blocks: null,
      }),
      EMAIL_INTAKE,
    );
    expect(at(clean, "total_dissipation_w").value).toBeNull();
    expect(at(clean, "total_dissipation_w").evidence).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("sumComponentList — suma, no estimacion", () => {
  test("suma la lista declarada: el caso de §5 da 1350 W", () => {
    const spec = specWith("total_dissipation_w", emptyField());
    spec.component_list = [
      { name: "variador", w: 650, qty: 2 },
      { name: "PLC", w: 50, qty: 1 },
    ];
    const { clean, degraded } = sumComponentList(spec);
    expect(at(clean, "total_dissipation_w").value).toBe(1350);
    expect(degraded[0]!.text).toMatch(/Suma, no estimacion/);
  });

  test("no pisa una disipacion ya declarada", () => {
    const spec = specWith("total_dissipation_w", {
      status: "declared",
      value: 900,
      evidence: "900 W",
      basis: null,
      blocks: null,
    });
    spec.component_list = [{ name: "x", w: 100, qty: 1 }];
    expect(at(sumComponentList(spec).clean, "total_dissipation_w").value).toBe(900);
  });

  test("sin lista no inventa nada", () => {
    const spec = specWith("total_dissipation_w", emptyField());
    spec.component_list = null;
    const { clean, degraded } = sumComponentList(spec);
    expect(at(clean, "total_dissipation_w").value).toBeNull();
    expect(degraded).toHaveLength(0);
  });
});
