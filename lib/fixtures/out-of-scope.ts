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
export type FueraDeAlcance = "señalización" | "chiller" | "calefacción" | "gas";

/**
 * Agrupadas POR CATEGORÍA, no en una lista plana.
 *
 * La versión anterior era un array único y la categoría se deducía por rangos
 * de índice (`i < 12`, `i < 25`…). Al añadir keywords los rangos se
 * desincronizaron en silencio y «calentar el gabinete» respondía con el texto
 * de detección de gas. Un dato que hay que mantener sincronizado a mano con
 * otro es un bug esperando su turno.
 */
export const KEYWORDS_POR_CATEGORIA: Record<FueraDeAlcance, readonly string[]> = {
  señalización: [
    "sirena", "sirenas", "baliza", "balizas", "señalización", "senalizacion",
    "estrobo", "sounder", "beacon", "siren", "signaling", "alarma sonora",
  ],
  /**
   * Un chiller enfría un LÍQUIDO, no un gabinete.
   *
   * Verificado el 2026-07-25: «necesito enfriar agua de proceso a 8 grados» se
   * colaba, y el agente lo trataba como un caso de climatización de tablero,
   * pidiendo temperatura ambiente y calidad del aire. Solo se cazaba la palabra
   * «chiller», que es justo la que un cliente no experto NO usa — si supiera
   * que se llama chiller, no estaría preguntando.
   */
  chiller: [
    "chiller", "chillers", "enfriador de proceso", "process cooling",
    "agua de proceso", "enfriar agua", "enfriar el agua", "enfriamiento de agua",
    "refrigerar agua", "agua refrigerada", "agua helada", "chilled water",
    "torre de enfriamiento", "cooling tower", "circuito de agua",
  ],
  calefacción: [
    "calefactor", "calefacción", "calefaccion", "resistencia calefactora", "heater",
    "calentar el gabinete", "calentar el tablero", "calentar los tableros",
    "anticondensación", "anticondensacion",
  ],
  gas: ["detección de gas", "deteccion de gas", "gas alarm", "detector de gas"],
};

export const OUT_OF_SCOPE_KEYWORDS = Object.values(KEYWORDS_POR_CATEGORIA).flat();

/** A qué familia pertenece la keyword. Derivado del mapa, no de índices. */
function categoriaDe(keyword: string): FueraDeAlcance {
  for (const [cat, ks] of Object.entries(KEYWORDS_POR_CATEGORIA)) {
    if (ks.includes(keyword)) return cat as FueraDeAlcance;
  }
  return "señalización";
}

const CIERRE = `\n\nSi lo que necesitas es **climatizar un tablero eléctrico**, eso sí lo veo: cuéntame la temperatura ambiente máxima, si está en interior, a la intemperie o en zona de lavado, y cómo de sucio es el entorno.`;

const RESPUESTAS = {
  señalización: `Eso queda fuera de lo que puedo resolver.

Trabajo solo sobre **climatización de gabinetes eléctricos** — filterfans, intercambiadores de calor y unidades de refrigeración. La señalización de emergencia es otra línea de Pfannenberg y no tengo su catálogo cargado, así que cualquier modelo o nivel sonoro que te diera me lo estaría inventando.

Para eso te tiene que atender un comercial de la línea de señalización.`,

  chiller: `Eso es un **chiller**, y queda fuera de lo que puedo resolver.

Un chiller enfría un líquido de proceso; yo trabajo sobre el aire dentro de un **gabinete eléctrico**. Son problemas distintos con catálogos distintos, y el de refrigeración de proceso no lo tengo cargado — cualquier capacidad o modelo que te diera me lo estaría inventando.

Para eso te atiende la línea de Liquid Cooling de Pfannenberg.`,

  calefacción: `Eso queda fuera de lo que puedo resolver.

Los calefactores y resistencias anticondensación son otra familia del catálogo, y no la tengo cargada. Yo cubro el problema contrario: sacar calor de un gabinete que se calienta de más.`,

  gas: `Eso queda fuera de lo que puedo resolver.

La detección de gas es otra línea de Pfannenberg y no tengo su catálogo cargado. Cualquier modelo o umbral que te diera me lo estaría inventando.`,
} as const;

/** Respuesta por defecto — la de señalización, que es el caso de la demo. */
export const FUERA_DE_ALCANCE_RESPUESTA = RESPUESTAS["señalización"] + CIERRE;

/** La respuesta que corresponde a la keyword que disparó el rechazo. */
export function respuestaFueraDeAlcance(keyword: string): string {
  return RESPUESTAS[categoriaDe(keyword)] + CIERRE;
}

/** El spec no se toca: el guardrail corta antes de extraer nada. */
export const FUERA_DE_ALCANCE_SPEC: ProjectSpec = emptySpec();

/** Devuelve la keyword que disparó el rechazo, o null si el mensaje está en alcance. */
export function detectOutOfScope(input: string): string | null {
  const norm = input.toLowerCase();
  // La MAS LARGA que case, no la primera: una frase concreta describe mejor el
  // caso que una palabra suelta, y de ella depende que respuesta se da.
  const hits = OUT_OF_SCOPE_KEYWORDS.filter((k) => norm.includes(k));
  if (hits.length === 0) return null;
  return hits.reduce((a, b) => (b.length > a.length ? b : a));
}

/* ==========================================================================
   Fuera de TAREA — saludos y meta-preguntas
   ========================================================================== */

/**
 * Un «hola» recorría el pipeline entero: llamada al modelo para extraer de un
 * saludo, nada que extraer, y una plantilla seca exigiendo tres datos. 16
 * segundos para eso. Verificado el 2026-07-25.
 *
 * Teníamos guardrail para fuera de DOMINIO (sirenas) pero no para fuera de
 * TAREA. Un juez que escriba «hola» se lleva la peor primera impresión posible.
 */
const SALUDOS = /^[\s¡!]*(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|hi|hello|qu[eé] tal|saludos)[\s!¡.,]*$/i;

const META =
  /^[\s¿?]*(qu[eé] (sabes|puedes) hacer|qu[eé] eres|qui[eé]n eres|para qu[eé] sirves|c[oó]mo funcionas|ay[uú]dame|help|qu[eé] haces)[\s?¿!¡.,]*$/i;

export const SALUDO_RESPUESTA = `Buenas. Soy el copiloto de ingeniería de Pfannenberg para **climatización de gabinetes eléctricos**.

Lo que hago es leer la consulta de un cliente tal como llega —un correo, sin ordenar— y sacar de ahí lo que Pfannenberg Sizing Software necesita para dimensionar: temperatura ambiente, ubicación, carga térmica, tensión. Lo que está declarado lo cito; lo que falta lo pregunto y te digo dónde buscarlo. Nunca lo invento.

Pégame el correo del cliente tal como te llegó, o cuéntame el caso: **dónde está el tablero, a qué temperatura llega el ambiente y cómo de sucio es el entorno.** Con esos tres ya puedo descartar tecnologías.`;

/**
 * ¿Es un saludo o una meta-pregunta? Devuelve la respuesta, o null si el
 * mensaje es un caso técnico de verdad.
 *
 * Deliberadamente estricto —ancla a principio y fin— para no tragarse un correo
 * que empiece por «Buenos días,» y siga con el caso. Ahí sí hay que extraer.
 */
export function detectSmallTalk(input: string): string | null {
  const t = input.trim();
  if (t.length > 60) return null; // un correo real no es un saludo
  return SALUDOS.test(t) || META.test(t) ? SALUDO_RESPUESTA : null;
}