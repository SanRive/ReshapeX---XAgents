/**
 * La forma de un turno — el seam entre la UI (pista D) y la integracion (I1).
 *
 * `POST /api/turn` devuelve exactamente un `TurnResult`. La UI no conoce nada
 * mas del backend: ni proveedores, ni tools, ni el motor de reglas. Si esta
 * forma se respeta, D e I1 pueden avanzar sin abrir el mismo archivo.
 *
 * Referencia: spec §7.2 (las tres capas) y §7.4 (manejo de errores).
 */

import type { Citation, ProjectSpec } from "./project-spec";

/* ==========================================================================
   Compuerta de 4 familias (§4.1)
   ========================================================================== */

export type Family = "filterfan" | "air_air_hx" | "cooling_unit" | "air_water_hx";

export type Verdict = "viable" | "conditional" | "rejected";

export interface FamilyVerdict {
  family: Family;
  /** Nombre comercial tal como aparece en el catalogo. */
  label: string;
  verdict: Verdict;
  /** Una frase. La razon, en castellano, sin numeros que no vengan del spec. */
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
  /** Corriente publicada por modelo y voltaje. Es la unica cifra electrica que
   *  damos: no hay precios ni potencia por modelo en el corpus (§3.4). */
  current_a?: number;
  article_no?: string;
  verdict: Verdict;
  reason: string;
  citations: Citation[];
}

export interface Shortlist {
  /** Disipacion declarada o sumada de la lista de componentes. Nunca estimada. */
  total_dissipation_w: number;
  /** total x 1.10 — margen citado de DTS_2017. */
  required_w: number;
  required_btuh: number;
  candidates: ModelCandidate[];
  rejected: ModelCandidate[];
  /** Advertencia de base de rating cuando el punto de operacion es mas severo
   *  que DIN 35/35. La escribe el motor de reglas, no el modelo. */
  derating_note: string | null;
  units_needed: number;
}

/* ==========================================================================
   Log de decisiones — la prueba de que el guardrail actuo
   ========================================================================== */

export type DecisionKind =
  | "extract"
  | "degraded"
  | "default"
  | "gate"
  | "shortlist"
  | "guardrail"
  | "tool";

export interface DecisionEntry {
  kind: DecisionKind;
  text: string;
  citation?: Citation;
}

/* ==========================================================================
   Mensajes del chat
   ========================================================================== */

export type Speaker = "client" | "agent" | "system";

export interface ChatMessage {
  id: string;
  speaker: Speaker;
  text: string;
  /** Fragmentos del propio texto que la extraccion uso como evidencia. La UI los
   *  resalta in situ: es la costura visible entre el chat y la ficha. */
  highlights?: { text: string; status: "declared" | "inferred" }[];
  /** Que proveedor respondio este turno. El fallback es visible, no silencioso. */
  provider?: ProviderTrace;
  /** Campos que este turno cambio de estado, para animarlos en la ficha. */
  touched?: string[];
  /** Se disparo el post-check numerico y se sustituyo la prosa. */
  postCheckReplaced?: boolean;
}

export interface ProviderTrace {
  /** groq-1 · groq-2 · mistral-1 · … El indice es la posicion en el pool. */
  id: string;
  model: string;
  latency_ms: number;
  /** Proveedores que se intentaron y fallaron antes de este. */
  fell_back_from?: string[];
}

/* ==========================================================================
   Preguntas bloqueantes — maximo 3 por turno (§3.3 fase 2)
   ========================================================================== */

export interface BlockingQuestion {
  field: string;
  /** Por que lo necesito. Sale del FIELD_GUIDE, no del modelo. */
  why: string;
  /** Donde buscarlo. */
  where: string;
  /** Camino alterno aceptable. */
  alternative: string | null;
  /** El error clasico que este campo invita a cometer. */
  antipattern: string | null;
  citation?: Citation;
}

/* ==========================================================================
   El turno completo
   ========================================================================== */

export interface TurnResult {
  spec: ProjectSpec;
  /** null mientras no se cierre el umbral 1. */
  gate: FamilyVerdict[] | null;
  /** null mientras no se cierre el umbral 2. */
  shortlist: Shortlist | null;
  questions: BlockingQuestion[];
  decisions: DecisionEntry[];
  message: ChatMessage;
  /** Lo que explicitamente no afirmamos. Lo ensambla codigo, no el modelo. */
  disclaimers: string[];
  /** Guardrail de fuera de alcance: se disparo antes de llamar al LLM. */
  outOfScope?: { keyword: string; response: string };
}
