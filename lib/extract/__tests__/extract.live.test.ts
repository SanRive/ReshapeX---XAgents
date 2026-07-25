/**
 * Prueba EN VIVO de la extraccion — A3.
 *
 * Llama a un proveedor real. Se salta sola si no hay claves en el entorno, para
 * que `npm test` siga siendo verde en una maquina sin `.env.local`.
 *
 *   npm test -- extract.live
 *
 * No es un mock: es la unica forma honesta de afirmar que el paso 1 funciona.
 * Lo que comprueba no es que el modelo acierte, sino que el SISTEMA aguante —
 * el validador tiene que dejar el estado limpio salga lo que salga del modelo.
 */

import { describe, test, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";

import { BARRANQUILLA_INPUT as EMAIL_INTAKE, BARRANQUILLA_SPEC as SPEC_TURNO_1 } from "../../fixtures/barranquilla";
import { RESPUESTA_CLIENTE as REPLY_DATOS } from "../../demo/turns";
import { emptySpec, type AnyField, type ProjectSpec } from "../../project-spec";

/** Carga `.env.local` sin depender de dotenv. */
function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const raw of readFileSync(".env.local", "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

loadEnvLocal();

const HAS_KEYS = !!(
  process.env.GROQ_API_KEYS ||
  process.env.GROQ_API_KEY ||
  process.env.MISTRAL_API_KEYS ||
  process.env.MISTRAL_API_KEY
);

const blank = (): ProjectSpec => emptySpec();

const at = (s: ProjectSpec, k: string) => s[k as keyof ProjectSpec] as AnyField;

describe.skipIf(!HAS_KEYS)("extraccion en vivo contra proveedor real", () => {
  let extract: typeof import("../extract").extract;
  let validateExtraction: typeof import("../validate").validateExtraction;
  let sumComponentList: typeof import("../validate").sumComponentList;

  beforeAll(async () => {
    ({ extract } = await import("../extract"));
    ({ validateExtraction, sumComponentList } = await import("../validate"));
  });

  test(
    "turno 1: extrae el correo y NO convierte los 22 kW en watts",
    { timeout: 60_000 },
    async () => {
      const { raw, trace } = await extract(EMAIL_INTAKE, blank());
      const { spec: clean, log: degraded } = validateExtraction(raw, EMAIL_INTAKE);
      const cleanSpec = clean as unknown as ProjectSpec;

      console.log(`\n  proveedor: ${trace.id} · ${trace.model} · ${trace.latency_ms} ms`);
      if (trace.fell_back_from?.length) console.log(`  cayo desde: ${trace.fell_back_from.join(", ")}`);
      if (degraded.length) {
        console.log("  el validador intervino:");
        for (const d of degraded) console.log(`    [${d.action}] ${d.reason}`);
      }

      // LA REGLA 1. Da igual lo que el modelo haya intentado: tras el validador,
      // la disipacion no puede tener valor, porque el correo no la declara.
      expect(at(cleanSpec, "total_dissipation_w").value).toBeNull();
      expect(at(cleanSpec, "total_dissipation_w").status).toBe("missing");

      // Los 38 °C si estan declarados y tienen que sobrevivir con su cita literal.
      const amb = at(cleanSpec, "ambient_temp_max_c");
      expect(amb.status).toBe("declared");
      expect(amb.value).toBe(38);
      expect(EMAIL_INTAKE.toLowerCase()).toContain(amb.evidence!.toLowerCase().trim());

      // Ningun campo declarado puede quedar sin evidencia despues del validador.
      for (const [k, v] of Object.entries(cleanSpec)) {
        if (!v || typeof v !== "object" || !("status" in v)) continue;
        const f = v as AnyField;
        if (f.status === "declared") expect(f.evidence, `${k} declarado sin evidencia`).toBeTruthy();
        if (f.status === "inferred") expect(f.basis, `${k} inferido sin cita`).toBeTruthy();
        if (f.status === "missing") expect(f.value, `${k} missing con valor`).toBeNull();
      }
    },
  );

  test(
    "turno 2: o suma 1350 W, o se niega a sumar — nunca inventa un total",
    { timeout: 60_000 },
    async () => {
      const { raw } = await extract(REPLY_DATOS, SPEC_TURNO_1);
      const { spec: clean } = validateExtraction(raw, REPLY_DATOS);
      // La conversacion acumulada: las cantidades ("2 variadores") vienen del
      // correo inicial, las perdidas ("650 W") de la respuesta.
      const conversacion = `${EMAIL_INTAKE}\n${REPLY_DATOS}`;
      const { spec: sumado, log: degraded } = sumComponentList(clean, conversacion);

      console.log(`\n  component_list: ${JSON.stringify(clean.component_list)}`);
      for (const d of degraded) console.log(`    [${d.action}] ${d.reason}`);

      const total = at(sumado as unknown as ProjectSpec, "total_dissipation_w").value;
      console.log(`  total_dissipation_w = ${String(total)}`);

      // Lo que se prueba NO es que el modelo acierte, sino que el sistema sea
      // seguro: o el total es la suma correcta de lo declarado, o no hay total.
      // Un numero intermedio inventado es el unico desenlace inaceptable.
      if (total !== null) expect(total).toBe(1350);
    },
  );
});
