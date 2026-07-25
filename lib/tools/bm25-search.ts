/**
 * search-catalog.ts (C2)
 *
 * buscar_catalogo(query) — búsqueda por keywords con ranking BM25.
 * Sin embeddings (§7.7): corpus pequeño y curado, vocabulario técnico
 * cerrado, y necesitamos que el match sea auditable (qué términos
 * dispararon el resultado) porque el validador (A4) exige evidencia
 * literal, no similitud semántica.
 *
 * Refuerzo sobre el plan base: diccionario de sinónimos de dominio,
 * para no perder recall por variantes léxicas (kW vs kilovatios,
 * NEMA vs "grado de protección", etc.) sin pagar el costo de un
 * modelo de embeddings.
 */

import path from "path";
import { cargarCorpus, type Chunk } from "./bm25-index";

export interface ResultadoBusqueda {
  texto: string;
  documento: string;
  pagina: number;
  categoria: string;
  score: number;
}

// --- Tokenización y normalización ---

const STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "and", "or", "to", "in", "on", "with",
  "is", "are", "de", "la", "el", "en", "y", "o", "para", "con", "un", "una",
]);

function tokenizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
    .match(/[a-z0-9]+/g)
    ?.filter((t) => t.length > 1 && !STOPWORDS.has(t)) ?? [];
}

/**
 * Diccionario de sinónimos/expansión de dominio. Cada entrada expande
 * el término de la izquierda agregando los de la derecha a la query
 * (no reemplaza, suma) para no perder el término original tal cual
 * aparece en el catálogo.
 */
const SINONIMOS: Record<string, string[]> = {
  "kw": ["kilovatios", "kilowatts"],
  "kilovatios": ["kw"],
  "temperatura externa": ["temperatura ambiente", "condiciones exteriores", "ambient temperature", "outdoor"],
  "temp externa": ["temperatura ambiente", "ambient temperature", "outdoor"],
  "nema": ["grado de proteccion", "ip rating", "enclosure rating"],
  "aire acondicionado": ["ac", "cooling unit", "air conditioner"],
  "aire-aire": ["heat exchanger", "air to air", "intercambiador aire aire"],
  "aire-agua": ["water cooled", "air to water", "intercambiador aire agua"],
  "ventilador": ["filterfan", "fan", "filtro", "filter fan"],
  "variador": ["vfd", "drive", "inverter"],
  "btu": ["btu/h", "capacidad termica", "cooling capacity"],
  "voltaje": ["voltage", "v", "tension"],
  "capacidad": ["capacity"],
  "capacidad de enfriamiento": ["cooling capacity"],
  "enfriamiento": ["cooling"],
  "calor": ["heat"],
  "disipacion": ["dissipation", "heat loss"],
  "disipacion termica": ["heat dissipation", "power loss"],
  "montaje": ["mounting"],
  "dimensiones": ["dimensions", "size"],
  "corriente": ["current", "amps", "a"],
  "filtro": ["filter"],
  "tablero": ["cabinet", "enclosure", "panel"],
  "armario": ["cabinet", "enclosure"],
  "intercambiador": ["heat exchanger"],
  "modelo": ["model"],
  "referencia": ["part no", "article number", "model"],

  // ── Entradas inversas ──────────────────────────────────────────────────────
  // El diccionario de arriba es unidireccional: «voltaje» expandía a «tension»,
  // pero «tension» no expandía a nada. El corpus está en inglés, así que un
  // cliente que escribe «tensión» no encontraba NADA. Verificado: score 0.
  //
  // El agente habla con clientes en castellano. Si el término que usan de forma
  // natural no llega al corpus, la herramienta de conocimiento no sirve para su
  // caso de uso principal.
  "tension": ["voltage", "voltaje", "supply voltage"],
  "voltios": ["voltage", "v"],
  "amperios": ["amps", "current", "a"],
  "amperaje": ["current", "amps"],
  "perdidas": ["losses", "heat loss", "power loss", "dissipation"],
  "gabinete": ["cabinet", "enclosure", "panel"],
  "lavado": ["washdown", "wash down", "cleaning"],
  "lavado a presion": ["washdown", "high pressure cleaning"],
  "intemperie": ["outdoor", "outside"],
  "interior": ["indoor", "inside"],
  "polvo": ["dust", "dirty", "dirt"],
  "sucio": ["dirty", "dust"],
  "humedad": ["humidity", "moisture"],
  "refrigeracion": ["cooling", "refrigeration"],
  "acero inoxidable": ["stainless steel"],
  "chapa pintada": ["painted steel"],
};

