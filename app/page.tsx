"use client";

import { useMemo, useState } from "react";
import { Chat, type Exchange } from "@/components/chat";
import { EngineerView } from "@/components/engineer-view";
import { Ficha } from "@/components/ficha";
import { SiteHeader, type View } from "@/components/site-header";
import { emptySpec, FIELD_KEYS, type AnyField, type ProjectSpec } from "@/lib/project-spec";
import { EXAMPLES } from "@/lib/demo/turns";
import {
  FUERA_DE_ALCANCE_RESPUESTA,
  detectOutOfScope,
} from "@/lib/fixtures/out-of-scope";
import type { TurnResult } from "@/lib/turn";

/**
 * D1 + I4 — la única ruta, conectada al pipeline real.
 *
 * Dos vistas sobre el mismo estado: el cliente conversa y ve su ficha llenarse;
 * el ingeniero recibe el brief. Un toggle, sin routing.
 *
 * Cada turno va a `POST /api/turn`, que corre la espina determinista completa
 * (extract → validate → merge → gate → shortlist), el loop de solo lectura y el
 * post-check numérico. Aquí no se decide nada: se pinta lo que devuelve.
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

    // El guardrail de fuera de alcance también corre AQUÍ, no solo en el
    // servidor. Duplicarlo es deliberado: es instantáneo, funciona sin red, y
    // es el primer paso de la demo. Si el wifi del venue cae, esto sigue en pie.
    const keyword = detectOutOfScope(input);
    if (keyword) {
      pushTurn(input, outOfScopeTurn(keyword, spec));
      setPending(false);
      return;
    }

    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: input,
          spec,
          // Los mensajes previos del cliente. Sin esto, una cantidad declarada
          // en un turno anterior («2 variadores») no es rastreable cuando en el
          // turno siguiente llegan las pérdidas, y la suma se bloquea.
          history: history.map((h) => h.input),
        }),
      });

      const turn = (await res.json()) as TurnResult;
      // `touched` es cosa de la vista: qué campos cambiaron para animarlos.
      // El servidor no tiene por qué saber cómo se pinta.
      pushTurn(input, { ...turn, message: { ...turn.message, touched: diffFields(spec, turn.spec) } });
    } catch {
      // Red caída o servidor muerto. El estado NO se toca: la ficha se queda
      // como estaba y se dice la verdad, en vez de inventar un turno.
      pushTurn(input, offlineTurn(spec));
    } finally {
      setPending(false);
    }
  }

  function pushTurn(input: string, turn: TurnResult) {
    setHistory((h) => [...h, { id: `x${h.length}`, input, turn }]);
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

/** Qué campos cambiaron de estado este turno. Solo sirve para animarlos. */
function diffFields(previo: ProjectSpec, nuevo: ProjectSpec): string[] {
  return FIELD_KEYS.filter((k) => {
    const a = previo[k] as AnyField | undefined;
    const b = nuevo[k] as AnyField | undefined;
    return a?.status !== b?.status || a?.value !== b?.value;
  });
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

/** El servidor no respondió. Se dice la verdad y el estado se queda intacto:
 *  inventar un turno aquí sería justo lo que este producto existe para no hacer. */
function offlineTurn(spec: ProjectSpec): TurnResult {
  return {
    spec,
    gate: null,
    shortlist: null,
    questions: [],
    disclaimers: [],
    message: {
      id: `off-${Date.now()}`,
      speaker: "system",
      text: `No pude contactar con el servidor, así que no toco tu ficha: sigue exactamente como estaba.

El guardrail de fuera de alcance sí funciona sin red — es código determinista y corre en esta pantalla. Pruébelo pidiendo sirenas, un chiller o un calefactor.

Vuelva a enviar el mensaje cuando haya conexión.`,
    },
  };
}
