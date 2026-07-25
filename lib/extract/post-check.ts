/**
 * POST-CHECK NUMÉRICO SOBRE LA PROSA — tarea A6.
 *
 * El validador de sobres protege el `ProjectSpec`. Este protege lo que el
 * modelo *escribe*, que es la superficie que abrió el chat.
 *
 * El fallo que existe para impedir:
 *   «Un variador de 22 kW típicamente disipa un 3%, así que unos 660 W.»
 * Fluido, plausible, y jamás toca el validador de sobres porque es prosa.
 *
 * QUÉ SE PERSIGUE Y QUÉ NO
 * ------------------------
 * Solo cantidades de ingeniería, o sea número CON unidad. Un «4» suelto en
 * «hay 4 familias de tecnología» es prosa y no se toca — perseguirlo daría
 * falsos positivos en cada turno y el guardrail acabaría desactivado, que es
 * la peor forma de fallar.
 *
 * Referencia: spec §7.2 (capa 3).
 */

import type { ProjectSpec } from "../project-spec";

// ---------------------------------------------------------------------------
// Unidades que convierten un número en una afirmación técnica
// ---------------------------------------------------------------------------

const UNITS = [
  "btu/h", "btuh", "btu",
  "kw", "w",
  "°c", "ºc", "°f", "ºf",
  "kwh",
  "v", "a",
  "mm", "cm", "m³/h", "m3/h", "cfm",
  "%",
] as const;

/**
 * Patrón de número. La primera alternativa exige AL MENOS un grupo de miles
 * (`+`, no `*`): con `*` el `\d{1,3}` partía «5000» en «500» + «0».
 * El espacio no cuenta como separador de miles: en «5000 – 7000» se comería
 * el guion y uniría dos cifras distintas.
 */
