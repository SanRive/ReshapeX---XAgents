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
 * Valores del vocabulario del contrato. Ofrecerlos al preguntar no es inventar:
 * son las opciones que PSS admite, y el agente tiene que poder decir «¿230 V o
 * 460 V?» sin que el guardrail lo tome por una cifra fabricada.
 */
const VOCABULARIO = [115, 230, 400, 460, 12, 4, 3];

/**
 * Reúne todo número al que el agente tiene derecho a referirse este turno.
 *
 * Cuatro fuentes legítimas:
 *   1. El spec ya validado.
 *   2. Los resultados de tool de este turno.
 *   3. Las constantes documentadas del catálogo.
 *   4. **Lo que escribió el propio cliente.**
 *
 * La cuarta no estaba, y era un agujero: el cliente dice «dos variadores de
 * 22 kW», el agente responde «esos 22 kW son potencia nominal, no disipación»
 * —que es LA frase que justifica el producto— y el post-check la bloqueaba por
 * citar un número que, correctamente, nunca llega al spec.
 *
 * La regla es «ningún número sin fuente». El mensaje del cliente es una fuente:
 * repetirle lo que él escribió no es inventar. Lo que sigue prohibido es
 * *derivar* un número nuevo de ahí, y eso lo impide el validador de sobres.
 *
 * @param sourceText mensajes del cliente en esta conversación.
 */
export function buildAllowedValues(
  spec: ProjectSpec,
  toolResults: string[] = [],
  sourceText = "",
): Set<number> {
  const allowed = new Set<number>();

  for (const c of DOCUMENTED_CONSTANTS) allowed.add(c.value);
  for (const v of VOCABULARIO) allowed.add(v);
  for (const n of numbersIn(sourceText)) allowed.add(n);

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

  /**
   * Resultados de tool — SOLO los estructurados, y de ahí el límite de tamaño.
   *
   * Un resultado de `specs_modelo` es una ficha corta: capacidad, voltajes,
   * dimensiones, corriente. Esas cifras son citables una a una.
   *
   * Un resultado de `buscar_catalogo` es un párrafo del catálogo con decenas de
   * números sueltos. Volcarlos todos convertía el guardrail en un colador: el
   * modelo escribió «650 W + 50 W = 700 W» —aritmética suya, no del motor de
   * reglas— y pasó, porque algún fragmento recuperado contenía un 700 sin
   * ninguna relación. Verificado en vivo el 2026-07-25.
   *
   * Un fragmento largo se CITA entero; no se le extraen cifras para recombinar.
   * Si el agente necesita un número concreto de un párrafo, la vía correcta es
   * `specs_modelo`, que lo devuelve como dato y no como prosa.
   */
  const LIMITE_ESTRUCTURADO = 400;
  for (const r of toolResults) {
    if (r.length > LIMITE_ESTRUCTURADO) continue;
    for (const n of numbersIn(r)) allowed.add(n);
  }

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
