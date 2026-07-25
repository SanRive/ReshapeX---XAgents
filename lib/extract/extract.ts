import "server-only";

import { z } from "zod";

import { ExtractedSpecSchema, DEFAULTS, type ExtractedSpec, type ProjectSpec } from "../project-spec";
import { withProviderFallback, ProviderCallError } from "../llm/providers";
import type { ProviderTrace } from "../turn";

/**
 * A3 — EXTRACCION ESTRUCTURADA.
 *
 * Texto libre → `ProjectSpec` tipado. Es la UNICA puerta por la que el modelo
 * escribe en el estado, y el validador (A4) es el guardia de esa puerta: nada
 * de lo que salga de aqui se da por bueno hasta pasar por `validate()`.
 *
 * Se llama con schema JSON estricto (`response_format: json_schema`), que es el
 * modo que los dos proveedores verificados aceptan. Firma fijada en
 * `docs/contratos-de-modulo.md`.
 */

/* ==========================================================================
   El schema que se le manda al proveedor
   ========================================================================== */

/**
 * Derivado del contrato Zod, no escrito a mano: si `ProjectSpecSchema` cambia,
 * el schema que ve el modelo cambia con el. Duplicarlo a mano es justo la
 * desincronizacion que T0.2 existe para impedir.
 */
export const ExtractionSpecSchema = ExtractedSpecSchema;

/**
 * `json_schema` estricto exige `additionalProperties: false` y `required` con
 * todas las claves, en cada nivel. Zod no lo emite asi, y el proveedor rechaza
 * la peticion entera con un 400 antes de generar nada.
 */
function hardenForStrictMode(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(hardenForStrictMode);
  if (!node || typeof node !== "object") return node;

  const obj = { ...(node as Record<string, unknown>) };
  for (const [k, v] of Object.entries(obj)) obj[k] = hardenForStrictMode(v);

  if (obj.type === "object" && obj.properties && typeof obj.properties === "object") {
    obj.additionalProperties = false;
    obj.required = Object.keys(obj.properties as Record<string, unknown>);
  }
  return obj;
}

export const EXTRACTION_JSON_SCHEMA = hardenForStrictMode(
  z.toJSONSchema(ExtractionSpecSchema, { target: "draft-7", io: "output" }),
);

/* ==========================================================================
   El prompt — la primera linea de defensa (la segunda es el validador)
   ========================================================================== */

const CITAS_PERMITIDAS = Object.entries(
  DEFAULTS as Record<string, { value?: unknown; cita: string }>,
)
  .map(([campo, d]) => {
    const valor =
      d.value === undefined
        ? "clasificas tu el valor (dentro del enum)"
        : `valor fijo ${String(d.value)}`;
    return `  - basis="${campo}" → ${valor}\n      fuente: ${d.cita}`;
  })
  .join("\n");

export const EXTRACTION_SYSTEM = `Eres un extractor de datos para ingenieria de climatizacion de gabinetes electricos.

Devuelves un objeto donde CADA campo es un sobre con status, value, evidence y basis.

REGLAS ABSOLUTAS

1. status="declared" SOLO si el dato aparece explicitamente en el mensaje del cliente.
   En ese caso "evidence" tiene que ser un fragmento LITERAL copiado del mensaje,
   palabra por palabra. Nada de parafrasear ni de reconstruir.

2. Para un campo numerico, los digitos del valor tienen que aparecer dentro de la
   propia "evidence". Si citas "llega a 38 grados", el valor es 38, no 380.

3. status="missing" si el dato no esta. value, evidence y basis a null.

4. NUNCA derives la disipacion termica (W) de la potencia nominal de un motor o
   variador (kW). Son magnitudes distintas. Si solo tienes kW nominales,
   total_dissipation_w es "missing".
   Si el cliente declara perdidas por componente, NO las sumes tu: ponlas en
   component_list y deja total_dissipation_w en "missing". La suma la hace el codigo.
   Cada linea de component_list lleva su propio "evidence": un fragmento LITERAL
   donde aparezcan SUS cifras — tanto los watts como la cantidad. Si la cantidad
   no esta escrita junto al componente, pon qty=1 y deja que se pregunte. No
   deduzcas cantidades de otras cifras del texto: "4 gabinetes" no dice cuantos
   variadores hay por gabinete.

5. status="inferred" SOLO para los campos de esta lista, y "basis" tiene que ser
   EXACTAMENTE la clave indicada — una cadena, no un objeto. Cualquier otra
   cadena se descarta y el campo se degrada a "missing":
${CITAS_PERMITIDAS}

6. Preferir "missing" antes que adivinar. Un numero inventado es peor que un dato
   ausente: un dato ausente se pregunta, un dato inventado se propaga.

Se te pasa el estado actual del proyecto. Conserva lo que ya estaba resuelto y
rellena solo lo que aporte el mensaje nuevo. No degrades a "missing" un campo que
ya venia resuelto.`;

/* ==========================================================================
   La llamada
   ========================================================================== */

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

export interface ExtractResult {
  raw: ExtractedSpec;
  trace: ProviderTrace;
}

/**
 * Extrae del mensaje lo que aporte, partiendo del spec actual.
 *
 * Lo que devuelve es CRUDO: puede traer evidencias inventadas, valores que no
 * casan con su cita y bases fuera de la lista blanca. Pasarlo por `validate()`
 * antes de tocar el estado no es opcional.
 */
export async function extract(message: string, current: ProjectSpec): Promise<ExtractResult> {
  const { value, trace } = await withProviderFallback(async ({ apiKey, config, signal }) => {
    const res = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 4000,
        response_format: {
          type: "json_schema",
          json_schema: { name: "project_spec", strict: true, schema: EXTRACTION_JSON_SCHEMA },
        },
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM },
          {
            role: "user",
            content: `ESTADO ACTUAL DEL PROYECTO:\n${JSON.stringify(current)}\n\nMENSAJE NUEVO DEL CLIENTE:\n${message}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
      throw new ProviderCallError(body.error?.message ?? `HTTP ${res.status}`, res.status);
    }

    const body = (await res.json()) as ChatCompletionResponse;
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new ProviderCallError("respuesta vacia del proveedor", 502);

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ProviderCallError("el proveedor no devolvio JSON valido", 502);
    }

    // El schema Zod es la ultima aduana de forma. Si el modelo se sale del
    // contrato, se trata como fallo de proveedor y la cadena prueba el
    // siguiente: es preferible a propagar un objeto deforme.
    const check = ExtractionSpecSchema.safeParse(parsed);
    if (!check.success) {
      throw new ProviderCallError(
        `el objeto no cumple el contrato: ${check.error.issues[0]?.path.join(".")} — ${check.error.issues[0]?.message}`,
        502,
      );
    }

    return check.data;
  });

  return { raw: value, trace };
}
