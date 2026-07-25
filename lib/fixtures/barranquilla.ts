/**
 * Fixture del caso de §5 — planta de envasado, Barranquilla.
 *
 * Es el caso end-to-end ya resuelto a mano en el spec, con sus numeros
 * verificados: PD 1 350 W → required 1 485 W → 5 067 Btu/h → DTS 31X5 ⚠.
 * La pista D trabaja contra esto sin esperar a que A, B o C funcionen, y cuando
 * I1 conecte el endpoint real este mismo objeto sirve de regresion.
 *
 * ⚠ Toda `evidence` de un campo `declared` es substring LITERAL de `EMAIL_INTAKE`
 * o de `REPLY_DATOS`. Si se edita el texto del correo hay que reeditar la
 * evidencia: es exactamente lo que comprueba el validador A4.
 */

import {
  emptyField,
  requiredWatts,
  wattsToBtuh,
  type Field,
  type ProjectSpec,
} from "../project-spec";
import type {
  BlockingQuestion,
  DecisionEntry,
  FamilyVerdict,
  Shortlist,
} from "../turn";
import { CITE } from "./citations";

/* ==========================================================================
   Turno 1 — el correo tal como llega
   ========================================================================== */

export const EMAIL_INTAKE = `Buenos días,

Estamos montando una línea de llenado nueva en la planta de Barranquilla y necesito cotizar la climatización de los tableros. Son 4 gabinetes de 2000 x 800 x 600 mm, montados contra la pared del pasillo de proceso.

Cada gabinete lleva 2 variadores de 22 kW y un PLC. La zona se lava a presión al final de cada turno, así que los tableros quedan expuestos al agua. La planta opera 24/7 y en la nave hemos medido hasta 38 °C de ambiente en las horas de la tarde.

¿Qué equipo me recomiendan?

Jorge Medina — Mantenimiento, Envasadora del Caribe`;

const declared = (value: Field["value"], evidence: string): Field => ({
  status: "declared",
  value,
  evidence,
  basis: null,
  blocks: null,
});

const inferred = (value: Field["value"], basis: Field["basis"]): Field => ({
  status: "inferred",
  value,
  evidence: null,
  basis,
  blocks: null,
});

const missing = (blocks: string | null = null): Field => ({
  ...emptyField(),
  blocks,
});

/** Estado de la ficha despues de leer el correo. 6 declarados · 3 inferidos ·
 *  3 bloqueantes, tal como los cuenta §5. */
export const SPEC_TURNO_1: ProjectSpec = {
  project_name: declared(
    "Línea de llenado — planta Barranquilla",
    "una línea de llenado nueva en la planta de Barranquilla",
  ),
  customer: declared("Envasadora del Caribe", "Envasadora del Caribe"),
  enclosure_count: declared(4, "Son 4 gabinetes"),

  height_mm: declared(2000, "2000 x 800 x 600 mm"),
  width_mm: declared(800, "2000 x 800 x 600 mm"),
  depth_mm: declared(600, "2000 x 800 x 600 mm"),
  internal_temp_max_c: inferred(35, CITE.tempInterna),
  internal_temp_min_c: missing(),
  housing_material: missing(
    "Shortlist. En zona de lavado el material decide si el modelo aplica.",
  ),
  housing_color: missing(),
  supply_voltage: missing(
    "Shortlist. El rango de capacidad varía por voltaje y configuración.",
  ),

  location: declared("washdown", "La zona se lava a presión al final de cada turno"),
  ambient_temp_max_c: declared(38, "hemos medido hasta 38 °C de ambiente"),
  ambient_temp_min_c: missing(),
  // Queda como pendiente-PSS a proposito. El corpus no tiene una linea que
  // sostenga «instalacion interior → sin carga solar»; la unica cita cercana es
  // el mapeo NEMA del tab Environment, que no dice eso. Marcarlo `inferred` con
  // esa cita seria colgar una afirmacion de una fuente que no la respalda —
  // exactamente el fallo que este producto existe para no cometer.
  solar_load: missing(),
  wind_exposure: missing(),
  installation: declared(
    "wall_mounted",
    "montados contra la pared del pasillo de proceso",
  ),
  air_quality: inferred("very_harsh", CITE.matrizTecnologia),

  total_dissipation_w: missing(
    "Shortlist. Nunca se estima: 22 kW es potencia nominal del motor, no la pérdida del variador.",
  ),
  component_list: null,
  measured_temp_inside_c: missing(),
  measured_temp_outside_c: missing(),
};

