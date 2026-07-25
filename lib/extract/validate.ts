/**
 * A4 — EL VALIDADOR DE SOBRES. El que no se cae nunca.
 *
 * Corre DESPUES de cada llamada al LLM, sobre el objeto ya tipado. Es codigo
 * determinista: no pregunta, no reintenta, no razona. Degrada.
 *
 * Consecuencia: el modelo no puede meter un numero sin fundamento aunque
 * quiera. Eso vuelve el sistema independiente de la calidad del modelo, y es
 * lo que se ensena cuando un juez pregunta si esta mockeado.
 *
 * Firma fijada en `docs/contratos-de-modulo.md`.
 */

import {
  DEFAULTS,
  NUMERIC_FIELDS,
  isWhitelistedBasis,
  type Field,
  type ProjectSpec,
} from "../project-spec";
import type { DecisionEntry } from "../turn";

/* ==========================================================================
   Normalizacion
   ========================================================================== */

/**
 * Colapsa espacios y baja a minusculas.
 *
 * El `trim()` no es cosmetico: sin el, una evidencia con espacios en los
 * extremos produce " la zona ..." y deja de casar con el input.
 *
 * Y sin el colapso de espacios, una cita CORRECTA que cruce un salto de linea
 * del correo se lee como inventada. Es un fallo real: lo cazamos el 2026-07-25
 * corriendo el smoke test, donde los cuatro proveedores citaron bien y los
 * cuatro fueron marcados como fallo por un `\n`.
 */
export function norm(s: string): string {
  return s.trim().split(/\s+/).join(" ").toLowerCase();
}

/**
 * ¿Aparece este numero en la evidencia como token propio?
 *
 * Los bordes importan en las dos direcciones:
 *   value=380, evidence="llega a 38 °C"  → false  (el 380 inventado)
 *   value=38,  evidence="son 380 V"      → false  (no vale estar DENTRO de otro)
 */
