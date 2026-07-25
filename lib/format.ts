/**
 * Presentacion de valores. Traduce el vocabulario del catalogo —que va en
 * ingles porque asi mapean las citas 1:1— a lo que lee el cliente en pantalla.
 * Ninguna funcion de aqui calcula nada.
 */

import { FIELD_UNITS, type Field } from "./project-spec";

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

/** Separador de millar fino, como en una hoja de datos: 5 067, no 5,067. */
export function num(value: number, decimals = 0): string {
  return value
    .toLocaleString("es-CO", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    .replace(/\./g, " ")
    .replace(/,/g, ".");
}

export function formatFieldValue(key: string, field: Field): string {
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

/** Los tres estados y los tres veredictos comparten escala de color, y eso es
 *  deliberado: significan lo mismo — confirmado, con reserva, fuera. */
export const VERDICT_CHIP = {
  viable: "chip-declared",
  conditional: "chip-inferred",
  rejected: "chip-missing",
} as const;

export const STATUS_CHIP = {
  declared: "chip-declared",
  inferred: "chip-inferred",
  missing: "chip-missing",
} as const;
