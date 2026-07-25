import { describe, expect, it } from "vitest";

import {
  DEFAULTS,
  FIELD_KEYS,
  NUMERIC_FIELD_KEYS,
  emptySpec,
  missingForGate,
  missingForShortlist,
  type AnyField,
  type ProjectSpec,
} from "../../project-spec";
import {
  BARRANQUILLA_INPUT,
  BARRANQUILLA_SPEC,
} from "../../fixtures/barranquilla";
import {
  FUERA_DE_ALCANCE_INPUT,
  detectOutOfScope,
} from "../../fixtures/out-of-scope";
import {
  blockingFields,
  shortlistFields,
  washdownApplies,
} from "../../format";
import { RESPUESTA_CLIENTE, SPEC_TURNO_2 } from "../turns";

/**
 * Los fixtures son lo que pinta la UI y lo que va a servir de regresión cuando
 * la extracción funcione. Si alguien retoca el texto del correo y una evidencia
 * deja de ser literal, el validador real degradaría ese campo a `missing` y la
 * demo se caería en vivo — sin que nada avise.
 *
 * Esto aplica al fixture las mismas reglas que `validate.ts` va a aplicar a la
 * salida del modelo. No testea la UI: testea que el contrato se cumple.
 */

/** Misma normalización que exige el contrato: espacios y mayúsculas. */
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function declaredFields(spec: ProjectSpec) {
  return FIELD_KEYS.map((key) => [key, spec[key] as AnyField] as const).filter(
    ([, f]) => f.status === "declared",
  );
}

describe("fixture de Barranquilla · turno 1", () => {
  it("toda evidencia declarada es substring LITERAL del correo", () => {
    const haystack = norm(BARRANQUILLA_INPUT);
    for (const [key, f] of declaredFields(BARRANQUILLA_SPEC)) {
      expect(f.evidence, `${key} declarado sin evidencia`).toBeTruthy();
      expect(
        haystack.includes(norm(f.evidence!)),
        `${key}: «${f.evidence}» no aparece en el correo`,
      ).toBe(true);
    }
  });

  it("los dígitos de cada valor numérico aparecen en su evidencia", () => {
    for (const [key, f] of declaredFields(BARRANQUILLA_SPEC)) {
      if (!NUMERIC_FIELD_KEYS.includes(key)) continue;
      const digits = String(f.value).replace(/\D/g, "");
      expect(
        f.evidence!.replace(/\D/g, "").includes(digits),
        `${key}: los dígitos ${digits} no están en «${f.evidence}»`,
      ).toBe(true);
    }
  });

  it("todo `basis` es una clave real de la lista blanca DEFAULTS", () => {
    for (const key of FIELD_KEYS) {
      const f = BARRANQUILLA_SPEC[key] as AnyField;
      if (f.status !== "inferred") continue;
      expect(f.basis, `${key} inferido sin basis`).toBeTruthy();
      expect(Object.keys(DEFAULTS), `${key}: basis «${f.basis}» fuera de DEFAULTS`)
        .toContain(f.basis);
    }
  });

  it("ningún campo `missing` conserva valor", () => {
    for (const key of FIELD_KEYS) {
      const f = BARRANQUILLA_SPEC[key] as AnyField;
      if (f.status === "missing") expect(f.value, key).toBeNull();
    }
  });

  it("EL MOMENTO DE LA DEMO: los 22 kW no se convirtieron en watts", () => {
    expect(BARRANQUILLA_SPEC.total_dissipation_w.status).toBe("missing");
    expect(BARRANQUILLA_SPEC.total_dissipation_w.value).toBeNull();

    const degraded = BARRANQUILLA_SPEC.decision_log.find(
      (d) => d.field === "total_dissipation_w" && d.action === "degraded",
    );
    expect(degraded, "el log tiene que dejar constancia de la degradación").toBeTruthy();
    expect(degraded!.proposed).toBe("22000");
  });

  it("la compuerta ya puede correr y el shortlist todavía no", () => {
    expect(missingForGate(BARRANQUILLA_SPEC)).toEqual([]);
    expect(missingForShortlist(BARRANQUILLA_SPEC).sort()).toEqual(
      ["housing_material", "supply_voltage", "total_dissipation_w"].sort(),
    );
  });

  it("washdown arrastra housing_material al umbral 2", () => {
    expect(BARRANQUILLA_SPEC.location.value).toBe("washdown");
    expect(missingForShortlist(BARRANQUILLA_SPEC)).toContain("housing_material");
  });

  it("sin disipación no hay derivados de capacidad", () => {
    expect(BARRANQUILLA_SPEC.derived.required_w).toBeNull();
    expect(BARRANQUILLA_SPEC.derived.required_capacity_btuh).toBeNull();
    expect(BARRANQUILLA_SPEC.derived.nema_required).toBe("4_4X");
  });
});

