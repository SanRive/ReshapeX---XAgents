import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import {
  detectOutOfScope,
  detectSmallTalk,
  respuestaFueraDeAlcance,
} from "@/lib/fixtures/out-of-scope";
import { providerHealth, PROVIDER_CHAIN } from "@/lib/llm/providers";
import { extract } from "@/lib/extract/extract";
import {
  validateExtraction,
  sumComponentList,
  mergeSpec,
  applyDefaults,
} from "@/lib/extract/validate";
import { buildAllowedValues, postCheckProse } from "@/lib/extract/post-check";
import {
  evaluateTechnologyGate,
  evaluateCoolingUnitShortlist,
  gateThresholdMet,
  fieldGuideFor,
  CAPACITY_MARGIN_FACTOR,
  WATTS_TO_BTU_PER_HOUR,
} from "@/lib/rules";
import { engineeringCopilotTools } from "@/lib/tools/agent-tools";
import { adaptCitation, adaptGate, adaptShortlist } from "@/lib/turn/adapt-rules";
import { missingForShortlist, valueOf, type ProjectSpec } from "@/lib/project-spec";
import type { BlockingQuestion, ProviderTrace, TurnResult } from "@/lib/turn";

/** Entrada del log tal como la modela el contrato (`ProjectSpec["decision_log"]`). */
type LogEntry = ProjectSpec["decision_log"][number];

/**
 * I1/I2/I3 — EL PUNTO DE INTEGRACION. QUE LO ABRA UNA SOLA PERSONA.
 *
 * Las tres capas de §7.2, en orden fijo:
 *
 *   1. Espina determinista — el modelo NO decide el orden
 *        extract → validate → merge → sumar componentes → gate → shortlist
 *   2. Loop conversacional de SOLO LECTURA — 4 tools, ninguna escribe
 *   3. Post-check numerico sobre la prosa
 *
 * El modelo toca el estado exactamente una vez, en `extract`, y `validate` es
 * el guardia de esa puerta. Ninguna tool escribe. El brief lo ensambla codigo.
 *
 * Las claves no salen de este proceso. Nada de NEXT_PUBLIC_ para una API key.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

interface TurnRequest {
  message: string;
  /** El spec acumulado. Viaja en cada turno; si todo falla se devuelve intacto. */
  spec: ProjectSpec;
  /** Mensajes previos del cliente, para rastrear cantidades de turnos anteriores. */
  history?: string[];
}

/** Une el log del validador con lo que aporten las reglas. */
function toDecisions(entries: LogEntry[]): LogEntry[] {
  return entries;
}

/** Maximo 3 preguntas por turno (§3.3 fase 2), sacadas del FIELD_GUIDE. */
function buildQuestions(spec: ProjectSpec): BlockingQuestion[] {
  return missingForShortlist(spec)
    .slice(0, 3)
    .map((field) => {
      const g = fieldGuideFor(field);
      if (!g) {
        return {
          field,
          why: "Hace falta para cerrar el analisis.",
          where: "",
          alternative: null,
          antipattern: null,
        };
      }
      return {
        field,
        why: g.whyItMatters,
        where: g.whereToFindIt,
        alternative: g.alternativeEvidence || null,
        antipattern: g.antiPattern || null,
        citation: adaptCitation(g.citation),
      };
    });
}

const SYSTEM_AGENTE = `Eres el copiloto de ingenieria de Pfannenberg hablando con un CLIENTE que no es experto.

Tu trabajo es que el cliente entienda que hace falta y por que, para que un ingeniero de aplicacion pueda dimensionar en PSS.

REGLAS
- Los veredictos y los numeros ya estan decididos por el motor de reglas. Tu los NARRAS, no los recalculas.
- No des ninguna cifra que no venga del estado o de una herramienta. Si no la tienes, dilo.
- Nunca conviertas la potencia nominal de un motor o variador (kW) en disipacion termica (W).
- Si te preguntan algo fuera de climatizacion de gabinetes, di que lo ve el ingeniero de aplicacion.
- Castellano, directo, sin florituras. Maximo 6 frases.`;

