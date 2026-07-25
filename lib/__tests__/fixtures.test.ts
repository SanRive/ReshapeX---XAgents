import { describe, expect, it } from "vitest";

import {
  BLOCKING_FIELDS,
  ProjectSpecSchema,
  countSatisfied,
  gateReady,
  requiredWatts,
  shortlistReady,
  wattsToBtuh,
  type Field,
  type ProjectSpec,
} from "../project-spec";
import {
  DECISIONS_TURNO_1,
  DECISIONS_TURNO_2,
  DISCLAIMERS,
  EMAIL_INTAKE,
  GATE_BARRANQUILLA,
  QUESTIONS_TURNO_1,
  REPLY_DATOS,
  SHORTLIST_BARRANQUILLA,
  SPEC_TURNO_1,
  SPEC_TURNO_2,
} from "../fixtures/barranquilla";
import { DEMO_SCRIPT, EXAMPLES } from "../fixtures/conversation";
import {
  MESSAGE_OUT_OF_SCOPE,
  RESPONSE_OUT_OF_SCOPE,
  detectOutOfScope,
} from "../fixtures/out-of-scope";

/**
 * Los fixtures son lo que pinta la UI hoy y lo que servirá de regresión cuando
 * la extracción funcione. Se les aplican las mismas reglas que `validate.ts`
 * aplicará a la salida del modelo.
 *
 * El fallo que esto existe para cazar: alguien retoca el texto del correo, una
 * evidencia deja de ser literal, el validador real degradaría ese campo y la
 * demo se cae en vivo sin que nada haya avisado.
 */

/** Misma normalización que exige el contrato: espacios y mayúsculas. */
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

const FIELD_KEYS = Object.keys(ProjectSpecSchema.shape).filter(
  (k) => k !== "component_list",
) as (keyof ProjectSpec)[];

function fieldsOf(spec: ProjectSpec, status: Field["status"]) {
  return FIELD_KEYS.map((k) => [k, spec[k] as Field] as const).filter(
    ([, f]) => f.status === status,
  );
}

const NUMERIC_KEYS = [
  "height_mm",
  "width_mm",
  "depth_mm",
  "internal_temp_max_c",
  "internal_temp_min_c",
  "ambient_temp_max_c",
  "ambient_temp_min_c",
  "total_dissipation_w",
  "enclosure_count",
];

describe("integridad del fixture · turno 1", () => {
  it("valida contra el schema del contrato", () => {
    expect(ProjectSpecSchema.safeParse(SPEC_TURNO_1).success).toBe(true);
  });

  it("toda evidencia declarada es substring LITERAL del correo", () => {
    const haystack = norm(EMAIL_INTAKE);
    for (const [key, f] of fieldsOf(SPEC_TURNO_1, "declared")) {
      expect(f.evidence, `${key} declarado sin evidencia`).toBeTruthy();
      expect(
        haystack.includes(norm(f.evidence!)),
        `${key}: «${f.evidence}» no aparece en el correo`,
      ).toBe(true);
    }
  });

  it("los dígitos de cada valor numérico aparecen en su evidencia", () => {
    for (const [key, f] of fieldsOf(SPEC_TURNO_1, "declared")) {
      if (!NUMERIC_KEYS.includes(key)) continue;
      const digits = String(f.value).replace(/\D/g, "");
      expect(
        f.evidence!.replace(/\D/g, "").includes(digits),
        `${key}: los dígitos ${digits} no están en «${f.evidence}»`,
      ).toBe(true);
    }
  });

  it("todo inferido trae cita con documento, página y texto", () => {
    const inferred = fieldsOf(SPEC_TURNO_1, "inferred");
    expect(inferred.length).toBeGreaterThan(0);
    for (const [key, f] of inferred) {
      expect(f.basis, `${key} inferido sin cita`).toBeTruthy();
      expect(f.basis!.documento, key).toBeTruthy();
      expect(f.basis!.pagina, key).toBeTruthy();
      expect(f.basis!.texto_citado.length, key).toBeGreaterThan(10);
      expect(f.evidence, `${key}: un inferido no lleva evidencia`).toBeNull();
    }
  });

  it("ningún campo missing conserva valor ni evidencia", () => {
    for (const [key, f] of fieldsOf(SPEC_TURNO_1, "missing")) {
      expect(f.value, key).toBeNull();
      expect(f.evidence, key).toBeNull();
      expect(f.basis, key).toBeNull();
    }
  });

  it("EL MOMENTO DE LA DEMO: los 22 kW no se convirtieron en watts", () => {
    expect(SPEC_TURNO_1.total_dissipation_w.status).toBe("missing");
    expect(SPEC_TURNO_1.total_dissipation_w.value).toBeNull();
    expect(EMAIL_INTAKE).toContain("22 kW");
    // Y queda dicho por qué, no solo que falta.
    expect(SPEC_TURNO_1.total_dissipation_w.blocks).toMatch(/22 kW|potencia nominal/i);
  });

  it("solar_load queda sin afirmar en vez de inferido sin respaldo", () => {
    expect(SPEC_TURNO_1.solar_load.status).toBe("missing");
    expect(
      DECISIONS_TURNO_1.some((d) => d.text.includes("solar_load")),
      "la decisión de no afirmarlo tiene que quedar en el log",
    ).toBe(true);
  });

  it("la compuerta ya puede correr y el shortlist todavía no", () => {
    expect(gateReady(SPEC_TURNO_1)).toBe(true);
    expect(shortlistReady(SPEC_TURNO_1)).toBe(false);
  });

  it("faltan exactamente los tres bloqueantes de §5", () => {
    const missing = BLOCKING_FIELDS.filter(
      (k) => (SPEC_TURNO_1[k] as Field).status === "missing",
    );
    expect([...missing].sort()).toEqual(["supply_voltage", "total_dissipation_w"]);
    // housing_material bloquea por washdown aunque no esté en SHORTLIST_FIELDS.
    expect(SPEC_TURNO_1.housing_material.status).toBe("missing");
    expect(SPEC_TURNO_1.housing_material.blocks).toBeTruthy();
    expect(SPEC_TURNO_1.location.value).toBe("washdown");
  });

  it("la ficha muestra 6 de 8 bloqueantes cerrados", () => {
    expect(countSatisfied(SPEC_TURNO_1, BLOCKING_FIELDS)).toBe(6);
  });
});

