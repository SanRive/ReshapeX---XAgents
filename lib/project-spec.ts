/**
 * EL CONTRATO — tarea T0.2 del plan de implementación.
 *
 * Es la frontera entre las cuatro pistas. Si A y D no coinciden en la forma
 * de este objeto, se pierde media hora en el merge.
 *
 * Escrito en Zod y NO como `interface`: el mismo schema alimenta a
 * `generateObject` del AI SDK y produce los tipos TS por `z.infer<>`. Una sola
 * definición, imposible que se desincronice.
 *
 * Referencia: spec §3.5 (contrato de datos) y §7 (agente conversacional).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// El sobre por campo — el corazón del diseño
// ---------------------------------------------------------------------------

export const FieldStatus = z.enum(["declared", "inferred", "missing"]);
export type FieldStatus = z.infer<typeof FieldStatus>;

/**
 * Construye el sobre de un campo con su tipo de valor concreto.
 *
 * Reglas que el validador determinista impone DESPUÉS de la llamada al LLM
 * (ver `lib/extract/validate.ts`). El modelo no las cumple por buena fe:
 *
 *   declared → `evidence` tiene que ser substring LITERAL del input,
 *              normalizando espacios y mayúsculas. Si no → missing.
 *   numérico → los dígitos de `value` tienen que aparecer en `evidence`.
 *              Esto es lo que caza el «38 °C → 380».
 *   inferred → `basis` tiene que coincidir con una entrada de DEFAULTS.
 *              Si no → missing.
 *   missing  → `value` se fuerza a null.
 */
export function field<T extends z.ZodTypeAny>(value: T) {
  return z.object({
    status: FieldStatus,
    value: value.nullable(),
    /** Substring literal del input. Solo si status === "declared". */
    evidence: z.string().nullable(),
    /** Clave de DEFAULTS que justifica el valor. Solo si status === "inferred". */
    basis: z.string().nullable(),
  });
}

/** Sobre genérico, para código que opera sobre cualquier campo sin importar el tipo. */
export type AnyField = {
  status: FieldStatus;
  value: string | number | boolean | null;
  evidence: string | null;
  basis: string | null;
};

// ---------------------------------------------------------------------------
// Vocabulario — copia el del catálogo para que las citas mapeen 1:1
// ---------------------------------------------------------------------------

export const Location = z.enum(["indoor", "outdoor", "washdown"]);
export const AirQuality = z.enum(["clean_or_slightly_dirty", "dirty", "very_harsh"]);
export const HousingMaterial = z.enum(["painted_steel", "stainless_steel"]);
export const SupplyVoltage = z.enum(["115V", "230V", "400_460V_3ph"]);
export const Installation = z.enum(["free_standing", "wall_mounted", "recessed_in_line"]);
export const NemaType = z.enum(["12", "3R_4", "4_4X"]);

export type Location = z.infer<typeof Location>;
export type AirQuality = z.infer<typeof AirQuality>;
export type HousingMaterial = z.infer<typeof HousingMaterial>;
export type SupplyVoltage = z.infer<typeof SupplyVoltage>;
export type Installation = z.infer<typeof Installation>;
export type NemaType = z.infer<typeof NemaType>;

// ---------------------------------------------------------------------------
// Lista blanca de defaults — `basis` DEBE ser una de estas claves
// ---------------------------------------------------------------------------

/**
 * Un `inferred` cuyo `basis` no esté aquí se degrada a `missing`.
 * Esto es lo que impide que el modelo invente una justificación creíble.
 *
 * ✅ Verificado contra el corpus el 2026-07-25. Toda cita de esta tabla se
 * comprobó con grep sobre `corpus_txt/`. No añadir una entrada sin hacerlo.
 */
