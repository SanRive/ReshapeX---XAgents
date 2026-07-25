/**
 * Tipos compartidos del motor de reglas determinista (Pista B · componente 2).
 *
 * Aquí no hay lógica ni datos: solo el contrato. Los datos curados viven en
 * `catalog-data.ts`, las reglas en `gate.ts` / `shortlist.ts` / `field-guide.ts`.
 *
 * Regla del proyecto (`CLAUDE.md` · Convenciones): **toda salida del motor de reglas
 * lleva `{documento, pagina, texto_citado}`. Sin cita no sale a la UI.**
 */

/* ------------------------------------------------------------------ *
 * Cita
 * ------------------------------------------------------------------ */

/**
 * Referencia trazable a un documento del corpus.
 *
 * - `documento`: ruta relativa dentro del corpus original (la misma que espeja
 *   `corpus_txt/`), con la extensión del PDF/HTML de origen.
 * - `pagina`: **número de página del PDF**, contado por saltos de página (`\f`) del
 *   texto extraído con `pdftotext -layout`. Para el catálogo NA de 12 páginas coincide
 *   con el número impreso en el pie; para el catálogo maestro hay un desfase de 1 por
 *   la portada — ahí manda el número de página del PDF, que es el reproducible.
 * - `texto_citado`: transcripción literal del corpus, con los espacios normalizados.
 */
export type Citation = {
  documento: string;
  pagina: number;
  texto_citado: string;
};

/* ------------------------------------------------------------------ *
 * Familias de tecnología (matriz del catálogo NA p.2)
 * ------------------------------------------------------------------ */

export const TECHNOLOGY_FAMILIES = [
  "filterfan_exhaust",
  "pks_air_air",
  "dts_cooling_units",
  "pws_air_water",
] as const;

export type TechnologyFamily = (typeof TECHNOLOGY_FAMILIES)[number];

/** Etiqueta de UI, textual del catálogo. */
export const FAMILY_LABEL: Readonly<Record<TechnologyFamily, string>> = {
  filterfan_exhaust: "Filterfan 4.0 & Exhaust Filters",
  pks_air_air: "PKS Air/Air Heat Exchangers",
  dts_cooling_units: "DTS Cooling Units",
  pws_air_water: "PWS Air/Water Heat Exchangers",
};

/* ------------------------------------------------------------------ *
 * Veredicto de la compuerta (B2)
 * ------------------------------------------------------------------ */

export type VerdictStatus =
  /** La matriz y las reglas del catálogo apuntan a esta familia. */
  | "recommended"
  /** Técnicamente aplicable, pero no es la opción que el catálogo señala primero. */
  | "possible"
  /** Descartada por una regla citada. El caso negativo argumentado. */
  | "rejected"
  /** No se puede decidir: falta un dato. **Nunca se convierte en rechazo automático.** */
  | "blocked";

export type TechnologyVerdict = {
  family: TechnologyFamily;
  /** Etiqueta legible, textual del catálogo. */
  familyLabel: string;
  status: VerdictStatus;
  /** Construida con plantillas deterministas. Nunca redactada por un LLM. */
  reason: string;
  /** Campos de `ProjectSpec` que hay que cerrar para levantar el bloqueo. */
  blockingFields: string[];
  citations: Citation[];
  /** Lo que hay que confirmar aunque el veredicto ya esté tomado. */
  warnings: string[];
};

/* ------------------------------------------------------------------ *
 * Catálogo de producto (B1)
 * ------------------------------------------------------------------ */

export type MountingType = "side" | "integrated" | "top";

/** Vocabulario NEMA tal como lo publica el catálogo. */
export type NemaRating = "12" | "3R" | "4" | "4X";

export type ModelDimensionsMm = {
  altoMm?: number;
  anchoMm?: number;
  profundidadMm?: number;
};