describe("integridad del fixture · turno 2", () => {
  const conversation = `${EMAIL_INTAKE}\n${REPLY_DATOS}`;

  it("valida contra el schema del contrato", () => {
    expect(ProjectSpecSchema.safeParse(SPEC_TURNO_2).success).toBe(true);
  });

  it("toda evidencia nueva es literal en la conversación", () => {
    const haystack = norm(conversation);
    for (const [key, f] of fieldsOf(SPEC_TURNO_2, "declared")) {
      expect(
        haystack.includes(norm(f.evidence!)),
        `${key}: «${f.evidence}» no aparece en la conversación`,
      ).toBe(true);
    }
  });

  it("la suma va como inferida, no como declarada: el total no es literal", () => {
    const f = SPEC_TURNO_2.total_dissipation_w;
    expect(f.status).toBe("inferred");
    expect(f.value).toBe(1350);
    expect(f.basis, "la suma necesita respaldo del camino documentado").toBeTruthy();
    expect(conversation).not.toContain("1350");
  });

  it("la lista de componentes suma exactamente el valor del campo", () => {
    const total = (SPEC_TURNO_2.component_list ?? []).reduce(
      (a, c) => a + c.w * c.qty,
      0,
    );
    expect(total).toBe(SPEC_TURNO_2.total_dissipation_w.value);
    expect(total).toBe(1350);
  });

  it("cierra los dos umbrales", () => {
    expect(gateReady(SPEC_TURNO_2)).toBe(true);
    expect(shortlistReady(SPEC_TURNO_2)).toBe(true);
  });

  it("el log crece sobre el del turno 1, no lo reemplaza", () => {
    expect(DECISIONS_TURNO_2.length).toBeGreaterThan(DECISIONS_TURNO_1.length);
    expect(DECISIONS_TURNO_2.slice(0, DECISIONS_TURNO_1.length)).toEqual(
      DECISIONS_TURNO_1,
    );
  });
});

