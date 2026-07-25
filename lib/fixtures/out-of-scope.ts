/**
 * Fixture del caso fuera de alcance.
 *
 * El guardrail corre ANTES de llamar al LLM: keywords sobre el mensaje del
 * cliente → respuesta fija y citada, sin gastar una llamada (spec §7.4). Abrir
 * la demo con esto demuestra que el agente sabe lo que NO sabe, que es la parte
 * que un chatbot suelto no puede enseñar.
 */

export const OUT_OF_SCOPE_KEYWORDS = [
  "sirena",
  "sirenas",
  "baliza",
  "señalización",
  "senalizacion",
  "estrobo",
  "chiller",
  "chillers",
  "calefacción",
  "calefaccion",
  "calefactor",
  "resistencia calefactora",
  "alarma sonora",
] as const;

export const MESSAGE_OUT_OF_SCOPE =
  "Necesito sirenas para una subestación, ¿qué me recomiendan?";

export const RESPONSE_OUT_OF_SCOPE = `Eso está fuera de lo que puedo responder con fundamento.

Este copiloto cubre **thermal management de gabinetes**: las cuatro familias de la matriz de tecnología del catálogo — filterfans, intercambiadores aire/aire, cooling units e intercambiadores aire/agua — y el brief que alimenta a PSS.

La señalización acústica y visual es otra línea de producto de Pfannenberg, con su propio catálogo y sus propios criterios de selección. No indexé ese material, así que cualquier recomendación que le diera sería inventada. Eso lo ve un ingeniero de aplicación con el catálogo de señalización delante.

Si el tablero de esa subestación tiene un problema de temperatura, eso sí lo trabajo: cuénteme el ambiente, la ubicación y qué hay dentro del gabinete.`;

/** Deteccion determinista. La usa el guardrail antes del LLM y la UI para el
 *  ejemplo precargado. No es una heuristica del modelo. */
export function detectOutOfScope(input: string): string | null {
  const haystack = input.toLowerCase();
  return (
    OUT_OF_SCOPE_KEYWORDS.find((k) => haystack.includes(k.toLowerCase())) ?? null
  );
}