function expandirQuery(query: string): string[] {
  const tokensBase = tokenizar(query);
  const extra: string[] = [];

  const queryLower = query.toLowerCase();
  for (const [clave, expansiones] of Object.entries(SINONIMOS)) {
    if (queryLower.includes(clave)) {
      expansiones.forEach((e) => extra.push(...tokenizar(e)));
    }
  }

  return [...new Set([...tokensBase, ...extra])];
}

// --- BM25 ---

interface DocIndexado {
  chunk: Chunk;
  tokens: string[];
  tf: Map<string, number>;
  len: number;
}

let _indice: DocIndexado[] | null = null;
let _df: Map<string, number> | null = null;
let _avgLen = 0;

function construirIndice(corpusRoot: string) {
  const chunks = cargarCorpus(corpusRoot);
  const indice: DocIndexado[] = [];
  const df = new Map<string, number>();

  for (const chunk of chunks) {
    const tokens = tokenizar(chunk.texto);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    for (const t of new Set(tokens)) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }

    indice.push({ chunk, tokens, tf, len: tokens.length });
  }

  _avgLen = indice.reduce((sum, d) => sum + d.len, 0) / indice.length;
  _indice = indice;
  _df = df;
}

const K1 = 1.5;
const B = 0.75;

/**
 * Umbral mínimo de score BM25. Sin esto, cualquier query devuelve
 * "algo" con score bajo pero no-cero, que se ve indistinguible de un
 * match real para quien consume el resultado (B, D, o el LLM en el
 * loop de tools). Es preferible devolver lista vacía y que el
 * llamador trate eso como "no encontrado" — que es exactamente lo
 * que exige la regla de oro del proyecto (no inventar cuando falta
 * el dato).
 */
const SCORE_MINIMO = 5.0;

function bm25Score(query: string[], doc: DocIndexado, N: number, df: Map<string, number>): number {
  let score = 0;
  const uniqueQuery = new Set(query);

  for (const term of uniqueQuery) {
    const docFreq = df.get(term) ?? 0;
    if (docFreq === 0) continue;

    const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);
    const tf = doc.tf.get(term) ?? 0;
    if (tf === 0) continue;

    const norm = tf * (K1 + 1);
    const denom = tf + K1 * (1 - B + B * (doc.len / _avgLen));
    score += idf * (norm / denom);
  }

  return score;
}

/**
 * Punto de entrada de C2. Firma acordada con el equipo — no cambiar
 * sin avisar a B (motor de reglas) y D (UI), que consumen esto.
 */
export function buscar_catalogo(
  query: string,
  opts: { k?: number; categoria?: Chunk["categoria"]; corpusRoot?: string } = {}
): ResultadoBusqueda[] {
  const { k = 6, categoria, corpusRoot = path.join(process.cwd(), "corpus_txt") } = opts;

  if (!_indice || !_df) construirIndice(corpusRoot);

  const queryTokens = expandirQuery(query);
  if (queryTokens.length === 0) return [];

  const N = _indice!.length;

  const candidatos = categoria
    ? _indice!.filter((d) => d.chunk.categoria === categoria)
    : _indice!;

  const puntuados = candidatos
    .map((doc) => ({ doc, score: bm25Score(queryTokens, doc, N, _df!) }))
    .filter((r) => r.score >= SCORE_MINIMO)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return puntuados.map(({ doc, score }) => ({
    texto: doc.chunk.texto,
    documento: doc.chunk.documento,
    pagina: doc.chunk.pagina,
    categoria: doc.chunk.categoria,
    score: Math.round(score * 1000) / 1000,
  }));
}

/** Útil para tests/debug: fuerza reconstrucción del índice (ej. si cambia el corpus). */
export function _resetIndice() {
  _indice = null;
  _df = null;
}