describe("compuerta de tecnología", () => {
  it("evalúa las cuatro familias, sin esconder ninguna", () => {
    expect(GATE_BARRANQUILLA).toHaveLength(4);
    expect(new Set(GATE_BARRANQUILLA.map((v) => v.family)).size).toBe(4);
  });

  it("sin cita no sale a la UI", () => {
    for (const v of GATE_BARRANQUILLA) {
      expect(v.citations.length, v.family).toBeGreaterThan(0);
      for (const c of v.citations) {
        expect(c.documento, v.family).toBeTruthy();
        expect(c.pagina, v.family).toBeTruthy();
        expect(c.texto_citado.length, v.family).toBeGreaterThan(10);
      }
    }
  });

  it("EL CASO NEGATIVO ARGUMENTADO: cada descarte trae razón y cita", () => {
    const rejected = GATE_BARRANQUILLA.filter((v) => v.verdict === "rejected");
    expect(rejected.length).toBe(2);
    for (const v of rejected) {
      expect(v.reason.length, v.family).toBeGreaterThan(40);
      expect(v.citations.length, v.family).toBeGreaterThan(0);
    }
  });

  it("cooling unit es el viable y air/water la alternativa condicionada", () => {
    const byFamily = Object.fromEntries(
      GATE_BARRANQUILLA.map((v) => [v.family, v.verdict]),
    );
    expect(byFamily.cooling_unit).toBe("viable");
    expect(byFamily.air_water_hx).toBe("conditional");
    expect(byFamily.filterfan).toBe("rejected");
    expect(byFamily.air_air_hx).toBe("rejected");
  });
});

describe("shortlist · la aritmética de §5", () => {
  const s = SHORTLIST_BARRANQUILLA;

  it("required sale de la fórmula citada, no de un número a mano", () => {
    expect(s.total_dissipation_w).toBe(1350);
    expect(s.required_w).toBeCloseTo(requiredWatts(1350), 6);
    expect(s.required_btuh).toBeCloseTo(wattsToBtuh(requiredWatts(1350)), 6);
    expect(Math.round(s.required_btuh)).toBe(5067);
  });

  it("el DTS 31X5 queda por debajo en su extremo bajo — de ahí el «verificar»", () => {
    const dts = s.candidates.find((c) => c.model === "DTS 31X5")!;
    expect(dts.verdict).toBe("conditional");
    expect(dts.capacity_btuh[0]).toBeLessThan(s.required_btuh);
    const gap = (s.required_btuh - dts.capacity_btuh[0]) / s.required_btuh;
    expect(gap * 100).toBeCloseTo(1.3, 1);
  });

  it("el DTS 32X1 tiene margen: ~38 % por encima en su extremo bajo", () => {
    const alt = s.candidates.find((c) => c.model === "DTS 32X1")!;
    const over = (alt.capacity_btuh[0] - s.required_btuh) / s.required_btuh;
    expect(over * 100).toBeCloseTo(38, 0);
  });

  it("los rechazados por capacidad no alcanzan el requerido", () => {
    for (const model of ["DTS 31X1 SL", "DTS 31X1"]) {
      const c = s.rejected.find((r) => r.model === model)!;
      expect(c.capacity_btuh[1], model).toBeLessThan(s.required_btuh);
    }
  });

  it("el DTT 6301 se descarta por RATING, no por capacidad", () => {
    const dtt = s.rejected.find((c) => c.model === "DTT 6301")!;
    // Su rango sí cubre lo requerido: si el descarte fuera por capacidad, fallaría.
    expect(dtt.capacity_btuh[0]).toBeLessThanOrEqual(s.required_btuh);
    expect(dtt.capacity_btuh[1]).toBeGreaterThanOrEqual(s.required_btuh);
    expect(dtt.nema_available).toEqual(["12"]);
    expect(dtt.reason).toMatch(/rating/i);
  });

  it("todo modelo que sobrevive ofrece el 4/4X que exige el washdown", () => {
    for (const c of s.candidates) {
      expect(c.nema_available, c.model).toContain("4/4X");
    }
  });

  it("cada modelo, pase o no, lleva su cita", () => {
    for (const c of [...s.candidates, ...s.rejected]) {
      expect(c.citations.length, c.model).toBeGreaterThan(0);
      expect(c.reason.length, c.model).toBeGreaterThan(20);
    }
  });

  it("la nota de base DIN 35/35 está presente: es lo que aguanta la pregunta", () => {
    expect(s.derating_note).toBeTruthy();
    expect(s.derating_note).toMatch(/35\/35/);
  });

  it("una unidad por gabinete", () => {
    expect(s.units_needed).toBe(SPEC_TURNO_1.enclosure_count.value);
  });
});

describe("preguntas bloqueantes · FIELD_GUIDE", () => {
  it("son como mucho tres, según §3.3", () => {
    expect(QUESTIONS_TURNO_1.length).toBeLessThanOrEqual(3);
  });

  it("cada una explica para qué y dónde", () => {
    for (const q of QUESTIONS_TURNO_1) {
      expect(q.why.length, q.field).toBeGreaterThan(20);
      expect(q.where.length, q.field).toBeGreaterThan(20);
    }
  });

  it("la de disipación trae el antipatrón de los kW: es la que evita el error", () => {
    const q = QUESTIONS_TURNO_1.find((x) => x.field === "total_dissipation_w")!;
    expect(q.antipattern).toBeTruthy();
    expect(q.antipattern).toMatch(/22 kW|nominal/i);
    expect(q.alternative, "la lista de componentes es el camino alterno").toBeTruthy();
  });

  it("solo pregunta por lo que de verdad está bloqueado", () => {
    for (const q of QUESTIONS_TURNO_1) {
      const f = SPEC_TURNO_1[q.field as keyof ProjectSpec] as Field;
      expect(f.status, q.field).toBe("missing");
    }
  });
});

