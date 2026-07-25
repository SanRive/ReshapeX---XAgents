import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A2 — rotacion de claves y cadena de fallback.
 *
 * Lo que se comprueba es lo que se prometio en la demo: si una clave se gasta,
 * el siguiente turno usa otra sin que nadie toque nada; si se gasta el proveedor
 * entero, baja de escalon; y si el fallo es del proveedor y no de la credencial,
 * la clave no se quema.
 *
 * Sin mocks del LLM: el callback de `withProviderFallback` es una funcion normal
 * y lo que se prueba es la maquinaria de rotacion, que es codigo puro.
 */

const ENV = {
  GROQ_API_KEYS: "gk-1,gk-2,gk-3",
  MISTRAL_API_KEYS: "mk-1,mk-2",
  GOOGLE_API_KEYS: "goog-1",
};

/** El pool se construye al importar el modulo, asi que el env va antes y el
 *  modulo se re-importa fresco en cada test. */
async function loadProviders() {
  Object.assign(process.env, ENV);
  vi.resetModules();
  return await import("../providers");
}

describe("KeyPool", () => {
  beforeEach(() => {
    Object.assign(process.env, ENV);
  });

  it("lee varias claves por proveedor y las numera en orden", async () => {
    const { KeyPool } = await import("../key-pool");
    const pool = new KeyPool("groq", "GROQ");
    expect(pool.size).toBe(3);
    expect(pool.available().map((k) => k.id)).toEqual([
      "groq-1",
      "groq-2",
      "groq-3",
    ]);
  });

  it("un 429 saca la clave por la ventana de enfriamiento y luego vuelve", async () => {
    const { KeyPool } = await import("../key-pool");
    const pool = new KeyPool("groq", "GROQ");
    const now = 1_000_000;

    pool.report("groq-1", "quota", now);
    expect(pool.available(now).map((k) => k.id)).toEqual(["groq-2", "groq-3"]);

    // 16 minutos despues vuelve a estar disponible.
    const later = now + 16 * 60 * 1000;
    expect(pool.available(later).map((k) => k.id)).toEqual([
      "groq-1",
      "groq-2",
      "groq-3",
    ]);
  });

  it("un 401 mata la clave para todo el proceso", async () => {
    const { KeyPool } = await import("../key-pool");
    const pool = new KeyPool("groq", "GROQ");
    pool.report("groq-1", "auth");
    const muchLater = Date.now() + 100 * 60 * 60 * 1000;
    expect(pool.available(muchLater).map((k) => k.id)).toEqual([
      "groq-2",
      "groq-3",
    ]);
  });

  it("un fallo transitorio no quema la clave", async () => {
    const { KeyPool } = await import("../key-pool");
    const pool = new KeyPool("groq", "GROQ");
    pool.report("groq-1", "transient");
    expect(pool.available().map((k) => k.id)).toEqual([
      "groq-1",
      "groq-2",
      "groq-3",
    ]);
  });

  it("snapshot no expone ninguna clave", async () => {
    const { KeyPool } = await import("../key-pool");
    const pool = new KeyPool("groq", "GROQ");
    const snap = JSON.stringify(pool.snapshot());
    expect(snap).not.toContain("gk-1");
    expect(snap).toContain("groq-1");
  });
});

describe("classifyFailure", () => {
  it("mapea los codigos que importan", async () => {
    const { classifyFailure } = await import("../key-pool");
    expect(classifyFailure(429)).toBe("quota");
    expect(classifyFailure(401)).toBe("auth");
    expect(classifyFailure(402)).toBe("auth");
    expect(classifyFailure(500)).toBe("transient");
    expect(classifyFailure(400)).toBe("fatal");
    // Un 400 con cuerpo de cuota agotada sigue siendo cuota.
    expect(classifyFailure(400, "You exceeded your quota")).toBe("quota");
    // Lo desconocido es transitorio: nunca se quema una clave por las dudas.
    expect(classifyFailure(undefined, "socket hang up")).toBe("transient");
  });
});

