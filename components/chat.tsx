"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ProviderTrace } from "@/lib/turn";
import type { ExtractedSpec } from "@/lib/project-spec";
import { evidenceStrings, segmentByEvidence } from "@/lib/highlight";
import type { ScriptedTurn } from "@/lib/demo/turns";
import { BlockingQuestions } from "./blocking-questions";
import { GateVerdicts } from "./gate-verdicts";
import { ShortlistTable } from "./shortlist-table";

/**
 * D3 — el chat.
 *
 * La conversacion no es decoracion alrededor del motor: es donde el cliente ve
 * su propia frase convertirse en dato. Por eso el mensaje del cliente lleva la
 * evidencia subrayada in situ, y los artefactos del turno —compuerta, preguntas,
 * shortlist— se intercalan en el hilo en vez de vivir en una pestaña aparte.
 *
 * El indicador de proveedor va debajo de cada respuesta. El fallback es visible,
 * no silencioso: si groq se cae y contesta mistral, se ve.
 */

export interface Exchange {
  id: string;
  input: string;
  turn: ScriptedTurn["result"];
}

export function Chat({
  history,
  pending,
  examples,
  onSend,
}: {
  history: Exchange[];
  pending: boolean;
  examples: { label: string; input: string }[];
  onSend: (input: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const streamRef = useRef<HTMLDivElement>(null);

  // Se mueve el scroll del panel, no el de la ventana: `scrollIntoView` arrastra
  // a todos los ancestros scrollables y en movil se lleva la pagina entera.
  useEffect(() => {
    const pane = streamRef.current;
    if (!pane) return;
    pane.scrollTo({ top: pane.scrollHeight, behavior: "smooth" });
  }, [history.length, pending]);

  function submit() {
    const value = draft.trim();
    if (!value || pending) return;
    onSend(value);
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div ref={streamRef} className="scroll-pane min-h-0 flex-1 pr-1">
        {history.length === 0 ? (
          <div className="grid h-full place-items-center">
            <Intake />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {history.map((x) => (
              <Fragment key={x.id}>
                <ClientBubble text={x.input} spec={x.turn.spec} />
                <AgentTurn turn={x.turn} />
              </Fragment>
            ))}
          </div>
        )}
        {pending && <Thinking />}
      </div>

      <div className="shrink-0">
        <label htmlFor="composer" className="sr-only">
          Mensaje para el copiloto
        </label>
        <textarea
          id="composer"
          className="composer"
          rows={3}
          value={draft}
          placeholder="Pegue el correo del cliente tal como llegó, sin ordenarlo."
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-solid"
            onClick={submit}
            disabled={pending || draft.trim().length === 0}
          >
            Enviar
            <span className="text-[0.625rem] opacity-60">⌘↵</span>
          </button>
          {examples.map((ex) => (
            <button
              key={ex.label}
              type="button"
              className="btn btn-quiet"
              disabled={pending}
              onClick={() => setDraft(ex.input)}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */

function Intake() {
  return (
    <div className="plate px-5 py-6">
      <span className="u-eyebrow">Fase 0 · intake</span>
      <h2 className="u-nameplate mt-2 text-[1.375rem] leading-[1.08]">
        Pegue el correo
        <br />
        tal como llegó
      </h2>
      <p className="mt-3 max-w-[46ch] text-[0.875rem] leading-relaxed text-[var(--color-ink-muted)]">
        Sin ordenarlo, sin traducirlo y sin completar lo que falta. Lo desordenado
        es la entrada real, y lo que falta es justamente lo que hay que descubrir.
      </p>
      <p className="mt-3 max-w-[46ch] text-[0.875rem] leading-relaxed text-[var(--color-ink-muted)]">
        A la derecha se va llenando la ficha. Cada valor aparece con la frase
        exacta que lo respalda, o con la cita del catálogo si fue inferido, o en
        rojo con la decisión que traba si no está.
      </p>
      <p className="mt-4 text-[0.8125rem] text-[var(--color-ink-faint)]">
        Los dos ejemplos de abajo cargan casos reales del expediente.
      </p>
    </div>
  );
}

function ClientBubble({ text, spec }: { text: string; spec: ExtractedSpec }) {
  const segments = segmentByEvidence(text, evidenceStrings(spec));

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="u-eyebrow">Cliente</span>
      <div className="bubble bubble-client max-w-[52ch] whitespace-pre-wrap">
        {segments.map((s, i) =>
          s.marked ? (
            <mark key={i} className="evidence bg-transparent text-inherit">
              {s.text}
            </mark>
          ) : (
            <Fragment key={i}>{s.text}</Fragment>
          ),
        )}
      </div>
    </div>
  );
}

function AgentTurn({ turn }: { turn: ScriptedTurn["result"] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="u-eyebrow">Copiloto</span>
        <div className="bubble bubble-agent max-w-[62ch]">
          <Prose text={turn.message.text} />
          {turn.message.postCheckReplaced && (
            <p className="receipt receipt-inferred mt-2">
              El post-check numérico encontró una cifra sin respaldo en esta
              respuesta. Se sustituyó por la narración plantilla de los veredictos.
            </p>
          )}
        </div>
        {turn.message.provider && <ProviderBadge trace={turn.message.provider} />}
        {turn.outOfScope && (
          <p className="mt-1 text-[0.6875rem] text-[var(--color-ink-faint)]">
            Guardrail determinista · keyword «{turn.outOfScope.keyword}» ·
            respondido sin llamar al modelo
          </p>
        )}
      </div>

      {turn.gate && <GateVerdicts verdicts={turn.gate} />}
      {turn.questions.length > 0 && (
        <BlockingQuestions questions={turn.questions} />
      )}
      {turn.shortlist && (
        <ShortlistTable shortlist={turn.shortlist} spec={turn.spec} />
      )}
    </div>
  );
}

function ProviderBadge({ trace }: { trace: ProviderTrace }) {
  return (
    <p className="u-datum text-[0.6875rem] text-[var(--color-ink-faint)]">
      <span className="text-[var(--color-water-deep)]">{trace.id}</span> ·{" "}
      {trace.model} · {(trace.latency_ms / 1000).toFixed(1)} s
      {trace.fell_back_from?.length ? (
        <span className="text-[var(--color-inferred)]">
          {" "}
          · tras fallar {trace.fell_back_from.join(", ")}
        </span>
      ) : null}
    </p>
  );
}

function Thinking() {
  return (
    <p className="u-eyebrow mt-4">
      Extrayendo · validando evidencia · corriendo compuerta…
    </p>
  );
}

/** Markdown minimo: parrafos y **negrita**. No hay mas sintaxis en las
 *  respuestas del agente, y meter una libreria entera por dos reglas no se
 *  paga. */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split("\n\n").map((para, i) => (
        <p key={i} className={i > 0 ? "mt-2.5" : undefined}>
          {para.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) =>
            chunk.startsWith("**") && chunk.endsWith("**") ? (
              <strong key={j} className="font-medium">
                {chunk.slice(2, -2)}
              </strong>
            ) : (
              <Fragment key={j}>{chunk}</Fragment>
            ),
          )}
        </p>
      ))}
    </>
  );
}
