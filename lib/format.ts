/**
 * Presentación — pista D.
 *
 * Traduce el vocabulario del contrato, que va en inglés porque así las citas
 * mapean 1:1 con el catálogo, a lo que lee el cliente en pantalla. Ninguna
 * función de aquí calcula ni decide nada.
 */

import {
  DEFAULTS,
  GATE_REQUIRED,
  SHORTLIST_REQUIRED,
  type AnyField,
  type DefaultKey,
  type ExtractedSpec,
  type FieldKey,
} from "./project-spec";

/* ==========================================================================
   Etiquetas
   ========================================================================== */

/** La ficha muestra también el nombre técnico: es el que el ingeniero va a
 *  buscar en PSS. */
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
};

export const FIELD_UNITS: Record<string, string> = {
  height_mm: "mm",
  width_mm: "mm",
  depth_mm: "mm",
  internal_temp_max_c: "°C",
  internal_temp_min_c: "°C",
  ambient_temp_max_c: "°C",
  ambient_temp_min_c: "°C",
  total_dissipation_w: "W",
};

const ENUM_LABELS: Record<string, string> = {
  indoor: "Interior",
  outdoor: "Exterior",
  washdown: "Zona de lavado",
  clean_or_slightly_dirty: "Limpio o poco sucio",
  dirty: "Sucio",
  very_harsh: "Muy hostil, sucio",
  free_standing: "Exento",
  wall_mounted: "Contra pared",
  recessed_in_line: "Empotrado en línea",
  painted_steel: "Acero pintado",
  stainless_steel: "Acero inoxidable",
  "115V": "115 V",
  "230V": "230 V",
  "400_460V_3ph": "400-460 V 3~",
};

export const NEMA_LABELS: Record<string, string> = {
  "12": "NEMA Type 12",
  "3R_4": "NEMA Type 3R/4",
  "4_4X": "NEMA Type 4/4X",
};

/* ==========================================================================
   Valores
   ========================================================================== */