/**
 * Una fila del catálogo, a nivel de **variante**.
 *
 * El quick selection chart del catálogo maestro publica el DTS por variante
 * (Indoor Type 12 / Outdoor 3R-4 / Washdown 4-4X), cada una con su designación
 * comercial, sus voltajes y sus dimensiones. `serie` agrupa las tres: es la
 * designación que usa el catálogo NA de 12 páginas (`DTS 31X5`) y la que se muestra
 * en el shortlist.
 *
 * **No se inventan campos.** Lo que el catálogo no publica queda `undefined`, y un
 * `ratingsNema` vacío significa *rating no publicado para esta serie* — que es un
 * hecho distinto de "no cumple".
 */
export type CoolingUnitModel = {
  familia: "cooling_units";
  /** Serie del quick selection chart, p. ej. `DTS 31X5`. Agrupa variantes. */
  serie: string;
  /** Etiqueta de la variante que se muestra al usuario, p. ej. `DTS 31X5 Washdown`. */
  modelo: string;
  /** Designación comercial de la variante en el catálogo maestro, p. ej. `DTS 3185`. */
  designacionComercial?: string;
  capacidadMinBtuH: number;
  capacidadMaxBtuH: number;
  /** Voltajes normalizados al enum `SupplyVoltage` del contrato. */
  voltajes: readonly ("115V" | "230V" | "400_460V_3ph")[];
  /** Los voltajes tal como los imprime el catálogo, sin normalizar. */
  voltajesCatalogo: readonly string[];
  montaje: MountingType;
  /** Vacío = el catálogo no publica rating NEMA para esta serie. */
  ratingsNema: readonly NemaRating[];
  /** `true` solo si el catálogo documenta explícitamente una variante washdown. */
  washdown: boolean;
  materialDisponible?: readonly ("painted_steel" | "stainless_steel")[];
  dimensiones?: ModelDimensionsMm;
  cita: Citation;
  /** Cita adicional del rating/material cuando viene de otra página. */
  citaRating?: Citation;
};

/* ------------------------------------------------------------------ *
 * Shortlist (B3)
 * ------------------------------------------------------------------ */

export type CandidateStatus =
  /** Cumple con margen y es la serie más ajustada que cumple. */
  | "recommended"
  /** Cumple, pero hay algo que confirmar antes de comprometerlo. */
  | "verify"
  /** Cumple y sobra capacidad: opción de respaldo. */
  | "alternative"
  /** Descartado por una regla citada. Se muestra igual, con su razón. */
  | "rejected";

export type CoolingUnitCandidate = {
  /** Etiqueta mostrada: la variante elegida, o la serie si ninguna variante aplica. */
  model: string;
  /** Serie del catálogo. Estable para aserciones programáticas. */
  series: string;
  designacionComercial?: string;
  status: CandidateStatus;
  /** Plantilla determinista. Nunca redactada por un LLM. */
  reason: string;
  requiredCapacityW?: number;
  requiredCapacityBtuH?: number;
  capacidadMinBtuH: number;
  capacidadMaxBtuH: number;
  /** Cuánto sobra sobre lo requerido en el extremo bajo del rango, en %. */
  margenSobreRequeridoPct?: number;
  citations: Citation[];
  rejectionReasons: string[];
  verificationWarnings: string[];
};

export type CoolingUnitShortlistResult = {
  /** `PD` — disipación total declarada o **sumada** de la lista de componentes. */
  totalDissipationW?: number;
  /** Origen de `PD`. `component_sum` es suma, nunca estimación. */
  totalDissipationSource?: "declared" | "component_sum";
  requiredCapacityW?: number;
  requiredCapacityBtuH?: number;
  /** Campos de `ProjectSpec` que hay que cerrar. `total_dissipation_w` los frena todos. */
  blockingFields: string[];
  candidates: CoolingUnitCandidate[];
  citations: Citation[];
  /** Lo que el motor explícitamente **no** afirma. Va literal al brief. */
  notAsserted: string[];
};

/* ------------------------------------------------------------------ *
 * Guía de campos (B5)
 * ------------------------------------------------------------------ */

export type FieldGuideEntry = {
  field: string;
  whyItMatters: string;
  whereToFindIt: string;
  alternativeEvidence: string;
  citation: Citation;
  antiPattern: string;
};
