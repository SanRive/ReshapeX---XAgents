import { NextResponse } from "next/server";
import { detectOutOfScope, RESPONSE_OUT_OF_SCOPE } from "@/lib/fixtures/out-of-scope";
import { providerHealth } from "@/lib/llm/providers";
import type { TurnResult } from "@/lib/turn";

/**
 * I1/I2/I3 — EL PUNTO DE INTEGRACION. QUE LO ABRA UNA SOLA PERSONA.
 *
 * Esto es el esqueleto, no la implementacion. Lo que ya corre:
 *
 *   ✅ I3 · guardrail de fuera de alcance por keywords, ANTES de llamar al LLM
 *   ✅ A2 · cadena de proveedores con rotacion de claves (lib/llm/providers.ts)
 *
 * Lo que falta, en el orden fijo de la espina determinista (§7.2). Cada paso ya
 * tiene su tipo definido y su dueño:
 *
 *   extract(msg, spec)    → sobres          · pista A · lib/extract/extract.ts
 *   validate(sobres, msg) → sobres limpios  · pista A · lib/extract/validate.ts
 *   merge(spec, limpios)  → ProjectSpec     · pista A
 *   gate(spec)            → veredictos+cita · pista B · lib/rules/gate.ts
 *   shortlist(spec)       → modelos+cita    · pista B · lib/rules/shortlist.ts
 *   loop conversacional   → prosa           · I2 · generateText + maxSteps: 5
 *   postCheck(prosa, …)   → prosa o plantilla · pista A · lib/extract/post-check.ts
 *
 * El contrato de cada uno esta en `docs/contratos-de-modulo.md`. La respuesta
 * SIEMPRE es un `TurnResult` — es lo que la UI ya consume, y respetarlo hace que
 * I4 sea cambiar una funcion en `app/page.tsx` y nada mas.
 *
 * Regla que no se rompe: las claves no salen de este proceso. Toda llamada al
 * LLM pasa por aqui; nada de `NEXT_PUBLIC_` para una API key.
 */

export const runtime = "nodejs";

interface TurnRequest {
  message: string;
  /** El spec acumulado. El estado vive en el cliente y viaja en cada turno; si
   *  los cuatro proveedores fallan, se devuelve intacto y la ficha no se mueve. */
  spec: TurnResult["spec"];
}

export async function POST(request: Request) {
  const body = (await request.json()) as TurnRequest;

  // ── I3 · guardrail determinista, antes de gastar una llamada ──────────────
  const keyword = detectOutOfScope(body.message);
  if (keyword) {
    const result: TurnResult = {
      spec: body.spec,
      gate: null,
      shortlist: null,
      questions: [],
      decisions: [
        {
          kind: "guardrail",
          text: `Keyword «${keyword}» detectada antes de llamar al modelo. Respuesta fija, sin gastar la llamada.`,
        },
      ],
      disclaimers: [],
      outOfScope: { keyword, response: RESPONSE_OUT_OF_SCOPE },
      message: {
        id: `oos-${Date.now()}`,
        speaker: "agent",
        text: RESPONSE_OUT_OF_SCOPE,
      },
    };
    return NextResponse.json(result);
  }

  // ── I1 · la espina determinista ───────────────────────────────────────────
  return NextResponse.json(
    {
      error: "not_implemented",
      detail:
        "La espina determinista (extract → validate → merge → gate → shortlist) todavía no está conectada. Ver docs/contratos-de-modulo.md.",
    },
    { status: 501 },
  );
}

/** Diagnostico del pool de claves. No devuelve ninguna clave, solo su estado. */
export async function GET() {
  return NextResponse.json({ providers: providerHealth() });
}