/** Separador de millar fino, como en una hoja de datos: 5 067, no 5,067. */
export function num(value: number, decimals = 0): string {
  return value
    .toLocaleString("es-CO", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    .replace(/\./g, " ")
    .replace(/,/g, ".");
}

export function formatFieldValue(key: string, field: AnyField): string {
  if (field.value === null || field.value === undefined) return "—";
  if (typeof field.value === "boolean") return field.value ? "Sí" : "No";
  if (typeof field.value === "number") {
    const unit = FIELD_UNITS[key];
    return unit ? `${num(field.value)} ${unit}` : num(field.value);
  }
  return ENUM_LABELS[field.value] ?? field.value;
}

export function enumLabel(value: string): string {
  return ENUM_LABELS[value] ?? value;
}

/* ==========================================================================
   El respaldo de un campo
   --------------------------------------------------------------------------
   Tres naturalezas distintas y por eso tres tratamientos distintos:
     declared → el fragmento literal del mensaje
     inferred → `basis` es una CLAVE de DEFAULTS; el texto sale de ahí, no del
                modelo. Si la clave no existe, no se pinta nada: eso es
                exactamente un campo que el validador tenía que haber degradado.
     missing  → qué decisión queda trabada, derivado de los umbrales
   ========================================================================== */

export function basisCitation(field: AnyField): string | null {
  if (field.status !== "inferred" || !field.basis) return null;
  const entry = DEFAULTS[field.basis as DefaultKey];
  return entry ? entry.cita : null;
}

const BLOCKS_TEXT: Partial<Record<FieldKey, string>> = {
  ambient_temp_max_c: "Compuerta de tecnología. Sin el ambiente no hay veredicto.",
  location: "Compuerta y rating NEMA.",
  air_quality: "Compuerta de tecnología.",
  total_dissipation_w:
    "Shortlist. Nunca se estima: 22 kW es potencia nominal del motor, no la pérdida del variador.",
  supply_voltage:
    "Shortlist. El rango de capacidad varía por voltaje y configuración.",
  height_mm: "Shortlist: verificación mecánica.",
  width_mm: "Shortlist: verificación mecánica.",
  depth_mm: "Shortlist: verificación mecánica.",
  housing_material:
    "Shortlist. En zona de lavado el material decide si el modelo aplica.",
};

/**
 * Qué traba este campo, o null si no traba nada.
 *
 * `housing_material` solo traba **si el entorno es washdown** — en indoor es
 * cosmético. Esa condición vive en el contrato (`missingForShortlist`) y aquí
 * se replica solo para decidir el color, no la lógica.
 */
export function blocksText(key: string, spec: ExtractedSpec): string | null {
  if (key === "housing_material") {
    return washdownApplies(spec) ? BLOCKS_TEXT.housing_material! : null;
  }
  return BLOCKS_TEXT[key as FieldKey] ?? null;
}

/** Un `missing` que no traba nada es un hueco, no una alarma. */
export function isBlank(field: AnyField, key: string, spec: ExtractedSpec): boolean {
  return field.status === "missing" && !blocksText(key, spec);
}

/** ¿El entorno declarado convierte el material en un dato bloqueante? */
export function washdownApplies(spec: ExtractedSpec): boolean {
  return spec.location.status !== "missing" && spec.location.value === "washdown";
}

/**
 * Los campos del umbral 2 AHORA MISMO.
 *
 * Son cinco fijos más `housing_material` cuando el entorno es washdown. La
 * condición vive en `missingForShortlist` del contrato; aquí se replica solo
 * para saber cuántas pastillas dibujar, y por eso la lista es dinámica: contar
 * siempre cinco haría que el medidor mintiera en cuanto entra la zona de lavado.
 */
export function shortlistFields(spec: ExtractedSpec): FieldKey[] {
  return washdownApplies(spec)
    ? [...SHORTLIST_REQUIRED, "housing_material"]
    : [...SHORTLIST_REQUIRED];
}

/** Todos los campos que bloquean algo, en el orden en que la ficha los pinta. */
export function blockingFields(spec: ExtractedSpec): FieldKey[] {
  return [...GATE_REQUIRED, ...shortlistFields(spec)];
}

/* ==========================================================================
   Vocabulario de estado — glifo y palabra, nunca color a secas
   ========================================================================== */

/**
 * El valor y su unidad, por separado.
 *
 * En una ficha técnica la cifra manda y la unidad acompaña. Separarlas deja
 * componer la columna con el número grande y el `°C` un escalón por debajo, que
 * es como se lee una hoja de datos y no como se lee un formulario.
 */
export function splitFieldValue(
  key: string,
  field: AnyField,
): { value: string; unit: string | null } {
  if (field.value === null || field.value === undefined) {
    return { value: "—", unit: null };
  }
  if (typeof field.value === "number") {
    return { value: num(field.value), unit: FIELD_UNITS[key] ?? null };
  }
  return { value: formatFieldValue(key, field), unit: null };
}

export const STATUS_GLYPH = {
  declared: "✓",
  inferred: "~",
  missing: "×",
} as const;

export const STATUS_WORD = {
  declared: "declarado",
  inferred: "inferido",
  missing: "falta",
} as const;

export const STATUS_CHIP = {
  declared: "chip-declared",
  inferred: "chip-inferred",
  missing: "chip-missing",
} as const;

/** Los tres estados y los tres veredictos comparten escala de color, y eso es
 *  deliberado: significan lo mismo — confirmado, con reserva, fuera. */
export const VERDICT_GLYPH = {
  viable: "✓",
  conditional: "~",
  rejected: "×",
} as const;

export const VERDICT_WORD = {
  viable: "viable",
  conditional: "verificar",
  rejected: "descartado",
} as const;

export const VERDICT_CHIP = {
  viable: "chip-declared",
  conditional: "chip-inferred",
  rejected: "chip-missing",
} as const;

export const ACTION_LABEL = {
  degraded: "degradado",
  defaulted: "default",
  summed: "sumado",
  accepted: "aceptado",
} as const;

export const ACTION_CHIP = {
  degraded: "chip-missing",
  defaulted: "chip-inferred",
  summed: "chip-water",
  accepted: "chip-neutral",
} as const;
