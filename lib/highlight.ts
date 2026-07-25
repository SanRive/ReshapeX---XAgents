/**
 * Resaltado de evidencia dentro del mensaje del cliente.
 *
 * La ficha dice «este valor salió de esta frase». Esto lo cierra por el otro
 * lado: la frase aparece subrayada dentro del propio mensaje. Chat y ficha
 * quedan cosidos, y se ve que la evidencia es un substring literal y no un
 * resumen.
 *
 * Busca coincidencias literales, sin normalizar. Si una evidencia no aparece
 * aquí es que no era literal — que es justo lo que el validador degrada a
 * `missing`.
 */

import { FIELD_KEYS, type AnyField, type ExtractedSpec } from "./project-spec";

export interface Segment {
  text: string;
  marked: boolean;
}

/** Todas las evidencias declaradas del spec, sin repetir y de mayor a menor.
 *  El orden importa: la más larga gana cuando dos se solapan. */
export function evidenceStrings(spec: ExtractedSpec): string[] {
  const seen = new Set<string>();
  for (const key of FIELD_KEYS) {
    const field = spec[key] as AnyField;
    if (field?.status === "declared" && field.evidence) seen.add(field.evidence);
  }
  return [...seen].sort((a, b) => b.length - a.length);
}

export function segmentByEvidence(text: string, evidences: string[]): Segment[] {
  const taken: [number, number][] = [];

  for (const ev of evidences) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(ev, from);
      if (at === -1) break;
      const end = at + ev.length;
      const overlaps = taken.some(([s, e]) => at < e && end > s);
      if (!overlaps) taken.push([at, end]);
      from = end;
    }
  }

  if (taken.length === 0) return [{ text, marked: false }];

  taken.sort((a, b) => a[0] - b[0]);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const [start, end] of taken) {
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), marked: false });
    }
    segments.push({ text: text.slice(start, end), marked: true });
    cursor = end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), marked: false });
  }
  return segments;
}