describe("guardrail de fuera de alcance", () => {
  it("caza el mensaje de la demo antes de llamar al modelo", () => {
    expect(detectOutOfScope(MESSAGE_OUT_OF_SCOPE)).toBeTruthy();
  });

  it("caza entrada libre en los dominios cortados", () => {
    expect(detectOutOfScope("necesito un chiller para la planta")).toBeTruthy();
    expect(detectOutOfScope("¿venden calefacción para gabinete?")).toBeTruthy();
    expect(detectOutOfScope("QUIERO SIRENAS")).toBeTruthy();
  });

  it("deja pasar lo que sí está en alcance", () => {
    expect(
      detectOutOfScope("el tablero está a 40 °C en interior, ambiente sucio"),
    ).toBeNull();
    expect(detectOutOfScope("necesito enfriar 4 gabinetes a 460 V")).toBeNull();
  });

  it("la respuesta dice qué sí puede hacer, no solo que no", () => {
    expect(RESPONSE_OUT_OF_SCOPE).toMatch(/thermal management|climatiz/i);
    expect(RESPONSE_OUT_OF_SCOPE.length).toBeGreaterThan(200);
  });
});

describe("guion de la demo", () => {
  it("abre con el fuera de alcance, según §7.8", () => {
    expect(DEMO_SCRIPT[0].result.outOfScope).toBeTruthy();
  });

  it("son tres turnos y dos ejemplos precargados", () => {
    expect(DEMO_SCRIPT).toHaveLength(3);
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(2);
    for (const e of EXAMPLES) expect(e.exampleLabel).toBeTruthy();
  });

  it("la compuerta aparece en el turno 1 y el shortlist solo en el 2", () => {
    expect(DEMO_SCRIPT[1].result.gate).toHaveLength(4);
    expect(DEMO_SCRIPT[1].result.shortlist).toBeNull();
    expect(DEMO_SCRIPT[2].result.shortlist).toBeTruthy();
  });

  it("el fallback de proveedor se ve: el turno 2 responde mistral tras caer groq", () => {
    expect(DEMO_SCRIPT[1].result.message.provider?.id).toBe("groq-1");
    const p2 = DEMO_SCRIPT[2].result.message.provider!;
    expect(p2.id).toBe("mistral-1");
    expect(p2.fell_back_from).toEqual(["groq-1", "groq-2"]);
  });

  it("las cifras que dice el copiloto son las que calcula el código", () => {
    const prose = DEMO_SCRIPT[2].result.message.text;
    // Si alguien toca el fixture y la prosa se queda vieja, esto lo caza.
    expect(prose).toContain("1 350 W");
    expect(prose).toContain("1 485 W");
    expect(prose).toContain("5 067 Btu/h");
    expect(SHORTLIST_BARRANQUILLA.total_dissipation_w).toBe(1350);
    expect(Math.round(SHORTLIST_BARRANQUILLA.required_w)).toBe(1485);
    expect(Math.round(SHORTLIST_BARRANQUILLA.required_btuh)).toBe(5067);
  });

  it("el turno de intake dice en voz alta que no convirtió los kW", () => {
    expect(DEMO_SCRIPT[1].result.message.text).toMatch(/22 kW/);
  });

  it("«lo que no afirmamos» nunca va vacío cuando hay caso", () => {
    expect(DISCLAIMERS.length).toBeGreaterThanOrEqual(4);
    expect(DEMO_SCRIPT[1].result.disclaimers.length).toBeGreaterThan(0);
    expect(DEMO_SCRIPT[2].result.disclaimers.length).toBeGreaterThan(0);
  });

  it("el fuera de alcance no toca la ficha ni gasta una llamada", () => {
    const t = DEMO_SCRIPT[0].result;
    expect(t.gate).toBeNull();
    expect(t.shortlist).toBeNull();
    expect(t.message.provider, "no hubo llamada al modelo").toBeUndefined();
    expect(countSatisfied(t.spec, BLOCKING_FIELDS)).toBe(0);
  });
});
