/**
 * Guardrails que corren SIN llamar al modelo.
 *
 * Los tres casos vienen de probar la app en vivo el 2026-07-25, no de imaginar
 * entradas: un juez escribe en su idioma, no en el vocabulario del catálogo.
 */

import { describe, test, expect } from "vitest";

import {
  detectOutOfScope,
  detectSmallTalk,
  respuestaFueraDeAlcance,
  KEYWORDS_POR_CATEGORIA,
} from "../out-of-scope";
import { BARRANQUILLA_INPUT } from "../barranquilla";

describe("fuera de alcance — se caza sin gastar una llamada", () => {
  const casos: Array<[string, string]> = [
    ["Necesitamos sirenas para una subestación", "señalización"],
    ["¿tienen balizas con estrobo?", "señalización"],
    // El que se colaba: un cliente no experto no dice «chiller».
    ["necesito enfriar agua de proceso a 8 grados", "chiller"],
    ["busco un chiller de 20 kW", "chiller"],
    ["quiero agua helada para el circuito", "chiller"],
    ["¿tienen algo para calentar el gabinete en invierno?", "calefacción"],
    ["necesito una resistencia calefactora", "calefacción"],
    ["quiero un detector de gas para la sala", "gas"],
  ];

  for (const [entrada, categoriaEsperada] of casos) {
    test(`«${entrada.slice(0, 42)}…» → ${categoriaEsperada}`, () => {
      const k = detectOutOfScope(entrada);
      expect(k, "debía cazarse").toBeTruthy();
      const esperadas = KEYWORDS_POR_CATEGORIA[
        categoriaEsperada as keyof typeof KEYWORDS_POR_CATEGORIA
      ];
      expect(esperadas).toContain(k!);
    });
  }

  test("la respuesta corresponde a la categoría, no a una genérica", () => {
    // Regresión: los rangos de índice se desincronizaron al añadir keywords y
    // «calentar el gabinete» respondía con el texto de detección de gas.
    expect(respuestaFueraDeAlcance("calentar el gabinete")).toMatch(/calefactores/i);
    expect(respuestaFueraDeAlcance("agua de proceso")).toMatch(/chiller/i);
    expect(respuestaFueraDeAlcance("sirena")).toMatch(/señalización/i);
    expect(respuestaFueraDeAlcance("detector de gas")).toMatch(/detección de gas/i);
  });

  test("toda respuesta ofrece el camino que SÍ cubrimos", () => {
    for (const k of ["sirena", "agua de proceso", "calefactor", "gas alarm"]) {
      expect(respuestaFueraDeAlcance(k)).toMatch(/climatizar un tablero/i);
    }
  });

  test("NO da falso positivo con el caso legítimo", () => {
    expect(detectOutOfScope(BARRANQUILLA_INPUT)).toBeNull();
    expect(detectOutOfScope("El tablero llega a 38 °C y la zona se lava a presión")).toBeNull();
  });
});

describe("fuera de tarea — saludos y meta-preguntas", () => {
  for (const q of ["hola", "Hola!", "buenas", "buenos días", "¿qué sabes hacer?", "¿quién eres?", "hey"]) {
    test(`«${q}» se responde sin llamar al modelo`, () => {
      expect(detectSmallTalk(q)).toBeTruthy();
    });
  }

  test("un correo que EMPIEZA por un saludo NO se corta: ahí sí hay que extraer", () => {
    expect(detectSmallTalk(BARRANQUILLA_INPUT)).toBeNull();
    expect(
      detectSmallTalk("Buenos días, el tablero está en la nave y llega a 42 °C."),
    ).toBeNull();
  });

  test("la respuesta explica qué hace y pide los 3 datos del umbral 1", () => {
    const r = detectSmallTalk("hola")!;
    expect(r).toMatch(/climatizaci[oó]n de gabinetes/i);
    expect(r).toMatch(/temperatura/i);
    expect(r).toMatch(/nunca lo invento/i);
  });
});
