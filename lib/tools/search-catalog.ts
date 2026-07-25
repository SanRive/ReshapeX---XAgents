import type { Citation } from "../rules/types";
import { getCorpusIndex, normalizeText, tokenize, type CorpusChunk } from "./corpus-index";

export type CatalogSearchResult = {
  score: number;
  documento: string;
  pagina: number;
  fragmento: string;
  matchedTerms: string[];
  citation: Citation;
};

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MAX_QUERY_LENGTH = 300;
const EXACT_PHRASE_WEIGHT = 18;
const TERM_MATCH_WEIGHT = 5;
const TERM_FREQUENCY_WEIGHT = 1.25;
const DOCUMENT_MATCH_WEIGHT = 3;
const PROXIMITY_WEIGHT = 5;
const RARE_TERM_WEIGHT = 2;
const LENGTH_PENALTY_DIVISOR = 2_000;
const STOP_WORDS = new Set(["a", "an", "and", "de", "del", "el", "en", "for", "la", "of", "or", "the", "to", "y"]);

function importantTerms(query: string): string[] {
  return [...new Set(tokenize(query).filter((term) => term.length > 1 && !STOP_WORDS.has(term)))];
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let position = 0;
  while ((position = haystack.indexOf(needle, position)) !== -1) {
    count += 1;
    position += needle.length;
  }
  return count;
}

function proximityScore(tokens: string[], terms: string[]): number {
  if (terms.length < 2) return 0;
  const positions = terms.map((term) => tokens.findIndex((token) => token === term));
  if (positions.some((position) => position < 0)) return 0;
  const span = Math.max(...positions) - Math.min(...positions);
  return PROXIMITY_WEIGHT / Math.max(1, span);
}

function scoreChunk(chunk: CorpusChunk, phrase: string, terms: string[], documentFrequency: Map<string, number>): CatalogSearchResult | null {
  const matchedTerms = terms.filter((term) => chunk.tokens.includes(term) || chunk.textoNormalizado.includes(term));
  if (!matchedTerms.length) return null;
  let score = chunk.textoNormalizado.includes(phrase) ? EXACT_PHRASE_WEIGHT : 0;
  score += matchedTerms.length * TERM_MATCH_WEIGHT;
  score += matchedTerms.reduce((sum, term) => sum + Math.min(4, countOccurrences(chunk.textoNormalizado, term)) * TERM_FREQUENCY_WEIGHT, 0);
  const normalizedDocument = normalizeText(chunk.documento);
  score += matchedTerms.filter((term) => normalizedDocument.includes(term)).length * DOCUMENT_MATCH_WEIGHT;
  score += proximityScore(chunk.tokens, matchedTerms);
  score += matchedTerms.reduce((sum, term) => sum + (1 / Math.max(1, documentFrequency.get(term) ?? 1)) * RARE_TERM_WEIGHT, 0);
  score -= chunk.texto.length / LENGTH_PENALTY_DIVISOR;
  const roundedScore = Math.max(0, Number(score.toFixed(4)));
  if (roundedScore === 0) return null;
  const citation = { documento: chunk.documento, pagina: chunk.pagina, texto_citado: chunk.texto };
  return { score: roundedScore, documento: chunk.documento, pagina: chunk.pagina, fragmento: chunk.texto, matchedTerms, citation };
}

export function buscarCatalogo(query: string, options: { limit?: number; minScore?: number } = {}): CatalogSearchResult[] {
  if (typeof query !== "string") return [];
  const phrase = normalizeText(query.slice(0, MAX_QUERY_LENGTH));
  const terms = importantTerms(phrase);
  if (!phrase || !terms.length) return [];
  const index = getCorpusIndex();
  const documentFrequency = new Map<string, number>();
  for (const term of terms) {
    documentFrequency.set(term, index.reduce((count, chunk) => count + (chunk.tokens.includes(term) ? 1 : 0), 0));
  }
  const limit = Math.min(MAX_LIMIT, Math.max(1, options.limit ?? DEFAULT_LIMIT));
  const minScore = Math.max(0, options.minScore ?? TERM_MATCH_WEIGHT);
  return index
    .map((chunk) => scoreChunk(chunk, phrase, terms, documentFrequency))
    .filter((result): result is CatalogSearchResult => result !== null && result.score >= minScore)
    .sort((a, b) => b.score - a.score || a.documento.localeCompare(b.documento) || a.pagina - b.pagina)
    .slice(0, limit);
}
