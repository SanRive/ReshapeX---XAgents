/**
 * La forma de un turno — el seam entre la UI (pista D) y la integración (I1).
 *
 * `POST /api/turn` devuelve exactamente un `TurnResult`. La UI no conoce nada
 * más del backend: ni proveedores, ni tools, ni el motor de reglas.
 *
 * Lo que YA está en el contrato de T0.2 no se redefine aquí. En concreto el
 * `decision_log` vive dentro del `ProjectSpec` y se re-exporta tal cual: un
 * segundo tipo de log se desincronizaría solo.
 *
 * Referencia: spec §7.2 (las tres capas) y §7.4 (manejo de errores).
 */

import type { ProjectSpec } from "./project-spec";

/** El log de decisiones es del contrato, no de la UI. */
export type DecisionEntry = ProjectSpec["decision_log"][number];
export type DecisionAction = DecisionEntry["action"];

/* ==========================================================================
   Citas del catálogo
   --------------------------------------------------------------------------
   El contrato usa `basis` como clave de DEFAULTS para los valores por defecto.
   Esto es lo otro: las citas que acompañan a los veredictos de la compuerta y
   a los descartes del shortlist, que son salida del motor de reglas (pista B).
   ========================================================================== */

export interface Citation {
  documento: string;
  pagina: string;
  texto_citado: string;
}

/* ==========================================================================
   Compuerta de 4 familias (§4.1)
   ========================================================================== */

export type Family = "filterfan" | "air_air_hx" | "cooling_unit" | "air_water_hx";

export type Verdict = "viable" | "conditional" | "rejected";

export interface FamilyVerdict {
  family: Family;
  /** Nombre comercial tal como aparece en el catálogo. */
  label: string;
  verdict: Verdict;
  /** Una frase. La razón, sin números que no vengan del spec. */
  reason: string;
  citations: Citation[];
}

export const FAMILY_LABELS: Record<Family, string> = {
  filterfan: "Filterfan 4.0 + Exhaust Filters",
  air_air_hx: "PKS Air/Air Heat Exchangers",
  cooling_unit: "DTS Cooling Units",
  air_water_hx: "PWS Air/Water Heat Exchangers",
};

/* ==========================================================================
   Shortlist de Cooling Units
   ========================================================================== */

export interface ModelCandidate {
  model: string;
  /** Rango publicado en el quick selection chart, en Btu/h. */
  capacity_btuh: [number, number];
  voltages: string[];
  dimensions_mm: { h: number; w: number; d: number };
  /** side | recessed | top — codificado en la serie: DTS / DTI / DTT. */
  mounting: "side" | "recessed" | "top";
  nema_available: string[];
  /** Corriente publicada por modelo y voltaje. Es la única cifra eléctrica que
   *  damos: no hay precios ni potencia por modelo en el corpus (§3.4). */
  current_a?: number;
  article_no?: string;
  verdict: Verdict;
  reason: string;
  citations: Citation[];
}

export interface Shortlist {
  candidates: ModelCandidate[];
  rejected: ModelCandidate[];
  /** Advertencia de base de rating cuando el punto de operación es más severo
   *  que DIN 35/35. La escribe el motor de reglas, no el modelo. */
  derating_note: string | null;
  /** Cuántas unidades hacen falta: una por gabinete. */
  units_needed: number;
}

/* ==========================================================================
   Mensajes del chat
   ========================================================================== */

export type Speaker = "client" | "agent" | "system";

export interface ChatMessage {
  id: string;
  speaker: Speaker;
  text: string;
  /** Qué proveedor respondió este turno. El fallback es visible, no silencioso. */
  provider?: ProviderTrace;
  /** Campos que este turno cambió de estado, para animarlos en la ficha. */
  touched?: string[];
  /** Se disparó el post-check numérico y se sustituyó la prosa. */
  postCheckReplaced?: boolean;
}

export interface ProviderTrace {
  /** groq-1 · groq-2 · mistral-1 · … El índice es la posición en el pool. */
  id: string;
  model: string;
  latency_ms: number;
  /** Proveedores que se intentaron y fallaron antes de este. */
  fell_back_from?: string[];
}

/* ==========================================================================
   Preguntas bloqueantes — máximo 3 por turno (§3.3 fase 2)
   ========================================================================== */

export interface BlockingQuestion {
  /** Una clave de FIELD_KEYS. */
  field: string;
  /** Por qué lo necesito. Sale del FIELD_GUIDE, no del modelo. */
  why: string;
  /** Dónde buscarlo. */
  where: string;
  /** Camino alterno aceptable. */
  alternative: string | null;
  /** El error clásico que este campo invita a cometer. */
  antipattern: string | null;
  citation?: Citation;
}

/* ==========================================================================
   El turno completo
   ========================================================================== */

export interface TurnResult {
  /** Trae dentro `derived` y `decision_log`. */
  spec: ProjectSpec;
  /** null mientras no se cierre el umbral 1. */
  gate: FamilyVerdict[] | null;
  /** null mientras no se cierre el umbral 2. */
  shortlist: Shortlist | null;
  questions: BlockingQuestion[];
  message: ChatMessage;
  /** Lo que explícitamente no afirmamos. Lo ensambla código, no el modelo. */
  disclaimers: string[];
  /** Guardrail de fuera de alcance: se disparó antes de llamar al LLM. */
  outOfScope?: { keyword: string; response: string };
}