export function evidenceHasNumber(evidence: string, value: number): boolean {
  const forms = new Set<string>([String(value)]);
  if (!Number.isInteger(value)) forms.add(String(value).replace(".", ",")); // 35.5 → "35,5"

  return [...forms].some((f) => {
    const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\d.,])${escaped}(?![\\d])`).test(evidence);
  });
}

/* ==========================================================================
   El validador
   ========================================================================== */

const FIELD_KEYS = Object.keys(DEFAULTS); // solo para tipado laxo; se recorre el spec entero

function missingField(blocks: string | null | undefined): Field {
  return { status: "missing", value: null, evidence: null, basis: null, blocks: blocks ?? null };
}

function isFieldLike(v: unknown): v is Field {
  return !!v && typeof v === "object" && "status" in (v as Record<string, unknown>);
}

export interface ValidateResult {
  clean: ProjectSpec;
  degraded: DecisionEntry[];
}

/**
 * Aplica las cuatro reglas a cada sobre del spec.
 *
 *   declared → `evidence` substring literal del input (normalizado). Si no → missing.
 *   numerico → los digitos de `value` en `evidence`. Caza el «38 °C → 380».
 *   inferred → `basis` tiene que ser LA cita documentada del campo. Si no → missing.
 *   missing  → `value`, `evidence` y `basis` a null.
 *
 * Devuelve el spec saneado y una entrada de log por cada intervencion. Ese log
 * entra en el brief: es la prueba en papel de que el guardrail actuo.
 */
export function validate(raw: ProjectSpec, message: string): ValidateResult {
  const normInput = norm(message);
  const clean = { ...raw } as unknown as Record<string, unknown>;
  const degraded: DecisionEntry[] = [];

  for (const [key, value] of Object.entries(raw)) {
    // component_list no es un sobre: se valida aparte, en sumComponentList.
    if (!isFieldLike(value)) continue;
    const f = value;

    const drop = (text: string) => {
      clean[key] = missingField(f.blocks);
      degraded.push({ kind: "degraded", text });
    };

    if (f.status === "missing") {
      clean[key] = missingField(f.blocks); // fuerza value/evidence/basis a null
      continue;
    }

    if (f.status === "declared") {
      if (f.value === null) {
        drop(`${key}: status=declared sin valor.`);
        continue;
      }
      if (!f.evidence || !f.evidence.trim()) {
        drop(
          `${key}: status=declared sin evidencia. La regla exige el fragmento literal del cliente que lo respalda.`,
        );
        continue;
      }
      if (!normInput.includes(norm(f.evidence))) {
        drop(`${key}: la evidencia citada no aparece literalmente en el texto del cliente.`);
        continue;
      }
      if (NUMERIC_FIELDS.includes(key)) {
        const n = typeof f.value === "number" ? f.value : Number(f.value);
        if (!Number.isFinite(n)) {
          drop(`${key}: campo numerico con valor no numerico (${String(f.value)}).`);
          continue;
        }
        if (!evidenceHasNumber(f.evidence, n)) {
          drop(
            `${key}: el valor ${n} no aparece en su propia evidencia — el fragmento citado no dice eso.`,
          );
          continue;
        }
        clean[key] = { ...f, value: n, basis: null };
        continue;
      }
      clean[key] = { ...f, basis: null }; // un declared no lleva basis
      continue;
    }

    if (f.status === "inferred") {
      if (!isWhitelistedBasis(key, f.basis)) {
        drop(
          `${key}: status=inferred con una base que no esta en la lista blanca de defaults documentados.`,
        );
        continue;
      }
      const def = DEFAULTS[key]!;
      const esClasificacion = def.value === undefined;

      if (esClasificacion && f.value === null) {
        drop(`${key}: regla de clasificacion invocada sin valor.`);
        continue;
      }

      // En un default, el valor lo pone la lista blanca, no el modelo.
      // En una clasificacion, el modelo elige — pero solo dentro del enum, que
      // el schema Zod ya acoto, y solo con la cita documentada.
      clean[key] = {
        status: "inferred",
        value: esClasificacion ? f.value : def.value!,
        evidence: null,
        basis: def.citation,
        blocks: null,
      };

      if (esClasificacion) {
        degraded.push({
          kind: "default",
          text: `${key}: clasificado como «${String(f.value)}» segun la regla documentada del catalogo.`,
          citation: def.citation,
        });
        continue;
      }

      if (f.value !== null && String(f.value) !== String(def.value)) {
        degraded.push({
          kind: "default",
          text: `${key}: el modelo propuso ${String(f.value)}; se aplica el valor documentado ${String(def.value)}.`,
          citation: def.citation,
        });
      } else {
        degraded.push({
          kind: "default",
          text: `${key}: sin dato declarado, se aplica el default documentado ${String(def.value)}.`,
          citation: def.citation,
        });
      }
      continue;
    }

    drop(`${key}: estado desconocido «${String((f as Field).status)}».`);
  }

  return { clean: clean as unknown as ProjectSpec, degraded };
}

/* ==========================================================================
   El camino alterno de la carga termica — SUMA, no estimacion
   ========================================================================== */

/**
 * Si el cliente da una lista de componentes con sus watts declarados, se SUMAN.
 *
 * Esto NO viola la regla 1: sumar valores declarados es aritmetica, no
 * estimacion. Lo que nunca se hace es derivar la disipacion de la potencia
 * nominal — para eso el campo se queda `missing`.
 */
export function sumComponentList(spec: ProjectSpec): ValidateResult {
  const list = spec.component_list;
  if (!list || list.length === 0) return { clean: spec, degraded: [] };
  if (spec.total_dissipation_w.status !== "missing") return { clean: spec, degraded: [] };

  const total = list.reduce((acc, c) => acc + c.w * c.qty, 0);
  if (!Number.isFinite(total) || total <= 0) return { clean: spec, degraded: [] };

  const detalle = list.map((c) => `${c.qty}×${c.name} ${c.w} W`).join(" + ");

  return {
    clean: {
      ...spec,
      total_dissipation_w: {
        status: "declared",
        value: total,
        evidence: null,
        basis: null,
        blocks: null,
      },
    },
    degraded: [
      {
        kind: "extract",
        text: `Disipacion total por suma de lo declarado por componente: ${detalle} = ${total} W. Suma, no estimacion.`,
      },
    ],
  };
}

export { FIELD_KEYS };
