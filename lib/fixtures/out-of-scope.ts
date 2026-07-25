/**
 * FIXTURE — el caso fuera de alcance.
 *
 * Abre la demo: 15 segundos que demuestran que el agente sabe lo que NO sabe.
 * El guardrail lo caza por keywords ANTES de llamar al LLM, así que este spec
 * se queda enteramente vacío: no se gasta una llamada ni se extrae nada.
 */

import { emptySpec, type ProjectSpec } from "../project-spec";

export const FUERA_DE_ALCANCE_INPUT = `Buenos días,

Necesitamos sirenas y balizas para señalización de emergencia en una subestación eléctrica. ¿Qué modelos manejan y qué nivel sonoro alcanzan?

Gracias.`;

/**
 * Dominios que el agente rechaza. Pfannenberg los fabrica, pero están fuera del
 * alcance del MVP (spec §3.4) y meterlos en el retrieval arruina la precisión.
 */
export const OUT_OF_SCOPE_KEYWORDS = [
  // señalización
  "sirena", "sirenas", "baliza", "balizas", "señalización", "senalizacion",
  "estrobo", "sounder", "beacon", "siren", "signaling", "alarma sonora",
  // refrigeración de proceso
  "chiller", "chillers", "enfriador de proceso", "process cooling",
  // calefacción
  "calefactor", "calefacción", "calefaccion", "resistencia calefactora", "heater",
  // detección de gas
  "detección de gas", "deteccion de gas", "gas alarm",
] as const;

export const FUERA_DE_ALCANCE_RESPUESTA = `Eso queda fuera de lo que puedo resolver.

Trabajo solo sobre **climatización de gabinetes eléctricos** — filterfans, intercambiadores de calor y unidades de refrigeración. La señalización de emergencia es otra línea de Pfannenberg y no tengo su catálogo cargado, así que cualquier modelo o nivel sonoro que te diera me lo estaría inventando.

Para eso te tiene que atender un comercial de la línea de señalización.

Si además necesitas climatizar los tableros de esa subestación, eso sí lo veo: cuéntame la temperatura ambiente, si es interior o intemperie, y cómo de sucio es el entorno.`;

/** El spec no se toca: el guardrail corta antes de extraer nada. */
export const FUERA_DE_ALCANCE_SPEC: ProjectSpec = emptySpec();

/** Devuelve la keyword que disparó el rechazo, o null si el mensaje está en alcance. */
export function detectOutOfScope(input: string): string | null {
  const norm = input.toLowerCase();
  return OUT_OF_SCOPE_KEYWORDS.find((k) => norm.includes(k)) ?? null;
}