/**
 * A6 — POST-CHECK NUMERICO SOBRE LA PROSA DEL CHAT.
 *
 * El validador de sobres protege el `ProjectSpec`. Este protege lo que el
 * modelo *escribe*, que es la superficie que abrio el chat.
 *
 * El fallo que existe para impedir:
 *   «Un variador de 22 kW tipicamente disipa un 3%, asi que unos 660 W.»
 * Fluido, plausible, y jamas toca el validador de sobres porque es prosa.
 *
 * QUE SE PERSIGUE Y QUE NO
 * ------------------------
 * Solo cantidades de ingenieria, o sea numero CON unidad. Un «4» suelto en
 * «hay 4 familias de tecnologia» es prosa y no se toca — perseguirlo daria
 * falsos positivos en cada turno y alguien acabaria desactivando el guardrail,
 * que es la peor forma de fallar.
 *
 * Firma fijada en `docs/contratos-de-modulo.md`.
 */

import { MARGIN_FACTOR, BTU_PER_W, type ProjectSpec } from "../project-spec";

/* ==========================================================================
   Unidades que convierten un numero en una afirmacion tecnica
   ========================================================================== */

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
 * Patron de numero. La primera alternativa exige AL MENOS un grupo de miles
 * (`+`, no `*`): con `*` el `\d{1,3}` partia «5000» en «500» + «0».
 * El espacio no cuenta como separador de miles: en «5000 – 7000» se comeria el
 * guion y uniria dos cifras distintas.
 */
const NUMBER_SRC = String.raw`\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;

const QUANTITY_RE = new RegExp(
  `(${NUMBER_SRC})\\s*(${UNITS.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![a-z])`,
  "gi",
);

/**
 * Constantes documentadas que el agente puede citar sin que esten en el spec.
 * Cada una tiene fuente en el catalogo; no son numeros libres.
 */
export const DOCUMENTED_CONSTANTS: ReadonlyArray<{ value: number; fuente: string }> = [
  { value: 10, fuente: 'DTS_2017 — margen: "should exceed ... by approximately 10%"' },
  { value: MARGIN_FACTOR, fuente: "DTS_2017 — el mismo margen expresado como factor" },
  { value: BTU_PER_W, fuente: "Conversion de unidades W → Btu/h" },
  { value: 35, fuente: "DTS_2017 — base de rating DIN 35/35 °C · y default interno" },
];

/* ==========================================================================
   Canonicalizacion de numeros
   ========================================================================== */

/**
 * Un «1.350» puede ser 1350 (espanol) o 1.35 (ingles). No se puede resolver la
 * ambiguedad sin saber la locale de quien escribe, asi que se admiten AMBAS
 * lecturas. Es permisivo en la direccion correcta: evita bloquear una cifra
 * legitima, y sigue cazando un 660 que no existe en ninguna fuente.
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

/** Todos los numeros de un texto, en todas sus lecturas posibles. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(new RegExp(NUMBER_SRC, "g"))) {
    out.push(...parseNumberForms(m[0]));
  }
  return out;
}

/* ==========================================================================
   El conjunto de valores permitidos
   ========================================================================== */

function collectFrom(value: unknown, into: Set<number>): void {
  if (typeof value === "number") into.add(value);
  else if (typeof value === "string") for (const n of numbersIn(value)) into.add(n);
}

/**
 * Reune todo numero al que el agente tiene derecho a referirse este turno: los
 * del spec ya validado, los de los resultados de tool, y las constantes
 * documentadas.
 */
export function buildAllowedValues(spec: ProjectSpec, toolResults: unknown[] = []): Set<number> {
  const allowed = new Set<number>();

  for (const c of DOCUMENTED_CONSTANTS) allowed.add(c.value);

  for (const [, v] of Object.entries(spec)) {
    if (v && typeof v === "object" && "status" in (v as Record<string, unknown>)) {
      collectFrom((v as { value: unknown }).value, allowed);
    }
  }

  // Cada componente, su subtotal y el TOTAL. El total es precisamente la cifra
  // que el agente cita cuando explica la suma — sin el, se bloquea a si mismo.
  let totalComponentes = 0;
  for (const c of spec.component_list ?? []) {
    allowed.add(c.w);
    allowed.add(c.qty);
    allowed.add(c.w * c.qty);
    totalComponentes += c.w * c.qty;
  }
  if (totalComponentes > 0) {
    allowed.add(totalComponentes);
    allowed.add(Math.round(totalComponentes * MARGIN_FACTOR * 100) / 100);
    allowed.add(Math.round(totalComponentes * MARGIN_FACTOR * BTU_PER_W * 100) / 100);
  }

  // Lo que devolvio una herramienta este turno es material citable.
  for (const r of toolResults) {
    if (typeof r === "string") for (const n of numbersIn(r)) allowed.add(n);
    else if (r != null) for (const n of numbersIn(JSON.stringify(r))) allowed.add(n);
  }

  return allowed;
}

/* ==========================================================================
   El chequeo
   ========================================================================== */

export interface Offender {
  /** El fragmento tal cual aparece en la prosa, p.ej. "660 W". */
  text: string;
  value: number;
  unit: string;
}

export interface PostCheckResult {
  text: string;
  replaced: boolean;
  offenders: Offender[];
}

/** Tolerancia relativa: absorbe redondeos de presentacion (1485 vs 1485.0). */
function matches(value: number, allowed: Set<number>): boolean {
  if (allowed.has(value)) return true;
  for (const a of allowed) {
    if (a === 0) continue;
    if (Math.abs(a - value) / Math.abs(a) < 0.005) return true;
  }
  return false;
}

const FALLBACK =
  "No puedo respaldar con el catalogo alguna de las cifras que iba a darte, asi que prefiero no darla. " +
  "Lo que si esta fundamentado esta en la ficha y en el brief. Si necesitas ese dato concreto, lo confirma el ingeniero de aplicacion con PSS.";

/**
 * Verifica la prosa del modelo. Si aparece una cantidad de ingenieria que no
 * procede del spec, de una tool o de una constante documentada, se sustituye el
 * mensaje entero.
 *
 * Sustituir y no regenerar es deliberado: regenerar anade latencia y azar
 * delante de cinco jueces. Feo y predecible gana a elegante e impredecible.
 */
export function postCheck(
  prose: string,
  spec: ProjectSpec,
  toolResults: unknown[] = [],
  fallback: string = FALLBACK,
): PostCheckResult {
  const allowed = buildAllowedValues(spec, toolResults);
  const offenders: Offender[] = [];

  for (const m of prose.matchAll(QUANTITY_RE)) {
    const [text, rawNumber, unit] = m;
    const forms = parseNumberForms(rawNumber!);
    if (forms.some((f) => matches(f, allowed))) continue;
    offenders.push({ text: text.trim(), value: forms[0] ?? NaN, unit: unit!.toLowerCase() });
  }

  if (offenders.length === 0) return { text: prose, replaced: false, offenders: [] };
  return { text: fallback, replaced: true, offenders };
}
