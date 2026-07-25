/**
 * El guion de la demo (§7.8), como secuencia de turnos — pista D.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ ES ESTO Y QUÉ NO
 *
 * El turno 1 sale ENTERO del fixture del contrato (`lib/fixtures/`). No se toca.
 *
 * Lo que se añade aquí es lo que todavía no existe: el estado del turno 2, los
 * veredictos de la compuerta y el shortlist. Eso es salida del motor de reglas
 * (pista B) y de la extracción (pista A). Vive en `lib/demo/` —no en
 * `lib/fixtures/`— precisamente para que se vea que es andamio de la UI y no
 * parte del contrato. Cuando B y A aterricen, este archivo se borra y
 * `app/page.tsx` llama al endpoint.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  emptySpec,
  type ProjectSpec,
} from "../project-spec";
import type {
  BlockingQuestion,
  FamilyVerdict,
  Shortlist,
  TurnResult,
} from "../turn";
import { BARRANQUILLA_INPUT, BARRANQUILLA_SPEC } from "../fixtures/barranquilla";
import {
  FUERA_DE_ALCANCE_INPUT,
  FUERA_DE_ALCANCE_RESPUESTA,
  FUERA_DE_ALCANCE_SPEC,
} from "../fixtures/out-of-scope";
import { CITE } from "./citations";

/* ==========================================================================
   Turno 2 — la respuesta del cliente. PENDIENTE de pista A.
   ========================================================================== */

export const RESPUESTA_CLIENTE = `Revisé las hojas de datos: cada variador declara 650 W de pérdidas y el PLC 50 W. La alimentación en planta es 460 V trifásico y, por el lavado, los gabinetes son en acero inoxidable.`;

const TOTAL_W = 2 * 650 + 50; // 1 350
const REQUIRED_W = TOTAL_W * 1.1; // 1 485
const REQUIRED_BTUH = REQUIRED_W * 3.412; // 5 066.8

export const SPEC_TURNO_2: ProjectSpec = {
  ...BARRANQUILLA_SPEC,

  supply_voltage: {
    status: "declared",
    value: "400_460V_3ph",
    evidence: "La alimentación en planta es 460 V trifásico",
    basis: null,
  },
  housing_material: {
    status: "declared",
    value: "stainless_steel",
    evidence: "los gabinetes son en acero inoxidable",
    basis: null,
  },
  component_list: [
    // Cada línea con su fragmento literal, y sus DOS cifras dentro de él.
    // Comprobarlas contra la conversación entera no basta: el «4» de
    // «4 gabinetes» validaría un qty:4 de variadores que nadie declaró.
    // La cantidad viene del correo inicial; las pérdidas, de la respuesta.
    {
      name: "Variador de frecuencia",
      w: 650,
      qty: 2,
      evidence: "2 variadores de 22 kW",
    },
    { name: "PLC", w: 50, qty: 1, evidence: "y un PLC" },
  ],
  /**
   * El camino alterno de §3.5: hay lista de componentes con W declarados, así
   * que se SUMAN. Suma, no estimación.
   *
   * ⚠️ PISTA A: el 1 350 no aparece literal en ningún mensaje, así que la regla
   * de «los dígitos de value tienen que estar en evidence» lo degradaría. El
   * camino de la suma tiene que quedar exento en `validate.ts` —es código quien
   * escribe el valor, no el modelo— y por eso el contrato ya trae la acción
   * `summed` en el decision_log. Si se decide al revés, este campo pasa a
   * `missing` y el shortlist no sale.
   */
  total_dissipation_w: {
    status: "declared",
    value: TOTAL_W,
    evidence: "cada variador declara 650 W de pérdidas y el PLC 50 W",
    basis: null,
  },

  derived: {
    ...BARRANQUILLA_SPEC.derived,
    required_w: REQUIRED_W,
    required_capacity_btuh: REQUIRED_BTUH,
  },

  decision_log: [
    ...BARRANQUILLA_SPEC.decision_log,
    {
      field: "total_dissipation_w",
      action: "summed",
      reason:
        "Lista de componentes declarada: 2 × 650 W (variador) + 1 × 50 W (PLC) = 1 350 W. La suma la hace código sobre valores declarados; no se estimó nada.",
      proposed: null,
    },
    {
      field: "supply_voltage",
      action: "accepted",
      reason:
        "460 V trifásico declarado. El catálogo advierte que la capacidad varía por voltaje, así que este dato entra al filtro del shortlist.",
      proposed: null,
    },
    {
      field: "housing_material",
      action: "accepted",
      reason:
        "Acero inoxidable declarado. En washdown decide la elegibilidad: solo los modelos con variante 4/4X en inoxidable sobreviven.",
      proposed: null,
    },
  ],
};

/* ==========================================================================
   Compuerta de 4 familias — salida de pista B (§4.1, §5)
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

export const SHORTLIST_BARRANQUILLA: Shortlist = {
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
   Preguntas bloqueantes — FIELD_GUIDE, pendiente de pista B (B5)
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
   Lo que no afirmamos
   ========================================================================== */

