/**
 * B5 · `FIELD_GUIDE` — la capa "cómo consigo este dato".
 *
 * Ocho filas, una por campo bloqueante (§3.6 · §3.7). **Tabla estática escrita a mano y
 * versionada**, no improvisación del modelo: así sigue siendo determinista y citable.
 * La tool `guia_de_campo(campo)` (Pista C) devuelve estas filas tal cual.
 *
 * El campo `antiPattern` es el que evita el error clásico. El de `total_dissipation_w` es
 * el que sostiene toda la demo: *no usar la potencia nominal del motor (kW) como
 * sustituto de la pérdida del variador (W)*.
 */

import { CITATIONS } from "./catalog-data";
import type { FieldGuideEntry } from "./types";

/**
 * Los ocho campos bloqueantes, en el orden de los dos umbrales de §3.6:
 * los tres de la compuerta primero, los del shortlist después.
 */
export const FIELD_GUIDE: readonly FieldGuideEntry[] = [
  /* ---------------- Umbral 1 · correr la compuerta de 4 familias ---------------- */
  {
    field: "ambient_temp_max_c",
    whyItMatters:
      "Es la frontera que decide todo: si el ambiente supera la temperatura interna objetivo, " +
      "hace falta enfriamiento activo y quedan descartados el filterfan y el intercambiador " +
      "aire/aire. Sin este dato no hay compuerta.",
    whereToFindIt:
      "Temperatura máxima del aire alrededor del gabinete en el peor momento del día y del año, " +
      "no la temperatura de la ciudad. Sirve un termómetro colgado junto al tablero durante un " +
      "turno completo, o el registro del sistema de clima de la planta.",
    alternativeEvidence:
      "Si el gabinete está junto a un horno, una caldera o bajo cubierta metálica, la " +
      "temperatura local es bastante más alta que la del resto de la nave: medir ahí, no en la " +
      "puerta.",
    citation: CITATIONS.COOLING_ACTIVO_REQUERIDO,
    antiPattern:
      "No usar la temperatura media anual de la ciudad ni el promedio del día. El " +
      "dimensionamiento va contra el peor caso, no contra el promedio.",
  },
  {
    field: "location",
    whyItMatters:
      "Determina el rating NEMA exigido, y el rating decide qué familias pueden siquiera " +
      "considerarse: un sistema de lazo cerrado conserva el rating del gabinete, un filterfan " +
      "que mete aire exterior no.",
    whereToFindIt:
      "En la especificación del tablero o en la placa del gabinete: Indoor es NEMA Type 12, " +
      "Outdoor es Type 3R/4, y zona de lavado a presión es Type 4/4X.",
    alternativeEvidence:
      "Si en la zona se lava con manguera o hay limpieza sanitaria con agua a presión, es " +
      "washdown aunque el gabinete esté bajo techo.",
    citation: CITATIONS.PSS_LOCATION_A_NEMA,
    antiPattern:
      "No confundir 'bajo techo' con indoor. Un gabinete bajo techo en una zona de lavado sigue " +
      "siendo washdown, y eso cambia el rating exigido.",
  },
  {
    field: "air_quality",
    whyItMatters:
      "Es el segundo eje de la matriz del catálogo. Con ambiente fresco, aire limpio manda a " +
      "filterfan y aire sucio manda a intercambiador aire/aire; el aire muy hostil manda a " +
      "air/water aunque el ambiente no sea alto.",
    whereToFindIt:
      "Mirar el propio gabinete y los de al lado: polvo acumulado en rejillas, película " +
      "aceitosa en las superficies, presencia de vapores o niebla de aceite, filtros de otros " +
      "equipos que se saturan rápido.",
    alternativeEvidence:
      "La frecuencia de cambio de los filtros de los ventiladores existentes es un buen " +
      "indicador: si se saturan en semanas, el aire no es 'limpio o poco sucio'.",
    citation: CITATIONS.MATRIZ_TECNOLOGIA,
    antiPattern:
      "No clasificar un ambiente como limpio solo porque la planta esté ordenada. Lo que cuenta " +
      "es lo que entra al gabinete: polvo, aceite en suspensión o vapores corrosivos.",
  },

  /* ---------------- Umbral 2 · shortlist de modelos ---------------- */
  {
    field: "total_dissipation_w",
    whyItMatters:
      "Es la carga que la unidad tiene que retirar, y sobre ella se aplica el margen " +
      "documentado del 10 % para llegar a la capacidad requerida. Es el bloqueante duro del " +
      "shortlist: sin este dato no se selecciona ningún modelo.",
    whereToFindIt:
      "En el datasheet de cada componente, bajo 'power loss', 'heat dissipation', 'Verlustleistung' " +
      "o 'pérdidas', expresado en watts. Para un variador, el fabricante publica la pérdida a " +
      "carga nominal, que suele ser un pequeño porcentaje de su potencia de salida.",
    alternativeEvidence:
      "Si no está la disipación total, sirve la lista de componentes con sus watts uno por uno: " +
      "se suman. Es una suma, no una estimación. El tercer camino —calcular a partir de la " +
      "temperatura medida dentro y fuera del gabinete— existe en PSS y se deriva allá.",
    citation: CITATIONS.MARGEN_10_PCT,
    antiPattern:
      "No usar la potencia nominal del motor o del variador (kW) como sustituto de su pérdida " +
      "térmica (W). Son magnitudes distintas: un variador de 22 kW no disipa 22 000 W. Si no " +
      "está el dato real, el campo queda faltante.",
  },
  {
    field: "supply_voltage",
    whyItMatters:
      "Filtra qué unidades existen y, además, la capacidad publicada varía por voltaje y " +
      "configuración: el mismo modelo no entrega el mismo valor en 230 V que en 460 V. El " +
      "propio PSS avisa de que cambia la solución final.",
    whereToFindIt:
      "En la placa del tablero o en el diagrama unifilar, en el circuito de fuerza que alimenta " +
      "el gabinete. También en el guardamotor o el interruptor de cabecera.",
    alternativeEvidence:
      "Si hay otras unidades de clima ya instaladas en la planta, su placa dice el voltaje " +
      "realmente disponible en ese punto.",
    citation: CITATIONS.PSS_VOLTAJE_BLOQUEANTE,
    antiPattern:
      "No asumir el voltaje del país. Una planta puede tener 460 V en fuerza y 230 V en " +
      "control, y la unidad se conecta a uno concreto.",
  },
  {
    field: "enclosure_dimensions_mm",
    whyItMatters:
      "La unidad tiene que caber físicamente en la cara donde va y dejar libre el recorte. Un " +
      "modelo con la capacidad correcta que no cabe no es una solución.",
    whereToFindIt:
      "Alto, ancho y fondo exteriores del gabinete, en milímetros. Están en el plano del " +
      "tablero o se miden con cinta métrica en cinco minutos.",
    alternativeEvidence:
      "La referencia del gabinete comercial (Rittal, Hoffman, etc.) permite sacar las " +
      "dimensiones exactas del catálogo del fabricante.",
    citation: CITATIONS.PSS_DIMENSIONES,
    antiPattern:
      "No dar las dimensiones interiores útiles ni las del hueco donde está montado. Lo que se " +
      "necesita son las exteriores del propio gabinete.",
  },
  {
    field: "installation",
    whyItMatters:
      "Determina qué caras quedan libres para montar la unidad —lateral, integrada o superior— " +
      "y, en PSS, la superficie efectiva de intercambio con el ambiente.",
    whereToFindIt:
      "Basta con mirar el gabinete: exento por los cuatro lados, contra pared, o encajonado en " +
      "fila entre otros gabinetes.",
    alternativeEvidence:
      "Una foto del frente y de un lateral del tablero en su sitio resuelve este campo sin " +
      "necesidad de medir nada.",
    citation: CITATIONS.PSS_INSTALACION,
    antiPattern:
      "No declarar 'exento' un gabinete que está en fila. Si los laterales están ocupados, el " +
      "montaje lateral deja de ser viable aunque la unidad quepa.",
  },
  {
    field: "housing_material",
    whyItMatters:
      "En aplicaciones washdown el material define si la unidad puede conservar el rating " +
      "4/4X: la variante washdown del DTS lleva cubierta de acero inoxidable 304. Fuera de " +
      "washdown es un dato de PSS, no un filtro del shortlist.",
    whereToFindIt:
      "En la placa o la ficha del gabinete: acero pintado (normalmente RAL 7035) o acero " +
      "inoxidable. Un imán distingue el 304 del acero al carbono pintado en la mayoría de los " +
      "casos.",
    alternativeEvidence:
      "En industria de alimento y bebida el gabinete de zona húmeda suele ser inoxidable por " +
      "requisito sanitario; confirmarlo con el pliego de la línea.",
    citation: CITATIONS.PSS_MATERIAL,
    antiPattern:
      "No deducir el material del color. Un gabinete pintado de gris claro puede ser acero al " +
      "carbono o inoxidable pintado, y en washdown la diferencia importa.",
  },
] as const;

/** Índice por nombre de campo. Lo consume la tool `guia_de_campo` (Pista C · C4). */
export const FIELD_GUIDE_BY_FIELD: Readonly<Record<string, FieldGuideEntry>> =
  Object.fromEntries(FIELD_GUIDE.map((e) => [e.field, e]));

/** Fila de un campo, o `undefined` si el campo no es uno de los ocho bloqueantes. */
export function fieldGuideFor(field: string): FieldGuideEntry | undefined {
  return FIELD_GUIDE_BY_FIELD[field];
}

/** Los ocho nombres de campo bloqueantes, en orden. */
export function blockingFieldNames(): string[] {
  return FIELD_GUIDE.map((e) => e.field);
}
