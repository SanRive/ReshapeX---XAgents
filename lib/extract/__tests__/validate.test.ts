/**
 * Tests del validador de sobres — A5.
 *
 * Los casos vienen de la verificacion hecha el 2026-07-25 contra
 * `tools/smoke_test_providers.py`, portados al validador real y al contrato
 * definitivo. Sin mocks del LLM: se prueba el codigo determinista.
 */

import { describe, test, expect } from "vitest";

import { validateExtraction, sumComponentList, norm, evidenceHasNumber } from "../validate";
import { emptySpec, type AnyField, type ExtractedSpec } from "../../project-spec";
import { BARRANQUILLA_INPUT as EMAIL_INTAKE, BARRANQUILLA_SPEC as SPEC_TURNO_1 } from "../../fixtures/barranquilla";


/** Spec base con todo en missing, y un unico campo poblado. */
function specWith(key: string, f: unknown): ExtractedSpec {
  const base = emptySpec() as unknown as Record<string, unknown>;
  base.component_list = null;
  base[key] = f;
  return base as unknown as ExtractedSpec;
}

const at = (s: ExtractedSpec, k: string) => s[k as keyof ExtractedSpec] as AnyField;

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
    const { spec: clean, log: degraded } = validateExtraction(
      specWith("ambient_temp_max_c", {
        status: "declared",
        value: 38,
        evidence: "la temperatura ambiente llega a 38 °C",
        basis: null,
        
      }),
      input,
    );
    expect(degraded).toHaveLength(0);
    expect(at(clean, "ambient_temp_max_c").status).toBe("declared");
  });

  test("inferred con la cita documentada sobrevive y toma el valor de la lista", () => {
    const { spec: clean, log: degraded } = validateExtraction(
      specWith("internal_temp_max_c", {
        status: "inferred",
        value: null,
        evidence: null,
        basis: "internal_temp_max_c",
        
      }),
      EMAIL_INTAKE,
    );
    expect(at(clean, "internal_temp_max_c").status).toBe("inferred");
    expect(at(clean, "internal_temp_max_c").value).toBe(35);
    expect(degraded[0]?.action).toBe("defaulted");
  });

});

// ---------------------------------------------------------------------------

describe("DEBEN SER CAZADOS", () => {
  const casos: Array<[string, string, unknown]> = [
    [
      "22 kW → 22000 W (la trampa principal)",
      "total_dissipation_w",
      { status: "declared", value: 22000, evidence: "dos variadores de 22 kW", basis: null, blocks: null },
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
        basis: "lo habitual en industria",
        
      },
    ],
    [
      "inferred sobre un campo que no tiene default documentado",
      "supply_voltage",
      {
        status: "inferred",
        value: "230V",
        evidence: null,
        basis: "supply_voltage",
        
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
      const { spec: clean, log: degraded } = validateExtraction(specWith(campo, sobre), EMAIL_INTAKE);
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
    const { log: degraded } = validateExtraction(
      specWith("total_dissipation_w", {
        status: "declared",
        value: 22000,
        evidence: "dos variadores de 22 kW",
        basis: null,
        
      }),
      EMAIL_INTAKE,
    );
    expect(degraded[0]!.action).toBe("degraded");
    expect(degraded[0]!.reason).toMatch(/no aparece en su propia evidencia/);
  });
});

// ---------------------------------------------------------------------------

describe("missing se sanea siempre", () => {
  test("un missing con valor colado se limpia", () => {
    const { spec: clean } = validateExtraction(
      specWith("total_dissipation_w", {
        status: "missing",
        value: 1350,
        evidence: "inventado",
        basis: null,
        
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
    const spec = specWith("total_dissipation_w", { status: "missing", value: null, evidence: null, basis: null });
    spec.component_list = [
      { name: "variador", w: 650, qty: 2, evidence: "2 variadores ... 650 W" },
      { name: "PLC", w: 50, qty: 1, evidence: "1 PLC de 50 W" },
    ];
    const { spec: clean, log: degraded } = sumComponentList(spec, "2 variadores ... 650 W y 1 PLC de 50 W");
    expect(at(clean, "total_dissipation_w").value).toBe(1350);
    expect(degraded[0]!.reason).toMatch(/Suma, no estimación/);
  });

  test("no pisa una disipacion ya declarada", () => {
    const spec = specWith("total_dissipation_w", {
      status: "declared",
      value: 900,
      evidence: "900 W",
      basis: null,
      
    });
    spec.component_list = [{ name: "x", w: 100, qty: 1, evidence: "1 unidad de 100 W" }];
    expect(at(sumComponentList(spec, "1 unidad de 100 W").spec, "total_dissipation_w").value).toBe(900);
  });

  test("sin lista no inventa nada", () => {
    const spec = specWith("total_dissipation_w", { status: "missing", value: null, evidence: null, basis: null });
    spec.component_list = null;
    const { spec: clean, log: degraded } = sumComponentList(spec, "2 variadores ... 650 W y 1 PLC de 50 W");
    expect(at(clean, "total_dissipation_w").value).toBeNull();
    expect(degraded).toHaveLength(0);
  });
});
