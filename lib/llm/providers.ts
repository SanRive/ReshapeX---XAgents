import "server-only";

import { classifyFailure, KeyPool, type ProviderName } from "./key-pool";
import type { ProviderTrace } from "../turn";

/**
 * A2 — cadena de fallback con rotacion de claves.
 *
 * Orden verificado en vivo el 2026-07-25 con `tools/smoke_test_providers.py`:
 * groq → mistral, y dentro de cada proveedor se recorren todas sus claves antes
 * de bajar de escalon. Google va al final y va marcado: NO paso el smoke test,
 * asi que solo entra cuando los dos verificados se agotaron.
 *
 *   groq-1 → groq-2 → … → mistral-1 → mistral-2 → … → google-1 → …
 *
 * Timeout duro por intento y CERO reintentos sobre la misma clave: una demo
 * colgada es peor que una demo degradada.
 *
 * `openai/gpt-oss-120b` es el unico modelo de Groq que acepta `json_schema`,
 * que es lo que emite `generateObject`. No cambiarlo sin volver a correr el
 * smoke test.
 */

export const ATTEMPT_TIMEOUT_MS = 22_000;

export interface ProviderConfig {
  name: ProviderName;
  model: string;
  baseURL: string;
  /** false = no paso `tools/smoke_test_providers.py`. Ultimo recurso. */
  verified: boolean;
}

export const PROVIDER_CHAIN: ProviderConfig[] = [
  {
    name: "groq",
    model: "openai/gpt-oss-120b",
    baseURL: "https://api.groq.com/openai/v1",
    verified: true,
  },
  {
    name: "mistral",
    model: "mistral-medium-3.5",
    baseURL: "https://api.mistral.ai/v1",
    verified: true,
  },
  {
    name: "google",
    model: "gemini-2.5-flash",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    verified: false,
  },
];

const POOLS: Record<ProviderName, KeyPool> = {
  groq: new KeyPool("groq", "GROQ"),
  mistral: new KeyPool("mistral", "MISTRAL"),
  google: new KeyPool("google", "GOOGLE"),
};

export interface Attempt {
  /** groq-1, mistral-3, … */
  id: string;
  apiKey: string;
  config: ProviderConfig;
}

/** La lista de intentos de este momento, ya filtrada por claves vivas. */
export function attemptOrder(now = Date.now()): Attempt[] {
  return PROVIDER_CHAIN.flatMap((config) =>
    POOLS[config.name]
      .available(now)
      .map(({ id, key }) => ({ id, apiKey: key, config })),
  );
}

export class AllProvidersFailedError extends Error {
  constructor(readonly attempts: { id: string; reason: string }[]) {
    super(
      `Fallaron los ${attempts.length} intentos de proveedor: ${attempts
        .map((a) => `${a.id} (${a.reason})`)
        .join(", ")}`,
    );
    this.name = "AllProvidersFailedError";
  }
}

/** El error que debe lanzar el callback cuando el proveedor responde mal, para
 *  que el pool sepa si quemar la clave o no. */
export class ProviderCallError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderCallError";
  }
}

export interface FallbackResult<T> {
  value: T;
  trace: ProviderTrace;
}

/**
 * Corre `call` contra la cadena hasta que uno responda.
 *
 * El callback recibe la clave y el modelo, y devuelve lo que sea que produzca la
 * llamada — asi sirve igual para `generateObject` (extraccion, A3) que para
 * `generateText` (el loop, I2) sin acoplar este archivo al AI SDK.
 *
 * ```ts
 * const { value, trace } = await withProviderFallback(async ({ apiKey, config, signal }) => {
 *   const model = createOpenAICompatible({ baseURL: config.baseURL, apiKey });
 *   const { object } = await generateObject({
 *     model: model(config.model),
 *     schema: ProjectSpecSchema,
 *     prompt,
 *     abortSignal: signal,
 *   });
 *   return object;
 * });
 * ```
 *
 * `trace` es lo que la UI pinta debajo del mensaje: el fallback es visible, no
 * silencioso.
 */
export async function withProviderFallback<T>(
  call: (ctx: {
    apiKey: string;
    config: ProviderConfig;
    signal: AbortSignal;
  }) => Promise<T>,
  options: { timeoutMs?: number } = {},
): Promise<FallbackResult<T>> {
  const timeoutMs = options.timeoutMs ?? ATTEMPT_TIMEOUT_MS;
  const attempts = attemptOrder();
  const failures: { id: string; reason: string }[] = [];

  if (attempts.length === 0) {
    throw new AllProvidersFailedError([
      { id: "—", reason: "no hay claves configuradas en .env.local" },
    ]);
  }

  for (const attempt of attempts) {
    const pool = POOLS[attempt.config.name];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const value = await call({
        apiKey: attempt.apiKey,
        config: attempt.config,
        signal: controller.signal,
      });
      pool.reportSuccess(attempt.id);
      return {
        value,
        trace: {
          id: attempt.id,
          model: attempt.config.model,
          latency_ms: Date.now() - startedAt,
          fell_back_from: failures.length
            ? failures.map((f) => f.id)
            : undefined,
        },
      };
    } catch (error) {
      const status =
        error instanceof ProviderCallError ? error.status : undefined;
      const message = error instanceof Error ? error.message : String(error);
      const kind =
        controller.signal.aborted && !status
          ? "transient"
          : classifyFailure(status, message);

      pool.report(attempt.id, kind);
      failures.push({
        id: attempt.id,
        reason: controller.signal.aborted ? `timeout ${timeoutMs} ms` : `${kind}: ${message}`,
      });

      // Un 400 real es nuestro payload, no la clave. Rotar solo gasta claves.
      if (kind === "fatal") break;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new AllProvidersFailedError(failures);
}

/** Estado del pool para el panel de diagnostico. Nunca devuelve claves. */
export function providerHealth() {
  return PROVIDER_CHAIN.map((config) => ({
    provider: config.name,
    model: config.model,
    verified: config.verified,
    keys: POOLS[config.name].snapshot(),
  }));
}