/* ==========================================================================
   Turno 2 — la respuesta del cliente
   ========================================================================== */

export const REPLY_DATOS = `Revisé las hojas de los variadores: cada uno declara 650 W de pérdidas y el PLC 50 W. La alimentación en planta es 460 V trifásico, y por el lavado los gabinetes son en acero inoxidable.`;

export const SPEC_TURNO_2: ProjectSpec = {
  ...SPEC_TURNO_1,
  supply_voltage: declared(
    "400_460V_3ph",
    "La alimentación en planta es 460 V trifásico",
  ),
  housing_material: declared(
    "stainless_steel",
    "los gabinetes son en acero inoxidable",
  ),
  component_list: [
    { name: "Variador de frecuencia", w: 650, qty: 2 },
    { name: "PLC", w: 50, qty: 1 },
  ],
  // La suma la hace codigo sobre componentes declarados, no el modelo. Va como
  // `inferred` y no como `declared` porque el numero 1 350 no aparece literal en
  // ningun mensaje: el estado dice la verdad sobre su procedencia.
  total_dissipation_w: inferred(1350, CITE.pssVerificarComponentes),
};

/* ==========================================================================
   Compuerta de 4 familias — el veredicto de §5
   ========================================================================== */

export const GATE_BARRANQUILLA: FamilyVerdict[] = [
  {
    family: "cooling_unit",
    label: "DTS Cooling Units",
    verdict: "viable",
    reason:
      "El ambiente de 38 °C supera el objetivo interno de 35 °C, así que hace falta enfriamiento activo. Y el Type 4/4X que exige la zona de lavado obliga a un sistema de lazo cerrado.",
    citations: [CITE.coolingActivo, CITE.lazoCerrado, CITE.matrizAltoAmbiente],
  },
  {
    family: "air_water_hx",
    label: "PWS Air/Water Heat Exchangers",
    verdict: "conditional",
    reason:
      "La matriz del catálogo lo ubica en «High Ambient and/or Very Harsh, Dirty», que es donde cae esta instalación. Requiere agua de proceso, y el cliente no la declaró. Se reporta como alternativa, no como recomendación.",
    citations: [CITE.matrizTecnologia],
  },
  {
    family: "filterfan",
    label: "Filterfan 4.0 + Exhaust Filters",
    verdict: "rejected",
    reason:
      "El ambiente está por encima del objetivo interno, que es justo la condición que el catálogo pone como límite de la ventilación forzada. Además introduce aire exterior al gabinete y rompe el Type 4/4X.",
    citations: [CITE.conveccionNatural, CITE.lazoCerrado, CITE.pssCompuerta],
  },
  {
    family: "air_air_hx",
    label: "PKS Air/Air Heat Exchangers",
    verdict: "rejected",
    reason:
      "Un intercambiador aire/aire no puede llevar el interior por debajo de la temperatura ambiente. La matriz de la p. 2 lo ubica en «Cool Ambient», y aquí el ambiente es el problema.",
    citations: [CITE.matrizCoolAmbient, CITE.pssCompuerta],
  },
];

/* ==========================================================================
   Shortlist — required = 1 350 × 1.10 = 1 485 W = 5 067 Btu/h
   ========================================================================== */

const TOTAL_W = 1350;
const REQUIRED_W = requiredWatts(TOTAL_W); // 1 485
const REQUIRED_BTUH = wattsToBtuh(REQUIRED_W); // 5 066.8

