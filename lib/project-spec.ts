/**
 * T0.2 — EL CONTRATO ENTRE LAS CUATRO PISTAS.
 *
 * Escrito en Zod, con los tipos TS derivados por `z.infer<>`. **No crear una segunda
 * definición**: si A lo reescribe en Zod para `generateObject` habrá dos definiciones que
 * se desincronizan solas (docs/plan-de-implementacion.md, T0.2).
 *
 * Forma tomada de `docs/superpowers/specs/2026-07-24-…-design.md` §3.5 (campos, enums y
 * defaults) y de `CLAUDE.md` (el sobre `Field` de cuatro claves: status/value/evidence/basis).
 *
 * Este archivo lo creó la Pista B porque no existía todavía y el motor de reglas no
 * compila sin él. **Es el contrato mínimo necesario y respeta la forma descrita en el
 * spec**; si la persona dueña de T0.2 lo amplía (fixtures, campos de identificación
 * adicionales), que amplíe *este* archivo — no que cree otro.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ *
 * El sobre por campo (CLAUDE.md · "El validador de evidencia")
 * ------------------------------------------------------------------ */

export const FieldStatusSchema = z.enum(["declared", "inferred", "missing"]);
export type FieldStatus = z.infer<typeof FieldStatusSchema>;

/**
 * Fabrica el sobre `Field` para un tipo de valor concreto.
 *
 * - `declared`  → `evidence` es un substring LITERAL del input del cliente.
 * - `inferred`  → `basis` es una cita del catálogo de la lista blanca `DEFAULTS`.
 * - `missing`   → `value` se fuerza a `null`.
 *
 * El validador determinista (Pista A) es quien hace cumplir esas tres reglas. El motor
 * de reglas (Pista B) solo *lee* el sobre y trata `missing` como dato ausente.
 */
export function field<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    status: FieldStatusSchema,
    value: valueSchema.nullable(),
    evidence: z.string().nullable().default(null),
    basis: z.string().nullable().default(null),
  });
}

/** Sobre genérico ya resuelto, útil para firmas que no dependen del tipo del valor. */
export type Field<T> = {
  status: FieldStatus;
  value: T | null;
  evidence: string | null;
  basis: string | null;
};

/* ------------------------------------------------------------------ *
 * Enums — el vocabulario copia el del catálogo para que las citas mapeen 1:1 (§3.5)
 * ------------------------------------------------------------------ */

export const HousingMaterialSchema = z.enum(["painted_steel", "stainless_steel"]);
export type HousingMaterial = z.infer<typeof HousingMaterialSchema>;

/** PSS · Enclosure: "Supply Voltage for Air Conditioning Components". */
export const SupplyVoltageSchema = z.enum(["115V", "230V", "400_460V_3ph"]);
export type SupplyVoltage = z.infer<typeof SupplyVoltageSchema>;

/** PSS · Environment: Indoor (Type 12) · Outdoor (Type 3R/4) · Washdown (Type 4/4X). */
export const LocationSchema = z.enum(["indoor", "outdoor", "washdown"]);
export type Location = z.infer<typeof LocationSchema>;

export const InstallationSchema = z.enum(["free_standing", "wall_mounted", "recessed_in_line"]);
export type Installation = z.infer<typeof InstallationSchema>;

/** Vocabulario de la matriz de tecnología del catálogo NA p.2. */
export const AirQualitySchema = z.enum(["clean_or_slightly_dirty", "dirty", "very_harsh"]);
export type AirQuality = z.infer<typeof AirQualitySchema>;

export const ComponentSchema = z.object({
  name: z.string(),
  w: z.number(),
  qty: z.number().int().positive().default(1),
});
export type Component = z.infer<typeof ComponentSchema>;

/* ------------------------------------------------------------------ *
 * ProjectSpec (§3.5)
 * ------------------------------------------------------------------ */