export async function POST(request: Request) {
  const body = (await request.json()) as TurnRequest;
  const decisions: LogEntry[] = [];

  // ── Fuera de TAREA · saludo o meta-pregunta ───────────────────────────────
  // Antes que nada y sin llamar al modelo: un «hola» no es un caso tecnico y no
  // merece 16 segundos ni una llamada de extraccion.
  const smallTalk = detectSmallTalk(body.message);
  if (smallTalk) {
    const saludo: TurnResult = {
      spec: body.spec,
      gate: null,
      shortlist: null,
      questions: [],
      disclaimers: [],
      message: { id: `st-${Date.now()}`, speaker: "agent", text: smallTalk },
    };
    return NextResponse.json(saludo);
  }

  // ── I3 · guardrail determinista, ANTES de gastar una llamada ──────────────
  const keyword = detectOutOfScope(body.message);
  if (keyword) {
    const result: TurnResult = {
      spec: body.spec,
      gate: null,
      shortlist: null,
      questions: [],
      disclaimers: [],
      outOfScope: { keyword, response: respuestaFueraDeAlcance(keyword) },
      message: {
        id: `oos-${Date.now()}`,
        speaker: "agent",
        text: respuestaFueraDeAlcance(keyword),
      },
    };
    return NextResponse.json(result);
  }

  // ── I1 · CAPA 1 · la espina determinista ──────────────────────────────────
  let spec = body.spec;
  let trace: ProviderTrace | undefined;

  try {
    const extraction = await extract(body.message, spec);
    trace = extraction.trace;

    const validated = validateExtraction(extraction.raw, body.message);
    decisions.push(...toDecisions(validated.log));

    // Fusion, NO spread: el modelo re-extrae solo del mensaje nuevo, asi que
    // todo lo que no aparezca ahi vuelve como missing. Un spread borraria lo que
    // el cliente ya declaro en turnos anteriores.
    const merged = mergeSpec(spec, validated.spec);

    // La conversacion acumulada: las cantidades suelen venir de un turno previo.
    const conversacion = [...(body.history ?? []), body.message].join("\n");
    const summed = sumComponentList(merged, conversacion);
    decisions.push(...toDecisions(summed.log));

    // Los defaults documentados los aplica CODIGO, no el modelo: un valor que
    // cambia entre ejecuciones identicas no es un default, es azar.
    const conDefaults = applyDefaults(summed.spec);
    decisions.push(...toDecisions(conDefaults.log));

    spec = { ...spec, ...conDefaults.spec } as ProjectSpec;
  } catch (err) {
    // Fallaron todos los proveedores. El estado NO se toca y la ficha no se mueve.
    const detalle = err instanceof Error ? err.message : String(err);
    const degradado: TurnResult = {
      spec: body.spec,
      gate: null,
      shortlist: null,
      questions: buildQuestions(body.spec),
      disclaimers: [],
      message: {
        id: `err-${Date.now()}`,
        speaker: "system",
        text: `No pude leer ese mensaje: ningun proveedor respondio. Tu ficha sigue intacta, vuelve a intentarlo. (${detalle})`,
      },
    };
    return NextResponse.json(degradado);
  }

  // Derivados: conversion de unidades y margen citado. Codigo puro, nunca el modelo.
  const totalW = valueOf(spec.total_dissipation_w) as number | undefined;
  spec = {
    ...spec,
    derived: {
      required_w: totalW === undefined ? null : Math.round(totalW * CAPACITY_MARGIN_FACTOR * 100) / 100,
      required_capacity_btuh:
        totalW === undefined ? null : Math.round(totalW * CAPACITY_MARGIN_FACTOR * WATTS_TO_BTU_PER_HOUR),
      nema_required: spec.derived?.nema_required ?? null,
      available_mounting_faces: spec.derived?.available_mounting_faces ?? null,
    },
    decision_log: spec.decision_log ?? [],
  };

  // Compuerta: corre en cuanto hay 3 datos, ANTES de conocer la carga termica.
  const gate = gateThresholdMet(spec) ? adaptGate(evaluateTechnologyGate(spec)) : null;
  if (gate) {
    decisions.push({ field: "gate", action: "accepted", reason: `Compuerta resuelta: ${gate.length} familias evaluadas.`, proposed: null });
  }

  const shortlistRaw = evaluateCoolingUnitShortlist(spec);
  const enclosures = (valueOf(spec.enclosure_count) as number | undefined) ?? 1;
  const shortlist = adaptShortlist(shortlistRaw, enclosures);
  if (shortlist) {
    decisions.push({
      field: "shortlist",
      action: "accepted",
      reason: `Shortlist con ${shortlist.candidates.length} candidatos y ${shortlist.rejected.length} descartados.`,
      proposed: null,
    });
  }

  const questions = buildQuestions(spec);

  // ── I2 · CAPA 2 · loop conversacional de SOLO LECTURA ─────────────────────
  let prose = "";
  const toolResults: string[] = [];

  try {
    const cfg = PROVIDER_CHAIN[0]!;
    const key = process.env.GROQ_API_KEYS?.split(",")[0] ?? process.env.GROQ_API_KEY ?? "";
    const provider = createOpenAI({ apiKey: key, baseURL: cfg.baseURL });

    const res = await generateText({
      model: provider(cfg.model),
      system: SYSTEM_AGENTE,
      prompt:
        `ESTADO VALIDADO:\n${JSON.stringify(spec)}\n\n` +
        `VEREDICTOS DE LA COMPUERTA:\n${JSON.stringify(gate)}\n\n` +
        `LO QUE FALTA:\n${JSON.stringify(questions)}\n\n` +
        `MENSAJE DEL CLIENTE:\n${body.message}`,
      tools: engineeringCopilotTools,
      // Tope duro: una demo colgada es peor que una degradada.
      stopWhen: ({ steps }) => steps.length >= 5,
    });

    prose = res.text;
    for (const step of res.steps) {
      for (const tr of step.toolResults ?? []) {
        toolResults.push(JSON.stringify(tr));
        decisions.push({ field: "tool", action: "accepted", reason: `Herramienta consultada: ${tr.toolName}`, proposed: null });
      }
    }
  } catch {
    // Si el loop falla, la espina ya produjo todo lo que importa. Se narra con
    // plantilla: ficha, compuerta y shortlist siguen siendo validos.
    prose = "";
  }

  // ── CAPA 3 · post-check numerico ──────────────────────────────────────────
  const rechazadas = gate?.filter((g) => g.verdict === "rejected").map((g) => g.label) ?? [];
  const plantilla = gate
    ? `Con lo que me has contado ya puedo descartar tecnologias${
        rechazadas.length > 0 ? `: ${rechazadas.join(", ")} quedan fuera` : ""
      }.${questions.length > 0 ? ` Para cerrar el equipo me falta: ${questions.map((q) => q.field).join(", ")}.` : ""}`
    : "Necesito tres datos para poder descartar tecnologias: la temperatura ambiente maxima, si el tablero esta en interior, a la intemperie o en zona de lavado, y como de sucio es el entorno.";

    // La conversacion del cliente entra como fuente legitima: el agente tiene que
  // poder repetirle sus propias cifras («esos 22 kW son potencia nominal, no
  // disipacion») sin que el guardrail lo confunda con inventarlas.
  const dichoPorElCliente = [...(body.history ?? []), body.message].join("\n");
  const check = postCheckProse(
    prose || plantilla,
    buildAllowedValues(spec, toolResults, dichoPorElCliente),
    plantilla,
  );
  if (check.substituted) {
    decisions.push({
      field: "post_check",
      action: "degraded",
      reason: `Post-check numerico: respuesta sustituida por contener cifras sin respaldo (${check.offenders
        .map((o) => o.text)
        .join(", ")}).`,
      proposed: check.offenders.map((o) => o.text).join(", "),
    });
  }

  // El log de decisiones viaja dentro del spec: es la prueba de que el
  // guardrail actuo, y de ahi lo lee el generador de brief.
  const result: TurnResult = {
    spec: {
      ...spec,
      decision_log: [...(spec.decision_log ?? []), ...decisions],
    },
    gate,
    shortlist,
    questions,
    disclaimers: shortlistRaw.notAsserted,
    message: {
      id: `t-${Date.now()}`,
      speaker: "agent",
      text: check.safe,
      provider: trace,
      postCheckReplaced: check.substituted,
    },
  };

  return NextResponse.json(result);
}

/** Diagnostico del pool de claves. No devuelve ninguna clave, solo su estado. */
export async function GET() {
  return NextResponse.json({ providers: providerHealth() });
}