describe("turno 2 · andamio de la UI", () => {
  const conversation = `${BARRANQUILLA_INPUT}\n${RESPUESTA_CLIENTE}`;

  it("toda evidencia nueva es literal, salvo la excepción documentada", () => {
    const haystack = norm(conversation);
    for (const [key, f] of declaredFields(SPEC_TURNO_2)) {
      // total_dissipation_w es la suma que hace el código: el 1 350 no aparece
      // literal en ningún mensaje. Se comprueba aparte, abajo.
      if (key === "total_dissipation_w") continue;
      expect(
        haystack.includes(norm(f.evidence!)),
        `${key}: «${f.evidence}» no aparece en la conversación`,
      ).toBe(true);
    }
  });

  /**
   * ⚠️ PISTA A — esto es la pregunta abierta del contrato, escrita como test.
   *
   * La suma sí es literal en sus TÉRMINOS (650 y 50 están en el mensaje) pero
   * no en su RESULTADO. Con la regla de los dígitos aplicada tal cual, el
   * validador degradaría el campo y el shortlist no saldría. Por eso el camino
   * de la suma tiene que quedar exento, y por eso el contrato ya trae la acción
   * `summed`. Si se decide lo contrario, este test es el que hay que cambiar.
   */
  it("la suma es literal en sus términos, no en su resultado", () => {
    const f = SPEC_TURNO_2.total_dissipation_w;
    expect(f.value).toBe(1350);
    expect(norm(conversation)).toContain(norm(f.evidence!));
    expect(f.evidence).toContain("650");
    expect(f.evidence).toContain("50");
    expect(f.evidence).not.toContain("1350");

    const summed = SPEC_TURNO_2.decision_log.find((d) => d.action === "summed");
    expect(summed, "la suma tiene que quedar registrada en el log").toBeTruthy();
  });

  it("la lista de componentes suma exactamente el valor del campo", () => {
    const total = (SPEC_TURNO_2.component_list ?? []).reduce(
      (a, c) => a + c.w * c.qty,
      0,
    );
    expect(total).toBe(SPEC_TURNO_2.total_dissipation_w.value);
  });

  it("los derivados salen de la fórmula citada, no de un número a mano", () => {
    const w = SPEC_TURNO_2.total_dissipation_w.value as number;
    expect(SPEC_TURNO_2.derived.required_w).toBeCloseTo(w * 1.1, 6);
    expect(SPEC_TURNO_2.derived.required_capacity_btuh).toBeCloseTo(
      w * 1.1 * 3.412,
      6,
    );
    // El 5 067 Btu/h que se dice en la demo.
    expect(Math.round(SPEC_TURNO_2.derived.required_capacity_btuh!)).toBe(5067);
  });

  it("cierra los dos umbrales", () => {
    expect(missingForShortlist(SPEC_TURNO_2)).toEqual([]);
  });
});

describe("medidor de umbrales", () => {
  it("washdown añade una sexta pastilla al umbral 2", () => {
    expect(washdownApplies(BARRANQUILLA_SPEC)).toBe(true);
    expect(shortlistFields(BARRANQUILLA_SPEC)).toHaveLength(6);
    expect(shortlistFields(BARRANQUILLA_SPEC)).toContain("housing_material");
    expect(blockingFields(BARRANQUILLA_SPEC)).toHaveLength(9);
  });

  it("en interior el material no cuenta: cinco pastillas y ocho bloqueantes", () => {
    const indoor: ProjectSpec = {
      ...BARRANQUILLA_SPEC,
      location: { ...BARRANQUILLA_SPEC.location, value: "indoor" },
    };
    expect(shortlistFields(indoor)).toHaveLength(5);
    expect(blockingFields(indoor)).toHaveLength(8);
    expect(missingForShortlist(indoor)).not.toContain("housing_material");
  });

  it("la cuenta que se pinta en la ficha cuadra en los dos turnos", () => {
    const count = (spec: ProjectSpec) => {
      const total = blockingFields(spec).length;
      return `${total - missingForShortlist(spec).length}/${total}`;
    };
    expect(count(BARRANQUILLA_SPEC)).toBe("6/9");
    expect(count(SPEC_TURNO_2)).toBe("9/9");
  });
});

describe("guardrail de fuera de alcance", () => {
  it("caza el correo de la demo", () => {
    expect(detectOutOfScope(FUERA_DE_ALCANCE_INPUT)).toBeTruthy();
  });

  it("caza entrada libre en los tres dominios cortados", () => {
    expect(detectOutOfScope("necesito un chiller para la planta")).toBe("chiller");
    expect(detectOutOfScope("¿venden calefactores para gabinete?")).toBeTruthy();
    expect(detectOutOfScope("quiero una baliza estroboscópica")).toBeTruthy();
  });

  it("deja pasar lo que sí está en alcance", () => {
    expect(
      detectOutOfScope("el tablero está a 40 °C en interior, ambiente sucio"),
    ).toBeNull();
  });
});

describe("emptySpec", () => {
  it("arranca con todo en missing y sin valores", () => {
    const spec = emptySpec();
    for (const key of FIELD_KEYS) {
      const f = spec[key] as AnyField;
      expect(f.status, key).toBe("missing");
      expect(f.value, key).toBeNull();
    }
    expect(spec.component_list).toBeNull();
    expect(spec.measured_temps).toBeNull();
    expect(spec.decision_log).toEqual([]);
  });

  it("no puede correr ni la compuerta ni el shortlist", () => {
    const spec = emptySpec();
    expect(missingForGate(spec)).toHaveLength(3);
    expect(missingForShortlist(spec).length).toBeGreaterThanOrEqual(8);
  });
});