export const DEFAULTS = {
  internal_temp_max_c: {
    value: 35.0,
    /**
     * Re-anclado el 2026-07-25. La cita anterior era del catálogo NA
     * ("most efficient ... around 95°") y hablaba del punto ÓPTIMO de
     * eficiencia, no de un máximo — un juez lo tumbaba con una pregunta.
     * PSS llama a 95 °F la temperatura máxima admisible, y 95 °F = 35 °C
     * exactos. Citar a PSS es más fuerte: es la herramienta que alimentamos.
     */
    cita: 'PSS Tutorial, Results — "the ambient temperature selected (100°F) is higher than the maximum allowable temperature inside the enclosure (95°F)" → 95 °F = 35 °C',
  },
  housing_material: {
    value: "painted_steel" as HousingMaterial,
    cita: "Catálogo NA — acabado estándar de la serie DTS (RAL 7035)",
  },
  housing_color: {
    value: "RAL 7035",
    cita: "Catálogo NA p.7 — acabados disponibles: RAL 7035, ANSI 61, inoxidable",
  },
  enclosure_count: {
    value: 1,
    cita: "Alcance del MVP: un gabinete por análisis (spec §3.4)",
  },
} as const;

export type DefaultKey = keyof typeof DEFAULTS;

// ---------------------------------------------------------------------------
// Lo que el LLM puede rellenar — y nada más
// ---------------------------------------------------------------------------

/**
 * El modelo SOLO devuelve esto. Los derivados los calcula código puro, y por
 * eso no aparecen aquí: si el modelo no puede escribirlos, no puede inventarlos.
 */
export const ExtractedSpecSchema = z.object({
  // A · Identificación — no bloquea nada
  project_name: field(z.string()),
  customer: field(z.string()),

  // B · Gabinete — tab Enclosure de PSS
  height_mm: field(z.number()),
  width_mm: field(z.number()),
  depth_mm: field(z.number()),
  internal_temp_max_c: field(z.number()),
  internal_temp_min_c: field(z.number()),
  housing_material: field(HousingMaterial),
  housing_color: field(z.string()),
  supply_voltage: field(SupplyVoltage),

  // C · Entorno — tab Environment de PSS
  location: field(Location),
  ambient_temp_max_c: field(z.number()),
  ambient_temp_min_c: field(z.number()),
  solar_load: field(z.boolean()),
  wind_exposure: field(z.boolean()),
  installation: field(Installation),
  air_quality: field(AirQuality),

  // D · Carga térmica — tab Heat Dissipation de PSS
  /** BLOQUEANTE DURO del shortlist. NUNCA se estima. Ver regla 1. */
  total_dissipation_w: field(z.number()),
  /** Camino alterno: si dan lista de componentes con W, se SUMAN. Suma, no estimación. */
  component_list: z
    .array(z.object({ name: z.string(), w: z.number(), qty: z.number() }))
    .nullable(),
  /** Tercer camino de PSS. Se DETECTA y se deriva a PSS; no se implementa el cálculo. */
  measured_temps: z
    .object({ inside_c: z.number(), outside_c: z.number() })
    .nullable(),

  /** Cuántos gabinetes iguales. Fuera del alcance analizar más de uno, pero se cita. */
  enclosure_count: field(z.number()),
});

export type ExtractedSpec = z.infer<typeof ExtractedSpecSchema>;