export const SHORTLIST_BARRANQUILLA: Shortlist = {
  total_dissipation_w: TOTAL_W,
  required_w: REQUIRED_W,
  required_btuh: REQUIRED_BTUH,
  units_needed: 4,
  candidates: [
    {
      model: "DTS 31X5",
      capacity_btuh: [5000, 7000],
      voltages: ["115 V", "230 V", "400-460 V"],
      dimensions_mm: { h: 914, w: 305, d: 304 },
      mounting: "side",
      nema_available: ["12", "3R/4", "4/4X"],
      verdict: "conditional",
      reason:
        "Recomendado con verificación. El extremo bajo del rango queda 1.3 % por debajo de lo requerido, y el propio catálogo advierte que la capacidad varía por voltaje y configuración: hay que confirmar el valor a 460 V antes de cerrar. Disponible en 4/4X e inoxidable, y con 914 mm cabe de sobra en un gabinete de 2 000 mm.",
      citations: [CITE.capacidadVaria, CITE.dtsVariantes],
    },
    {
      model: "DTS 32X1",
      capacity_btuh: [7000, 8500],
      voltages: ["115 V", "230 V", "400-460 V"],
      dimensions_mm: { h: 1209, w: 395, d: 269 },
      mounting: "side",
      nema_available: ["12", "3R/4", "4/4X"],
      verdict: "conditional",
      reason:
        "Alternativa con margen, sin necesidad de verificar. Queda 38 % por encima de lo requerido en el extremo bajo del rango — aceptable, pero el catálogo advierte contra el sobredimensionamiento costoso.",
      citations: [CITE.sobredimensionar, CITE.dtsVariantes],
    },
  ],
  rejected: [
    {
      model: "DTS 31X1 SL",
      capacity_btuh: [3000, 5000],
      voltages: ["115 V", "230 V", "400-460 V"],
      dimensions_mm: { h: 914, w: 305, d: 304 },
      mounting: "side",
      nema_available: ["12", "3R/4", "4/4X"],
      verdict: "rejected",
      reason: "El techo del rango queda por debajo de lo requerido.",
      citations: [CITE.margen10],
    },
    {
      model: "DTS 31X1",
      capacity_btuh: [3000, 4000],
      voltages: ["115 V", "230 V", "400-460 V"],
      dimensions_mm: { h: 748, w: 395, d: 237 },
      mounting: "side",
      nema_available: ["12", "3R/4", "4/4X"],
      verdict: "rejected",
      reason: "Insuficiente en todo el rango.",
      citations: [CITE.margen10],
    },
    {
      model: "DTT 6301",
      capacity_btuh: [4000, 5500],
      voltages: ["115 V", "230 V", "400-460 V"],
      dimensions_mm: { h: 0, w: 0, d: 0 },
      mounting: "top",
      nema_available: ["12"],
      verdict: "rejected",
      reason:
        "Descartado por rating, no por capacidad: la serie DTT figura solo como Type 12 y la zona de lavado exige 4/4X.",
      citations: [CITE.dttSoloType12],
    },
  ],
  derating_note:
    "La capacidad publicada está referida a la base DIN 35/35 °C. El punto de operación es 38 °C de ambiente contra 35 °C internos — más severo que la condición de referencia — así que la capacidad útil real está por debajo de la nominal. El derating exacto vive en las curvas de performance del datasheet y en PSS. Por eso el DTS 31X5 queda marcado como «verificar» y no como «listo».",
};

/* ==========================================================================
   Preguntas bloqueantes — maximo 3, cada una con su razon (FIELD_GUIDE, §3.7)
   ========================================================================== */

export const QUESTIONS_TURNO_1: BlockingQuestion[] = [
  {
    field: "total_dissipation_w",
    why: "Sin la pérdida real en watts no se puede filtrar ni un modelo. Es el eje del quick selection chart.",
    where:
      "En la hoja de datos del variador, bajo «power loss» o «Verlustleistung». Suele venir en W y por modelo, no por potencia de motor.",
    alternative:
      "Si prefiere, mándeme la lista de componentes con los watts de cada uno y los sumo yo.",
    antipattern:
      "No sirve la potencia nominal del motor. Los 22 kW son el tamaño del motor, no el calor que el variador suelta dentro del gabinete: son magnitudes distintas.",
    citation: CITE.pssVerificarComponentes,
  },
  {
    field: "supply_voltage",
    why: "Cambia qué unidades aparecen en la solución y, además, la capacidad dentro del rango.",
    where: "En la placa del tablero o en el unifilar de la acometida.",
    alternative: null,
    antipattern: null,
    citation: CITE.pssVoltaje,
  },
  {
    field: "housing_material",
    why: "En zona de lavado el material decide si el modelo aplica: la variante washdown va en inoxidable.",
    where: "En la orden del fabricante del gabinete o en la placa de identificación.",
    alternative: null,
    antipattern: null,
    citation: CITE.dtsVariantes,
  },
];

