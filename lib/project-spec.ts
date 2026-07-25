/**
 * T0.2 — EL CONTRATO.
 *
 * Fuente unica de verdad de la forma del objeto que comparten las cuatro pistas.
 * Se escribe en Zod y los tipos TS salen de `z.infer<>`. No duplicar esto como
 * `interface` en ningun otro archivo: `generateObject` consume el schema Zod
 * directamente y el validador de sobres (A4) corre sobre el objeto ya tipado.
 *
 * Referencia: spec §3.5 (contrato de datos) y §3.6 (los dos umbrales).
 */

import { z } from "zod";

/* ==========================================================================
   Cita — nada sale a la UI sin ella
   ========================================================================== */

export const CitationSchema = z.object({
  documento: z.string(),
  pagina: z.string(),
  texto_citado: z.string(),
});

export type Citation = z.infer<typeof CitationSchema>;

/* ==========================================================================
   Field — el sobre por campo
   --------------------------------------------------------------------------
   El validador determinista (A4) es quien decide el `status` final:
     declared -> `evidence` debe ser substring literal del input, normalizando
                 espacios y mayusculas. Si no lo es, degrada a missing.
     numerico -> los digitos de `value` deben aparecer en `evidence`. Aqui es
                 donde muere el "22 kW -> 22000 W".
     inferred -> `basis` debe coincidir con una entrada de la lista blanca
                 DEFAULTS. Si no, degrada a missing.
     missing  -> `value` se fuerza a null.
   ========================================================================== */

export const FieldStatusSchema = z.enum(["declared", "inferred", "missing"]);
export type FieldStatus = z.infer<typeof FieldStatusSchema>;

export const FieldSchema = z.object({
  status: FieldStatusSchema,
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]),
  /** Substring LITERAL del input. Solo cuando status = declared. */
  evidence: z.string().nullable(),
  /** Cita del catalogo que respalda el default. Solo cuando status = inferred. */
  basis: CitationSchema.nullable(),
  /** Que decision queda trabada si falta. Solo cuando status = missing. */
  blocks: z.string().nullable().optional(),
});

export type Field = z.infer<typeof FieldSchema>;

const field = () => FieldSchema;

/* ==========================================================================
   Enums — el vocabulario copia al del catalogo para que las citas mapeen 1:1
   ========================================================================== */

export const LocationSchema = z.enum(["indoor", "outdoor", "washdown"]);
export const AirQualitySchema = z.enum([
  "clean_or_slightly_dirty",
  "dirty",
  "very_harsh",
]);
export const InstallationSchema = z.enum([
  "free_standing",
  "wall_mounted",
  "recessed_in_line",
]);
export const HousingMaterialSchema = z.enum(["painted_steel", "stainless_steel"]);
export const SupplyVoltageSchema = z.enum(["115V", "230V", "400_460V_3ph"]);
export const NemaTypeSchema = z.enum(["12", "3R_4", "4_4X"]);

export type Location = z.infer<typeof LocationSchema>;
export type AirQuality = z.infer<typeof AirQualitySchema>;
export type Installation = z.infer<typeof InstallationSchema>;
export type SupplyVoltage = z.infer<typeof SupplyVoltageSchema>;
export type NemaType = z.infer<typeof NemaTypeSchema>;

/* ==========================================================================
   ProjectSpec
   ========================================================================== */

export const ComponentEntrySchema = z.object({
  name: z.string(),
  w: z.number(),
  qty: z.number().int().positive(),
});

export type ComponentEntry = z.infer<typeof ComponentEntrySchema>;

export const ProjectSpecSchema = z.object({
  /* A · Identificacion — no bloquea nada */
  project_name: field(),
  customer: field(),
  enclosure_count: field(),

  /* B · Gabinete (tab Enclosure de PSS) */
  height_mm: field(),
  width_mm: field(),
  depth_mm: field(),
  internal_temp_max_c: field(),
  internal_temp_min_c: field(),
  housing_material: field(),
  housing_color: field(),
  supply_voltage: field(),

  /* C · Entorno (tab Environment de PSS) */
  location: field(),
  ambient_temp_max_c: field(),
  ambient_temp_min_c: field(),
  solar_load: field(),
  wind_exposure: field(),
  installation: field(),
  air_quality: field(),

  /* D · Carga termica (tab Heat Dissipation de PSS) — los tres caminos */
  total_dissipation_w: field(),
  component_list: z.array(ComponentEntrySchema).nullable(),
  measured_temp_inside_c: field(),
  measured_temp_outside_c: field(),
});

export type ProjectSpec = z.infer<typeof ProjectSpecSchema>;
export type ProjectSpecKey = keyof ProjectSpec;

/* ==========================================================================
   Los dos umbrales (§3.6)
   --------------------------------------------------------------------------
   La compuerta corre antes y con menos datos que el shortlist. Ese orden es la
   afirmacion central del producto y la UI lo dibuja tal cual.
   ========================================================================== */

