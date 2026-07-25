import "server-only";

/**
 * Pool de claves con rotacion.
 *
 * Una clave gastada no puede tumbar la demo. Cuando una devuelve 401/402/429 se
 * marca y el pool pasa a la siguiente del mismo proveedor; cuando se acaban las
 * del proveedor, `providers.ts` baja al siguiente escalon del fallback.
 *
 * Reglas:
 *  - Un 429 quema la clave por una ventana de enfriamiento y luego vuelve.
 *  - Un 401/402 la quema para todo el proceso: no se arregla esperando.
 *  - Un 5xx, un timeout o un fallo de red NO queman la clave — es el proveedor,
 *    no la credencial. Se pasa a la siguiente sin marcar nada.
 *  - Un 400 aborta la cadena entera: el payload esta mal y probar otra clave solo
 *    gasta tiempo y credenciales.
 *
 * Las claves nunca salen de este proceso. Todo esto corre en el servidor: nada
 * de `NEXT_PUBLIC_`.
 */

export type ProviderName = "groq" | "mistral" | "google";

export type FailureKind = "quota" | "auth" | "transient" | "fatal";

interface KeyState {
  key: string;
  /** groq-1, groq-2, … El indice es la posicion en el pool, 1-based. */
  id: string;
  /** Quemada para todo el proceso (401/402). */
  dead: boolean;
  /** Epoch ms hasta el que no se vuelve a intentar (429). */
  cooldownUntil: number;
  failures: number;
}

const COOLDOWN_MS = 15 * 60 * 1000;

/** Lee `NAME_API_KEYS` (lista separada por comas) y cae a `NAME_API_KEY`. */
function readKeys(prefix: string): string[] {
  const raw =
    process.env[`${prefix}_API_KEYS`] ?? process.env[`${prefix}_API_KEY`] ?? "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export class KeyPool {
  readonly provider: ProviderName;
  private readonly states: KeyState[];

  constructor(provider: ProviderName, envPrefix: string) {
    this.provider = provider;
    this.states = readKeys(envPrefix).map((key, i) => ({
      key,
      id: `${provider}-${i + 1}`,
      dead: false,
      cooldownUntil: 0,
      failures: 0,
    }));
  }

  get size(): number {
    return this.states.length;
  }

  /** Claves utilizables ahora mismo, en orden. */
  available(now = Date.now()): { id: string; key: string }[] {
    return this.states
      .filter((s) => !s.dead && s.cooldownUntil <= now)
      .map((s) => ({ id: s.id, key: s.key }));
  }

  /** Registra un fallo y decide si la clave sigue viva. */
  report(id: string, kind: FailureKind, now = Date.now()): void {
    const state = this.states.find((s) => s.id === id);
    if (!state) return;
    state.failures += 1;
    if (kind === "auth") state.dead = true;
    if (kind === "quota") state.cooldownUntil = now + COOLDOWN_MS;
  }

  /** Un exito limpia el enfriamiento: la ventana pudo haber sido mas corta. */
  reportSuccess(id: string): void {
    const state = this.states.find((s) => s.id === id);
    if (state) state.cooldownUntil = 0;
  }

  /** Para el panel de estado de la UI. No expone las claves. */
  snapshot(now = Date.now()) {
    return this.states.map((s) => ({
      id: s.id,
      status: s.dead
        ? ("dead" as const)
        : s.cooldownUntil > now
          ? ("cooling" as const)
          : ("ready" as const),
      failures: s.failures,
      cooldownRemainingMs: Math.max(0, s.cooldownUntil - now),
    }));
  }
}

/**
 * Clasifica el fallo de una llamada HTTP a un proveedor.
 * Se queda deliberadamente del lado conservador: lo que no reconoce es
 * `transient`, que no quema la clave.
 */
export function classifyFailure(status: number | undefined, message = ""): FailureKind {
  const m = message.toLowerCase();
  if (status === 401 || status === 403) return "auth";
  if (status === 402) return "auth";
  if (status === 429) return "quota";
  if (status === 400) {
    // Algunos proveedores devuelven 400 con cuerpo de cuota agotada.
    if (m.includes("quota") || m.includes("credit") || m.includes("billing")) {
      return "quota";
    }
    return "fatal";
  }
  if (m.includes("rate limit") || m.includes("quota exceeded")) return "quota";
  if (m.includes("invalid api key") || m.includes("unauthorized")) return "auth";
  return "transient";
}