export const DISCLAIMERS: string[] = [
  "La capacidad neta a 38 / 35 °C. La publicada está referida a la base DIN 35/35 y el punto de operación es más severo.",
  "El punto exacto dentro del rango de capacidad. Varía por voltaje y configuración, y esa cifra no está publicada por modelo.",
  "El dimensionamiento certificado. La fórmula PC = PD − PR necesita el coeficiente de transmisión y la superficie efectiva del gabinete — eso lo resuelve PSS, no nosotros.",
  "La temperatura ambiente mínima y la carga solar, que no fueron declaradas y PSS sí pide.",
  "La utilización real de los variadores. Se tomaron las pérdidas declaradas en hoja de datos, que es el peor caso.",
  "Precio y coste de operación. Pfannenberg no publica lista de precios y la tarifa eléctrica es local. Lo que sí damos es la corriente en amperios por modelo, citada.",
];

/* ==========================================================================
   El guion
   ========================================================================== */

export interface ScriptedTurn {
  input: string;
  exampleLabel?: string;
  result: TurnResult;
}

const TURNO_FUERA_DE_ALCANCE: ScriptedTurn = {
  input: FUERA_DE_ALCANCE_INPUT,
  exampleLabel: "Fuera de alcance",
  result: {
    spec: FUERA_DE_ALCANCE_SPEC,
    gate: null,
    shortlist: null,
    questions: [],
    disclaimers: [],
    outOfScope: { keyword: "sirenas", response: FUERA_DE_ALCANCE_RESPUESTA },
    message: {
      id: "t0-agent",
      speaker: "agent",
      text: FUERA_DE_ALCANCE_RESPUESTA,
    },
  },
};

const TURNO_INTAKE: ScriptedTurn = {
  input: BARRANQUILLA_INPUT,
  exampleLabel: "Correo de Barranquilla",
  result: {
    spec: BARRANQUILLA_SPEC,
    gate: GATE_BARRANQUILLA,
    shortlist: null,
    questions: QUESTIONS_TURNO_1,
    disclaimers: DISCLAIMERS,
    message: {
      id: "t1-agent",
      speaker: "agent",
      text: `Leí el correo. A la derecha quedó la ficha: nueve campos declarados con la frase exacta que los respalda, dos con default citado del catálogo, y tres que trabo hasta tenerlos.

Con tres datos —38 °C de ambiente, zona de lavado y aire muy hostil— ya te puedo dar el veredicto de tecnología, y todavía no sé la carga térmica. Necesitas **enfriamiento activo en lazo cerrado**: el catálogo dice que cuando el ambiente supera el objetivo interno hace falta cooling activo, y el Type 4/4X de la zona de lavado obliga a lazo cerrado. Un filterfan mete aire exterior y rompe el rating. Los cuatro veredictos están abajo, cada uno con su página.

Lo que **no** hice: los «dos variadores de 22 kW» no los convertí en watts disipados. Los 22 kW son el tamaño del motor, no el calor que el variador suelta dentro del gabinete. El log de decisiones lo deja por escrito — se propuso 22 000 y se degradó.

Para llegar al modelo me faltan tres datos. Te digo dónde encontrar cada uno.`,
      provider: { id: "groq-1", model: "openai/gpt-oss-120b", latency_ms: 1820 },
      touched: [
        "project_name",
        "enclosure_count",
        "height_mm",
        "width_mm",
        "depth_mm",
        "internal_temp_max_c",
        "housing_color",
        "location",
        "ambient_temp_max_c",
        "installation",
        "air_quality",
      ],
    },
  },
};

const TURNO_CIERRE: ScriptedTurn = {
  input: RESPUESTA_CLIENTE,
  exampleLabel: "Respuesta del cliente",
  result: {
    spec: SPEC_TURNO_2,
    gate: GATE_BARRANQUILLA,
    shortlist: SHORTLIST_BARRANQUILLA,
    questions: [],
    disclaimers: DISCLAIMERS,
    message: {
      id: "t2-agent",
      speaker: "agent",
      text: `Cierro los dos umbrales. La suma la hago yo sobre lo que declaraste: 2 × 650 W del variador más 50 W del PLC son 1 350 W por gabinete. Con la regla de margen del 10 % del catálogo quedan 1 485 W, que son 5 067 Btu/h de capacidad requerida.

Dos modelos pasan y tres quedan fuera, con la razón de cada descarte. El **DTS 31X5** es el ajustado: su extremo bajo queda 1.3 % por debajo de lo requerido, y como el catálogo advierte que la capacidad varía por voltaje y configuración, hay que confirmar el valor a 460 V antes de cerrar. Por eso va como «verificar» y no como «listo».

Hay una nota que importa más que el modelo: la capacidad publicada está referida a la base DIN 35/35 °C, y tu punto de operación es 38 contra 35 — más severo que la referencia. La capacidad útil real está por debajo de la nominal. El derating exacto lo resuelve PSS.

El brief ya está armado. Pasa a **vista ingeniero** para verlo completo y descargarlo.`,
      provider: {
        id: "mistral-1",
        model: "mistral-medium-3.5",
        latency_ms: 3310,
        fell_back_from: ["groq-1", "groq-2"],
      },
      touched: ["supply_voltage", "housing_material", "total_dissipation_w"],
    },
  },
};

/** El orden de §7.8: primero el fuera de alcance, luego el caso. */
export const DEMO_SCRIPT: ScriptedTurn[] = [
  TURNO_FUERA_DE_ALCANCE,
  TURNO_INTAKE,
  TURNO_CIERRE,
];

export const EXAMPLES = DEMO_SCRIPT.filter((t) => t.exampleLabel);

/** Ficha en blanco. Delega en el contrato: no se duplica el constructor. */
export { emptySpec };
