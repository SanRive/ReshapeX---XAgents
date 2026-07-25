"use client";

import { useMemo, useState } from "react";
import { Chat, type Exchange } from "@/components/chat";
import { EngineerView } from "@/components/engineer-view";
import { Ficha } from "@/components/ficha";
import { SiteHeader, type View } from "@/components/site-header";
import { emptySpec, type ProjectSpec } from "@/lib/project-spec";
import { DEMO_SCRIPT, EXAMPLES, type ScriptedTurn } from "@/lib/demo/turns";
import {
  FUERA_DE_ALCANCE_RESPUESTA,
  detectOutOfScope,
} from "@/lib/fixtures/out-of-scope";
import type { TurnResult } from "@/lib/turn";

/**
 * D1 — la única ruta.
 *
 * Dos vistas sobre el mismo estado: el cliente conversa y ve su ficha llenarse;
 * el ingeniero recibe el brief. Un toggle, sin routing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTADO DE INTEGRACIÓN (I4 — la hace D, no quien integra)
 *
 * Hoy los turnos salen de `lib/demo/turns.ts`. Para conectar el pipeline real
 * basta cambiar el cuerpo de `runTurn` por:
 *
 *   const res = await fetch("/api/turn", {
 *     method: "POST",
 *     headers: { "content-type": "application/json" },
 *     body: JSON.stringify({ message: input, spec }),
 *   });
 *   const turn: TurnResult = await res.json();
 *
 * `TurnResult` ya es la forma que devuelve el endpoint y `spec` ya es el
 * `ProjectSpec` del contrato. Ningún componente cambia.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export default function Page() {
  const [view, setView] = useState<View>("cliente");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [pending, setPending] = useState(false);

  const blank = useMemo(emptySpec, []);
  const last = history.at(-1)?.turn ?? null;
  const spec = last?.spec ?? blank;
  const touched = last?.message.touched ?? [];
  const briefReady = Boolean(last?.gate);

  async function runTurn(input: string) {
    setPending(true);

    // El guardrail de fuera de alcance es código determinista y corre ANTES de
    // cualquier llamada al modelo. Funciona sobre entrada libre, no solo sobre
    // el ejemplo precargado: un juez puede escribir lo que quiera y sigue en pie.
    const keyword = detectOutOfScope(input);
    const scripted = matchScript(input);

    await sleep(keyword ? 180 : 700);

    const turn: TurnResult = keyword
      ? outOfScopeTurn(keyword, spec)
      : (scripted?.result ?? notWiredTurn(spec));

    setHistory((h) => [...h, { id: `x${h.length}`, input, turn }]);
    setPending(false);
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:min-h-0">
      <SiteHeader view={view} onView={setView} briefReady={briefReady} />

      {view === "cliente" ? (
        <main className="grid flex-1 gap-4 p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-5 lg:p-5">
          <section
            className="flex min-h-0 flex-col lg:h-full"
            aria-label="Conversación"
          >
            <Chat
              history={history}
              pending={pending}
              examples={EXAMPLES.map((e) => ({
                label: e.exampleLabel!,
                input: e.input,
              }))}
              onSend={runTurn}
            />
          </section>

          <aside className="flex min-h-0 flex-col lg:h-full" aria-label="Ficha">
            <Ficha spec={spec} touched={touched} />
          </aside>
        </main>
      ) : (
        <main className="scroll-pane flex-1 p-4 lg:min-h-0 lg:p-5">
          {last ? (
            <EngineerView turn={last} />
          ) : (
            <EmptyBrief onBack={() => setView("cliente")} />
          )}
        </main>
      )}
    </div>
  );
}

/* ========================================================================== */

function EmptyBrief({ onBack }: { onBack: () => void }) {
  return (
    <div className="plate mx-auto max-w-[42rem] px-6 py-8">
      <span className="u-eyebrow">Sin caso cargado</span>
      <h2 className="u-nameplate mt-2 text-[1.375rem]">
        El brief se arma
        <br />
        con la conversación
      </h2>
      <p className="mt-3 text-[0.875rem] leading-relaxed text-[var(--color-ink-muted)]">
        Esta vista lee el mismo estado que la ficha del cliente. En cuanto haya un
        caso leído, aquí aparece el brief mapeado a los tabs de PSS, el shortlist
        con sus descartes y el log de decisiones.
      </p>
      <button type="button" className="btn btn-quiet mt-5" onClick={onBack}>
        Volver a la conversación
      </button>
    </div>
  );
}

/* ========================================================================== */

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function matchScript(input: string): ScriptedTurn | undefined {
  const needle = norm(input);
  return DEMO_SCRIPT.find((t) => norm(t.input) === needle);
}

function outOfScopeTurn(keyword: string, spec: ProjectSpec): TurnResult {
  return {
    // El spec no se toca: el guardrail corta antes de extraer nada.
    spec,
    gate: null,
    shortlist: null,
    questions: [],
    disclaimers: [],
    outOfScope: { keyword, response: FUERA_DE_ALCANCE_RESPUESTA },
    message: {
      id: `oos-${Date.now()}`,
      speaker: "agent",
      text: FUERA_DE_ALCANCE_RESPUESTA,
    },
  };
}

/** Entrada libre que no es fuera de alcance y no coincide con el guion. Se dice
 *  la verdad: la extracción todavía no está conectada. Inventar una ficha aquí
 *  sería justo lo que este producto existe para no hacer. */
function notWiredTurn(spec: ProjectSpec): TurnResult {
  return {
    spec,
    gate: null,
    shortlist: null,
    questions: [],
    disclaimers: [],
    message: {
      id: `nw-${Date.now()}`,
      speaker: "agent",
      text: `Recibí el mensaje, pero la extracción todavía no está conectada a esta vista: **POST /api/turn** está definido y sin implementar.

Lo que sí corre ahora mismo es el guardrail de fuera de alcance, que es código determinista — pruébelo pidiendo sirenas, un chiller o un calefactor.

Para ver el caso completo, cargue **Correo de Barranquilla** con el botón de abajo y luego **Respuesta del cliente**.`,
    },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