const NUMBER_SRC = String.raw`\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;

/** Regex de número + unidad. Acepta separadores es/en: 1.350 · 1,350 · 35,5 · 35.5 */
const QUANTITY_RE = new RegExp(
  `(${NUMBER_SRC})\\s*(${UNITS.map((u) =>
    u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|")})(?![a-z])`,
  "gi",
);

/**
 * Constantes documentadas que el agente puede citar sin que estén en el spec.
 * Cada una tiene su fuente en el catálogo; no son números libres.
 */
export const DOCUMENTED_CONSTANTS: ReadonlyArray<{ value: number; fuente: string }> = [
  { value: 10, fuente: 'DTS_2017 — margen: "should exceed ... by approximately 10%"' },
  { value: 1.1, fuente: "DTS_2017 — el mismo margen expresado como factor" },
  { value: 3.412, fuente: "Conversión de unidades W → Btu/h" },
  { value: 35, fuente: "DTS_2017 — base de rating DIN 35/35 °C · y default interno cat. NA p.2" },
];

// ---------------------------------------------------------------------------
// Canonicalización de números
// ---------------------------------------------------------------------------

/**
 * Un «1.350» puede ser 1350 (español) o 1.35 (inglés). No se puede resolver la
 * ambigüedad sin saber la locale del que escribe, así que se admiten AMBAS
 * lecturas. Es permisivo en la dirección correcta: evita bloquear una cifra
 * legítima, y sigue cazando un 660 que no existe en ninguna fuente.
 */
export function parseNumberForms(raw: string): number[] {
  const s = raw.replace(/\s/g, "");
  const forms = new Set<number>();

  const asEnglish = Number(s.replace(/,/g, ""));
  if (Number.isFinite(asEnglish)) forms.add(asEnglish);

  const asSpanish = Number(s.replace(/\./g, "").replace(",", "."));
  if (Number.isFinite(asSpanish)) forms.add(asSpanish);

  const plain = Number(s.replace(/[.,]/g, ""));
  if (Number.isFinite(plain)) forms.add(plain);

  return [...forms];
}

/** Todos los números que aparecen en un texto, en todas sus lecturas posibles. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(new RegExp(NUMBER_SRC, "g"))) {
    out.push(...parseNumberForms(m[0]));
  }
  return out;
}

// ---------------------------------------------------------------------------
// El conjunto de valores permitidos
// ---------------------------------------------------------------------------

/**
 * Reúne todo número al que el agente tiene derecho a referirse este turno:
 * los del spec ya validado, los de los resultados de tool, y las constantes
 * documentadas.
 */
export function buildAllowedValues(spec: ProjectSpec, toolResults: string[] = []): Set<number> {
  const allowed = new Set<number>();

  for (const c of DOCUMENTED_CONSTANTS) allowed.add(c.value);

  for (const [, v] of Object.entries(spec)) {
    if (v && typeof v === "object" && "status" in v) {
      const val = (v as { value: unknown }).value;
      if (typeof val === "number") allowed.add(val);
      if (typeof val === "string") for (const n of numbersIn(val)) allowed.add(n);
    }
  }

  // Cada componente, su subtotal, y el TOTAL: el total es precisamente la
  // cifra que el agente va a citar cuando explique la suma.
  let totalComponentes = 0;
  for (const c of spec.component_list ?? []) {
    allowed.add(c.w);
    allowed.add(c.qty);
    allowed.add(c.w * c.qty);
    totalComponentes += c.w * c.qty;
  }
  if (totalComponentes > 0) {
    allowed.add(totalComponentes);
    // Y el requerido con el margen documentado del 10%, que se deriva de él.
    allowed.add(Math.round(totalComponentes * 1.1 * 100) / 100);
    allowed.add(Math.round(totalComponentes * 1.1 * 3.412 * 100) / 100);
  }
  if (spec.measured_temps) {
    allowed.add(spec.measured_temps.inside_c);
    allowed.add(spec.measured_temps.outside_c);
  }

  for (const [, v] of Object.entries(spec.derived)) {
    if (typeof v === "number") allowed.add(v);
  }

  // Todo lo que devolvió una herramienta este turno es material citable.
  for (const r of toolResults) for (const n of numbersIn(r)) allowed.add(n);

  return allowed;
}

// ---------------------------------------------------------------------------
// El chequeo
// ---------------------------------------------------------------------------

export interface Offender {
  /** El fragmento tal cual aparece en la prosa, p.ej. "660 W" */
  text: string;
  value: number;
  unit: string;
}

export interface PostCheckResult {
  ok: boolean;
  offenders: Offender[];
  /** La prosa si pasa; el texto de reemplazo si no. Es lo que se pinta. */
  safe: string;
  /** true si se sustituyó — la UI lo marca visiblemente. */
  substituted: boolean;
}

/** Tolerancia relativa: absorbe redondeos de presentación (1485 vs 1485.0). */
function matches(value: number, allowed: Set<number>): boolean {
  if (allowed.has(value)) return true;
  for (const a of allowed) {
    if (a === 0) continue;
    if (Math.abs(a - value) / Math.abs(a) < 0.005) return true;
  }
  return false;
}

/**
 * Verifica la prosa del modelo. Si aparece una cantidad de ingeniería que no
 * procede del spec, de una tool o de una constante documentada, se sustituye
 * el mensaje entero por `fallback`.
 *
 * Sustituir y no regenerar es deliberado: regenerar añade latencia y azar
 * delante de cinco jueces. Feo y predecible gana a elegante e impredecible.
 */
export function postCheckProse(
  prose: string,
  allowed: Set<number>,
  fallback: string,
): PostCheckResult {
  const offenders: Offender[] = [];

  for (const m of prose.matchAll(QUANTITY_RE)) {
    const [text, rawNumber, unit] = m;
    const forms = parseNumberForms(rawNumber!);
    if (forms.some((f) => matches(f, allowed))) continue;
    offenders.push({ text: text.trim(), value: forms[0] ?? NaN, unit: unit!.toLowerCase() });
  }

  if (offenders.length === 0) {
    return { ok: true, offenders: [], safe: prose, substituted: false };
  }
  return { ok: false, offenders, safe: fallback, substituted: true };
}