/* ==========================================================================
   Log de decisiones — la prueba de que el guardrail actuo
   ========================================================================== */

export const DECISIONS_TURNO_1: DecisionEntry[] = [
  {
    kind: "extract",
    text: "9 campos declarados con su fragmento de respaldo, 2 inferidos con cita, 3 bloqueantes.",
  },
  {
    kind: "guardrail",
    text: "solar_load queda sin afirmar. El corpus no tiene una línea que sostenga «instalación interior → sin carga solar», así que va como pendiente-PSS en vez de inferido.",
  },
  {
    kind: "guardrail",
    text: "«2 variadores de 22 kW» no se convirtió en watts disipados. 22 kW es potencia nominal del motor; la pérdida del variador es otra magnitud y no está declarada. total_dissipation_w queda en missing.",
  },
  {
    kind: "default",
    text: "internal_temp_max_c = 35 °C por default documentado del catálogo.",
    citation: CITE.tempInterna,
  },
  {
    kind: "default",
    text: "air_quality = very_harsh: la zona de lavado a presión cae en la fila «Very Harsh, Dirty» de la matriz de tecnología.",
    citation: CITE.matrizTecnologia,
  },
  {
    kind: "gate",
    text: "Compuerta disparada con 3 datos (ambiente, ubicación, calidad del aire) antes de conocer la carga térmica.",
    citation: CITE.coolingActivo,
  },
  {
    kind: "gate",
    text: "location = washdown → NEMA Type 4/4X requerido.",
    citation: CITE.pssNema,
  },
];

export const DECISIONS_TURNO_2: DecisionEntry[] = [
  ...DECISIONS_TURNO_1,
  {
    kind: "extract",
    text: "Componentes declarados: 2 × 650 W (variador) + 1 × 50 W (PLC). Suma de código = 1 350 W. Suma, no estimación.",
    citation: CITE.pssVerificarComponentes,
  },
  {
    kind: "shortlist",
    text: "required_w = 1 350 × 1.10 = 1 485 W = 5 067 Btu/h, por la regla de margen del 10 %.",
    citation: CITE.margen10,
  },
  {
    kind: "shortlist",
    text: "DTT 6301 descartado por rating antes de mirar capacidad: la serie figura solo como Type 12.",
    citation: CITE.dttSoloType12,
  },
  {
    kind: "shortlist",
    text: "Verificación mecánica: gabinete contra pared → 3 caras disponibles. DTS 31X5 mide 914 mm de alto contra 2 000 mm de gabinete. Cabe. Total 4 unidades.",
  },
];

/* ==========================================================================
   Lo que no afirmamos
   ========================================================================== */

export const DISCLAIMERS: string[] = [
  "La capacidad neta a 38 / 35 °C. La publicada está referida a la base DIN 35/35 y el punto de operación es más severo.",
  "El punto exacto dentro del rango de capacidad. Varía por voltaje y configuración, y esa cifra no está publicada por modelo.",
  "El dimensionamiento certificado. La fórmula PC = PD − PR necesita el coeficiente de transmisión y la superficie efectiva del gabinete — eso lo resuelve PSS, no nosotros.",
  "La temperatura ambiente mínima, que no fue declarada y PSS sí pide.",
  "La utilización real de los variadores. Se tomaron las pérdidas declaradas en hoja de datos, que es el peor caso.",
  "Precio y coste de operación. Pfannenberg no publica lista de precios y la tarifa eléctrica es local. Lo que sí damos es la corriente en amperios por modelo, citada.",
];
