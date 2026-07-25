/**
 * El guion de la demo (§7.8), como secuencia de turnos.
 *
 * La UI corre contra esto mientras `POST /api/turn` no exista. Cada paso tiene
 * exactamente la forma que devolvera el endpoint real, asi que I4 es cambiar la
 * fuente de los turnos en `app/page.tsx` — no reescribir la vista.
 */

import { ProjectSpecSchema, emptyField, type ProjectSpec } from "../project-spec";
import type { TurnResult } from "../turn";
import {
  DECISIONS_TURNO_1,
  DECISIONS_TURNO_2,
  DISCLAIMERS,
  EMAIL_INTAKE,
  GATE_BARRANQUILLA,
  QUESTIONS_TURNO_1,
  REPLY_DATOS,
  SHORTLIST_BARRANQUILLA,
  SPEC_TURNO_1,
  SPEC_TURNO_2,
} from "./barranquilla";
import { MESSAGE_OUT_OF_SCOPE, RESPONSE_OUT_OF_SCOPE } from "./out-of-scope";

/** Ficha en blanco. Todos los campos en `missing`, que es el estado honesto
 *  antes de leer nada. */
export function emptySpec(): ProjectSpec {
  const spec = {} as Record<string, unknown>;
  for (const key of Object.keys(ProjectSpecSchema.shape)) {
    spec[key] = key === "component_list" ? null : emptyField();
  }
  return spec as ProjectSpec;
}

export interface ScriptedTurn {
  /** Lo que el cliente escribe o pega. */
  input: string;
  /** Etiqueta del boton de ejemplo precargado, si lo tiene. */
  exampleLabel?: string;
  result: TurnResult;
}

const TURNO_FUERA_DE_ALCANCE: ScriptedTurn = {
  input: MESSAGE_OUT_OF_SCOPE,
  exampleLabel: "Fuera de alcance",
  result: {
    spec: emptySpec(),
    gate: null,
    shortlist: null,
    questions: [],
    decisions: [
      {
        kind: "guardrail",
        text: "Keyword «sirenas» detectada antes de llamar al modelo. Respuesta fija, sin gastar la llamada y sin margen para improvisar.",
      },
    ],
    disclaimers: [],
    outOfScope: { keyword: "sirenas", response: RESPONSE_OUT_OF_SCOPE },
    message: {
      id: "t0-agent",
      speaker: "agent",
      text: RESPONSE_OUT_OF_SCOPE,
    },
  },
};

const TURNO_INTAKE: ScriptedTurn = {
  input: EMAIL_INTAKE,
  exampleLabel: "Correo de Barranquilla",
  result: {
    spec: SPEC_TURNO_1,
    gate: GATE_BARRANQUILLA,
    shortlist: null,
    questions: QUESTIONS_TURNO_1,
    decisions: DECISIONS_TURNO_1,
    disclaimers: DISCLAIMERS,
    message: {
      id: "t1-agent",
      speaker: "agent",
      text: `Leí el correo. A la derecha quedó la ficha: nueve campos declarados con la frase exacta que los respalda, dos inferidos con su cita de catálogo y tres que trabo hasta tenerlos.

Con tres datos —38 °C de ambiente, zona de lavado y aire muy hostil— ya te puedo dar el veredicto de tecnología, y todavía no sé la carga térmica. Necesitas **enfriamiento activo en lazo cerrado**: el catálogo dice que cuando el ambiente supera el objetivo interno hace falta cooling activo, y el Type 4/4X de la zona de lavado obliga a lazo cerrado. Un filterfan mete aire exterior y rompe el rating. Los cuatro veredictos están abajo, cada uno con su página.

Lo que **no** hice: los «2 variadores de 22 kW» no los convertí en watts disipados. Los 22 kW son el tamaño del motor, no el calor que el variador suelta dentro del gabinete. Son magnitudes distintas y esa es la cuenta que no voy a hacer.

Para llegar al modelo me faltan tres datos. Te digo dónde encontrar cada uno.`,
      provider: { id: "groq-1", model: "openai/gpt-oss-120b", latency_ms: 1820 },
      touched: [
        "project_name",
        "customer",
        "enclosure_count",
        "height_mm",
        "width_mm",
        "depth_mm",
        "internal_temp_max_c",
        "location",
        "ambient_temp_max_c",
        "installation",
        "air_quality",
      ],
    },
  },
};

const TURNO_CIERRE: ScriptedTurn = {
  input: REPLY_DATOS,
  exampleLabel: "Respuesta del cliente",
  result: {
    spec: SPEC_TURNO_2,
    gate: GATE_BARRANQUILLA,
    shortlist: SHORTLIST_BARRANQUILLA,
    questions: [],
    decisions: DECISIONS_TURNO_2,
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

/** El guion en el orden de §7.8: primero el fuera de alcance, luego el caso. */
export const DEMO_SCRIPT: ScriptedTurn[] = [
  TURNO_FUERA_DE_ALCANCE,
  TURNO_INTAKE,
  TURNO_CIERRE,
];

/** Los ejemplos precargados que se ofrecen en el composer. */
export const EXAMPLES = DEMO_SCRIPT.filter((t) => t.exampleLabel);