/** Umbral 1 · abre la compuerta de 4 familias. `internal_temp_max_c` ya tiene default citado. */
export const GATE_FIELDS = [
  "ambient_temp_max_c",
  "location",
  "air_quality",
] as const satisfies readonly ProjectSpecKey[];

/** Umbral 2 · abre el shortlist de modelos. Los 3 anteriores mas estos. */
export const SHORTLIST_FIELDS = [
  "total_dissipation_w",
  "supply_voltage",
  "height_mm",
  "width_mm",
  "depth_mm",
] as const satisfies readonly ProjectSpecKey[];

/** Los 8 campos bloqueantes, en el orden en que la ficha los pinta. */
export const BLOCKING_FIELDS = [
  ...GATE_FIELDS,
  ...SHORTLIST_FIELDS,
] as const satisfies readonly ProjectSpecKey[];

/** Etiqueta legible por campo. La ficha muestra el nombre tecnico ademas, porque
 *  es el que el ingeniero va a buscar en PSS. */
export const FIELD_LABELS: Record<string, string> = {
  project_name: "Proyecto",
  customer: "Cliente",
  enclosure_count: "Gabinetes",
  height_mm: "Alto",
  width_mm: "Ancho",
  depth_mm: "Fondo",
  internal_temp_max_c: "Temp. interna objetivo",
  internal_temp_min_c: "Temp. interna mínima",
  housing_material: "Material del gabinete",
  housing_color: "Color",
  supply_voltage: "Tensión de alimentación",
  location: "Ubicación",
  ambient_temp_max_c: "Temp. ambiente máxima",
  ambient_temp_min_c: "Temp. ambiente mínima",
  solar_load: "Carga solar",
  wind_exposure: "Exposición al viento",
  installation: "Instalación",
  air_quality: "Calidad del aire",
  total_dissipation_w: "Disipación total",
  measured_temp_inside_c: "Temp. medida interior",
  measured_temp_outside_c: "Temp. medida exterior",
};

/** Unidad por campo, para pintar el valor sin que el LLM la invente. */
export const FIELD_UNITS: Record<string, string> = {
  height_mm: "mm",
  width_mm: "mm",
  depth_mm: "mm",
  internal_temp_max_c: "°C",
  internal_temp_min_c: "°C",
  ambient_temp_max_c: "°C",
  ambient_temp_min_c: "°C",
  total_dissipation_w: "W",
  measured_temp_inside_c: "°C",
  measured_temp_outside_c: "°C",
};

/* ==========================================================================
   Derivados — conversion de unidades, no ingenieria
   ========================================================================== */

/** Margen documentado en DTS_2017: la capacidad debe exceder la disipacion ~10%. */
export const MARGIN_FACTOR = 1.1;
export const BTU_PER_W = 3.412;

export const MARGIN_CITATION: Citation = {
  documento: "DTS_2017",
  pagina: "sizing",
  texto_citado:
    "The refrigeration capacity should exceed the dissipation loss from the installed components by approximately 10%.",
};

export const DIN_RATING_CITATION: Citation = {
  documento: "DTS_2017",
  pagina: "rating basis",
  texto_citado:
    "Pfannenberg utilizes the DIN standard 35/35 °C when rating our cooling units. Many other companies use 50/50 °C, which provides a higher, non-usable value.",
};

export function requiredWatts(totalDissipationW: number): number {
  return totalDissipationW * MARGIN_FACTOR;
}

export function wattsToBtuh(w: number): number {
  return w * BTU_PER_W;
}

/** Mapeo location -> NEMA, citado del tutorial de PSS (tab Environment). */
export const NEMA_BY_LOCATION: Record<Location, NemaType> = {
  indoor: "12",
  outdoor: "3R_4",
  washdown: "4_4X",
};

export const NEMA_LABELS: Record<NemaType, string> = {
  "12": "NEMA Type 12",
  "3R_4": "NEMA Type 3R/4",
  "4_4X": "NEMA Type 4/4X",
};

/* ==========================================================================
   Helpers de lectura — los usa la UI, no deciden nada
   ========================================================================== */

export function isSatisfied(f: Field | undefined): boolean {
  return !!f && f.status !== "missing" && f.value !== null;
}

export function gateReady(spec: ProjectSpec): boolean {
  return GATE_FIELDS.every((k) => isSatisfied(spec[k] as Field));
}

export function shortlistReady(spec: ProjectSpec): boolean {
  return (
    gateReady(spec) && SHORTLIST_FIELDS.every((k) => isSatisfied(spec[k] as Field))
  );
}

export function countSatisfied(
  spec: ProjectSpec,
  keys: readonly ProjectSpecKey[],
): number {
  return keys.filter((k) => isSatisfied(spec[k] as Field)).length;
}

/** Sobre vacio. Sirve de base para los fixtures y para el estado inicial. */
export function emptyField(blocks?: string): Field {
  return {
    status: "missing",
    value: null,
    evidence: null,
    basis: null,
    blocks: blocks ?? null,
  };
}