export const ProjectSpecSchema = z.object({
  // A · Identificación — no bloquea nada
  project_name: field(z.string()),
  customer: field(z.string()),
  enclosure_count: field(z.number().int().positive()),

  // B · Gabinete (tab Enclosure de PSS)
  height_mm: field(z.number()),
  width_mm: field(z.number()),
  depth_mm: field(z.number()),
  internal_temp_max_c: field(z.number()),
  internal_temp_min_c: field(z.number()),
  housing_material: field(HousingMaterialSchema),
  housing_color: field(z.string()),
  supply_voltage: field(SupplyVoltageSchema),

  // C · Entorno (tab Environment de PSS)
  location: field(LocationSchema),
  ambient_temp_max_c: field(z.number()),
  ambient_temp_min_c: field(z.number()),
  solar_load: field(z.boolean()),
  wind_exposure: field(z.boolean()),
  installation: field(InstallationSchema),
  air_quality: field(AirQualitySchema),

  /**
   * Extensión de la Pista B sobre §3.5. El spec pide en §5 que PWS quede como
   * alternativa "requiere agua de proceso, no declarada"; sin un campo para ese dato la
   * compuerta no puede distinguir "no hay agua" de "no lo sabemos". Respaldado por el
   * catálogo NA p.9: "If there is a chilled water supply readily available at the enclosure."
   */
  process_water_available: field(z.boolean()),

  // D · Carga térmica (tab Heat Dissipation de PSS)
  /** Bloqueante duro del shortlist. **Nunca se estima.** */
  total_dissipation_w: field(z.number()),
  /** Camino alterno: se **suma**. Suma, no estimación. */
  component_list: field(z.array(ComponentSchema)),
  /** Se detecta y se deriva a PSS. El cálculo NO se implementa. */
  measured_temps: field(z.object({ inside_c: z.number(), outside_c: z.number() })),
});

export type ProjectSpec = z.infer<typeof ProjectSpecSchema>;
export type ProjectSpecFieldName = keyof ProjectSpec;

/* ------------------------------------------------------------------ *
 * Lectura del sobre — helpers puros usados por el motor de reglas
 * ------------------------------------------------------------------ */

/** Devuelve el valor del sobre, o `undefined` si el campo está `missing` o vacío. */
export function valueOf<T>(f: Field<T> | undefined): T | undefined {
  if (f === undefined) return undefined;
  if (f.status === "missing") return undefined;
  if (f.value === null) return undefined;
  return f.value;
}

/** Sobre vacío. Es el estado por defecto de todo campo antes de la primera extracción. */
export function missingField<T>(): Field<T> {
  return { status: "missing", value: null, evidence: null, basis: null };
}

/** Sobre declarado por el cliente, con el fragmento textual que lo respalda. */
export function declaredField<T>(value: T, evidence: string): Field<T> {
  return { status: "declared", value, evidence, basis: null };
}

/** Sobre inferido, con la cita de catálogo que justifica el default. */
export function inferredField<T>(value: T, basis: string): Field<T> {
  return { status: "inferred", value, basis, evidence: null };
}

/**
 * `ProjectSpec` con todos los sobres vacíos. Punto de partida de la conversación y base
 * para construir specs parciales en los tests sin repetir 22 campos.
 */
export function emptyProjectSpec(): ProjectSpec {
  return {
    project_name: missingField<string>(),
    customer: missingField<string>(),
    enclosure_count: missingField<number>(),
    height_mm: missingField<number>(),
    width_mm: missingField<number>(),
    depth_mm: missingField<number>(),
    internal_temp_max_c: missingField<number>(),
    internal_temp_min_c: missingField<number>(),
    housing_material: missingField<HousingMaterial>(),
    housing_color: missingField<string>(),
    supply_voltage: missingField<SupplyVoltage>(),
    location: missingField<Location>(),
    ambient_temp_max_c: missingField<number>(),
    ambient_temp_min_c: missingField<number>(),
    solar_load: missingField<boolean>(),
    wind_exposure: missingField<boolean>(),
    installation: missingField<Installation>(),
    air_quality: missingField<AirQuality>(),
    process_water_available: missingField<boolean>(),
    total_dissipation_w: missingField<number>(),
    component_list: missingField<Component[]>(),
    measured_temps: missingField<{ inside_c: number; outside_c: number }>(),
  };
}

/**
 * Vista plana del spec: cada campo colapsado a su valor o `undefined`.
 * El motor de reglas trabaja sobre esto — así la lógica no repite `valueOf(...)` 20 veces
 * y "campo ausente" es una única condición (`=== undefined`) en todo el módulo.
 */
export type ResolvedSpec = {
  [K in ProjectSpecFieldName]: NonNullable<ProjectSpec[K]["value"]> | undefined;
};

export function resolveSpec(spec: ProjectSpec): ResolvedSpec {
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(spec) as ProjectSpecFieldName[]) {
    out[key] = valueOf(spec[key] as Field<unknown>);
  }
  return out as ResolvedSpec;
}