describe("withProviderFallback", () => {
  it("responde con la primera clave y reporta cual fue", async () => {
    const { withProviderFallback } = await loadProviders();
    const { value, trace } = await withProviderFallback(async () => "ok");
    expect(value).toBe("ok");
    expect(trace.id).toBe("groq-1");
    expect(trace.model).toBe("openai/gpt-oss-120b");
    expect(trace.fell_back_from).toBeUndefined();
  });

  it("rota a la siguiente clave del mismo proveedor cuando la primera se gasta", async () => {
    const { withProviderFallback, ProviderCallError } = await loadProviders();
    const seen: string[] = [];

    const { trace } = await withProviderFallback(async ({ apiKey }) => {
      seen.push(apiKey);
      if (apiKey === "gk-1") throw new ProviderCallError("rate limit", 429);
      return "ok";
    });

    expect(seen).toEqual(["gk-1", "gk-2"]);
    expect(trace.id).toBe("groq-2");
    expect(trace.fell_back_from).toEqual(["groq-1"]);
  });

  it("agotado el proveedor entero, baja al siguiente escalon de la cadena", async () => {
    const { withProviderFallback, ProviderCallError } = await loadProviders();
    const seen: string[] = [];

    const { trace } = await withProviderFallback(async ({ apiKey, config }) => {
      seen.push(apiKey);
      if (config.name === "groq") throw new ProviderCallError("quota", 429);
      return "ok";
    });

    expect(seen).toEqual(["gk-1", "gk-2", "gk-3", "mk-1"]);
    expect(trace.id).toBe("mistral-1");
    expect(trace.model).toBe("mistral-medium-3.5");
    expect(trace.fell_back_from).toEqual(["groq-1", "groq-2", "groq-3"]);
  });

  it("recuerda la clave gastada entre llamadas: el turno siguiente ya no la prueba", async () => {
    const { withProviderFallback, ProviderCallError } = await loadProviders();

    await withProviderFallback(async ({ apiKey }) => {
      if (apiKey === "gk-1") throw new ProviderCallError("rate limit", 429);
      return "ok";
    });

    const seen: string[] = [];
    const { trace } = await withProviderFallback(async ({ apiKey }) => {
      seen.push(apiKey);
      return "ok";
    });

    expect(seen).toEqual(["gk-2"]);
    expect(trace.id).toBe("groq-2");
  });

  it("un 400 corta la cadena en seco: el payload es nuestro, no la clave", async () => {
    const { withProviderFallback, ProviderCallError, AllProvidersFailedError } =
      await loadProviders();
    const seen: string[] = [];

    await expect(
      withProviderFallback(async ({ apiKey }) => {
        seen.push(apiKey);
        throw new ProviderCallError("schema inválido", 400);
      }),
    ).rejects.toBeInstanceOf(AllProvidersFailedError);

    expect(seen).toEqual(["gk-1"]);
  });

  it("el timeout aborta el intento y pasa al siguiente sin quemar la clave", async () => {
    const { withProviderFallback } = await loadProviders();
    const seen: string[] = [];

    const { trace } = await withProviderFallback(
      async ({ apiKey, signal }) => {
        seen.push(apiKey);
        if (apiKey === "gk-1") {
          await new Promise((_, reject) =>
            signal.addEventListener("abort", () => reject(new Error("aborted"))),
          );
        }
        return "ok";
      },
      { timeoutMs: 30 },
    );

    expect(seen).toEqual(["gk-1", "gk-2"]);
    expect(trace.id).toBe("groq-2");
  });

  it("si fallan todos, lanza con el detalle de cada intento", async () => {
    const { withProviderFallback, ProviderCallError, AllProvidersFailedError } =
      await loadProviders();

    await expect(
      withProviderFallback(async () => {
        throw new ProviderCallError("caído", 503);
      }),
    ).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  it("google va al final de la cadena y va marcado como no verificado", async () => {
    const { PROVIDER_CHAIN } = await loadProviders();
    expect(PROVIDER_CHAIN.map((p) => p.name)).toEqual([
      "groq",
      "mistral",
      "google",
    ]);
    expect(PROVIDER_CHAIN.at(-1)?.verified).toBe(false);
  });
});