/** Las claves de los campos que son sobres (excluye component_list y measured_temps). */
export const FIELD_KEYS = [
  "project_name", "customer",
  "height_mm", "width_mm", "depth_mm",
  "internal_temp_max_c", "internal_temp_min_c",
  "housing_material", "housing_color", "supply_voltage",
  "location", "ambient_temp_max_c", "ambient_temp_min_c",
  "solar_load", "wind_exposure", "installation", "air_quality",
  "total_dissipation_w", "enclosure_count",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

/** Campos numéricos: sobre estos corre la regla de «los dígitos en la evidencia». */
export const NUMERIC_FIELD_KEYS: readonly FieldKey[] = [
  "height_mm", "width_mm", "depth_mm",
  "internal_temp_max_c", "internal_temp_min_c",
  "ambient_temp_max_c", "ambient_temp_min_c",
  "total_dissipation_w", "enclosure_count",
];

// ---------------------------------------------------------------------------
// Derivados — los calcula código, nunca el modelo
// ---------------------------------------------------------------------------

export const DerivedSchema = z.object({
  /** Conversión de unidades, no ingeniería: W × 3.412 */
  required_capacity_btuh: z.number().nullable(),
  /** Margen documentado: PD × 1.10 — DTS_2017, "should exceed ... by approximately 10%" */
  required_w: z.number().nullable(),
  /** location → NEMA. PSS Tutorial: Indoor→12 · Outdoor→3R/4 · Washdown→4/4X */
  nema_required: NemaType.nullable(),
  /** installation → caras libres para montar la unidad */
  available_mounting_faces: z.number().nullable(),
});

export type Derived = z.infer<typeof DerivedSchema>;

// ---------------------------------------------------------------------------
// El objeto completo que viaja entre capas
// ---------------------------------------------------------------------------

export const ProjectSpecSchema = ExtractedSpecSchema.extend({
  derived: DerivedSchema,
  /**
   * Log de decisiones del validador. Cada vez que degrada un campo escribe aquí.
   * Va al brief: es la prueba en papel de que el guardrail actuó.
   */
  decision_log: z.array(
    z.object({
      field: z.string(),
      action: z.enum(["degraded", "defaulted", "summed", "accepted"]),
      reason: z.string(),
      proposed: z.string().nullable(),
    }),
  ),
});

export type ProjectSpec = z.infer<typeof ProjectSpecSchema>;

// ---------------------------------------------------------------------------
// Umbrales — spec §3.6
// ---------------------------------------------------------------------------

/**
 * Umbral 1 · correr la compuerta de 4 familias.
 * Con esto el agente ya entrega valor sin conocer la carga térmica:
 * «necesitas lazo cerrado y esta es la razón física».
 */
export const GATE_REQUIRED: readonly FieldKey[] = [
  "ambient_temp_max_c",
  "location",
  "air_quality",
];

/** Umbral 2 · shortlist de modelos. Los 3 de arriba más estos. */
export const SHORTLIST_REQUIRED: readonly FieldKey[] = [
  "total_dissipation_w",
  "supply_voltage",
  "height_mm",
  "width_mm",
  "depth_mm",
];

/** Un campo cuenta como resuelto si está declarado o inferido con base válida. */
export function isResolved(f: AnyField | undefined): boolean {
  return !!f && f.status !== "missing" && f.value !== null;
}

/** Qué falta para poder correr la compuerta. Array vacío = se puede correr. */
export function missingForGate(spec: ExtractedSpec): FieldKey[] {
  return GATE_REQUIRED.filter((k) => !isResolved(spec[k] as AnyField));
}

/**
 * Qué falta para poder emitir el shortlist. Array vacío = se puede emitir.
 *
 * `housing_material` solo bloquea **si el entorno es washdown** (spec §3.6):
 * en indoor el material es cosmético, en washdown decide si el modelo existe
 * en inoxidable y por tanto si es elegible.
 */
export function missingForShortlist(spec: ExtractedSpec): FieldKey[] {
  const required: FieldKey[] = [...GATE_REQUIRED, ...SHORTLIST_REQUIRED];

  if (spec.location.status !== "missing" && spec.location.value === "washdown") {
    required.push("housing_material");
  }

  return required.filter((k) => !isResolved(spec[k] as AnyField));
}

// ---------------------------------------------------------------------------
// Constructor de un spec vacío
// ---------------------------------------------------------------------------

const emptyField = (): AnyField => ({
  status: "missing",
  value: null,
  evidence: null,
  basis: null,
});

/** Spec en blanco: todo `missing`. Es el estado inicial de una conversación. */
export function emptySpec(): ProjectSpec {
  const base = Object.fromEntries(
    FIELD_KEYS.map((k) => [k, emptyField()]),
  ) as unknown as ExtractedSpec;

  return {
    ...base,
    component_list: null,
    measured_temps: null,
    derived: {
      required_capacity_btuh: null,
      required_w: null,
      nema_required: null,
      available_mounting_faces: null,
    },
    decision_log: [],
  };
}
