/**
 * EL VALIDADOR DE SOBRES — tarea A4. El corazón del diseño.
 *
 * Corre DESPUÉS de cada llamada al LLM, sobre el objeto ya tipado. Es código
 * determinista: no pregunta, no reintenta, no razona. Degrada.
 *
 * Consecuencia: el modelo no puede meter un número sin fundamento aunque
 * quiera. Eso vuelve el sistema independiente de la calidad del modelo.
 *
 * Referencia: spec §7.2 (capa 1) y CLAUDE.md, regla 1.
 */

import {
  DEFAULTS,
  FIELD_KEYS,
  NUMERIC_FIELD_KEYS,
  type AnyField,
  type ExtractedSpec,
  type FieldKey,
  type ProjectSpec,
} from "../project-spec";

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

/**
 * Colapsa espacios y baja a minúsculas.
 *
 * Sin esto, una cita CORRECTA que cruce un salto de línea del correo se lee
 * como inventada. Es un fallo real: lo cazamos el 2026-07-25 corriendo el
 * smoke test, donde los cuatro proveedores citaron bien y los cuatro fueron
 * marcados como fallo por un `\n`.
 */
export function norm(s: string): string {
  // El trim() no es cosmético: sin él, una evidencia con espacios en los
  // extremos produce " la zona ..." y deja de casar con el input.
  return s.trim().split(/\s+/).join(" ").toLowerCase();
}

/**
 * ¿Aparece este número en la evidencia como token propio?
 *
 * Los bordes importan en las dos direcciones:
 *   value=380, evidence="llega a 38 °C"  → false  (el 380 inventado)
 *   value=38,  evidence="son 380 V"      → false  (no vale que esté DENTRO de otro)
 */
export function evidenceHasNumber(evidence: string, value: number): boolean {
  const forms = new Set<string>([String(value)]);
  if (!Number.isInteger(value)) forms.add(String(value).replace(".", ",")); // 35.5 → "35,5"

  return [...forms].some((f) => {
    const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\d.,])${escaped}(?![\\d])`).test(evidence);
  });
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export type DecisionEntry = ProjectSpec["decision_log"][number];

export interface ValidationResult {
  spec: ExtractedSpec;
  log: DecisionEntry[];
  /** Cuántos campos degradó. Si es > 0, el guardrail actuó — y eso se enseña. */
  degraded: number;
}

const MISSING: AnyField = { status: "missing", value: null, evidence: null, basis: null };

// ---------------------------------------------------------------------------
// El validador
// ---------------------------------------------------------------------------

/**
 * Aplica las cuatro reglas a cada campo. Devuelve un spec saneado y el log.
 *
 *   declared → `evidence` substring literal del input (normalizado). Si no → missing.
 *   numérico → los dígitos de `value` en `evidence`. Caza el «38 °C → 380».
 *   inferred → `basis` en la lista blanca DEFAULTS. Si no → missing.
 *   missing  → `value`, `evidence` y `basis` a null.
 */
export function validateExtraction(raw: ExtractedSpec, input: string): ValidationResult {
  const normInput = norm(input);
  const out = { ...raw } as Record<string, unknown>;
  const log: DecisionEntry[] = [];
  let degraded = 0;

  const degrade = (key: FieldKey, reason: string, proposed: unknown) => {
    out[key] = { ...MISSING };
    log.push({ field: key, action: "degraded", reason, proposed: proposed == null ? null : String(proposed) });
    degraded++;
  };

  for (const key of FIELD_KEYS) {
    const f = raw[key] as AnyField | undefined;

    // El modelo devolvió algo que no es un sobre.
    if (!f || typeof f !== "object" || !("status" in f)) {
      degrade(key, "El modelo no devolvió un sobre {status, value, evidence, basis}.", f);
      continue;
    }

    if (f.status === "missing") {
      out[key] = { ...MISSING }; // fuerza value/evidence/basis a null
      continue;
    }

    if (f.status === "declared") {
      if (f.value === null) {
        degrade(key, "status=declared sin valor.", null);
        continue;
      }
      if (!f.evidence || !f.evidence.trim()) {
        degrade(key, "status=declared sin evidencia. La regla exige el fragmento literal que lo respalda.", f.value);
        continue;
      }
      if (!normInput.includes(norm(f.evidence))) {
        degrade(key, "La evidencia no aparece literalmente en el texto del cliente.", f.evidence);
        continue;
      }
      if ((NUMERIC_FIELD_KEYS as readonly string[]).includes(key)) {
        const n = typeof f.value === "number" ? f.value : Number(f.value);
        if (!Number.isFinite(n)) {
          degrade(key, "Campo numérico con valor no numérico.", f.value);
          continue;
        }
        if (!evidenceHasNumber(f.evidence, n)) {
          degrade(
            key,
            `El valor ${n} no aparece en su propia evidencia. El dato citado no dice eso.`,
            f.value,
          );
          continue;
        }
        out[key] = { ...f, value: n, basis: null };
        continue;
      }
      out[key] = { ...f, basis: null }; // declared no lleva basis
      continue;
    }

    if (f.status === "inferred") {
      if (!f.basis || !(f.basis in DEFAULTS)) {
        degrade(
          key,
          "status=inferred con una base que no está en la lista blanca de defaults documentados.",
          f.basis,
        );
        continue;
      }
      const def = DEFAULTS[f.basis as keyof typeof DEFAULTS];
      // El valor de un inferido lo pone la lista blanca, no el modelo.
      out[key] = { status: "inferred", value: def.value, evidence: null, basis: f.basis };
      if (f.value !== null && String(f.value) !== String(def.value)) {
        log.push({
          field: key,
          action: "defaulted",
          reason: `El modelo propuso ${f.value}; se aplica el valor documentado ${def.value}. ${def.cita}`,
          proposed: String(f.value),
        });
      } else {
        log.push({ field: key, action: "defaulted", reason: def.cita, proposed: null });
      }
      continue;
    }

    degrade(key, `Estado desconocido: ${String((f as AnyField).status)}`, f.value);
  }

  return { spec: out as unknown as ExtractedSpec, log, degraded };
}

// ---------------------------------------------------------------------------
// El camino alterno de la carga térmica — SUMA, no estimación
// ---------------------------------------------------------------------------

/**
 * Si el cliente da una lista de componentes con sus watts declarados, se SUMAN.
 *
 * Esto NO viola la regla 1: sumar valores declarados es aritmética, no
 * estimación. Lo que nunca se hace es derivar la disipación de la potencia
 * nominal — para eso el campo se queda `missing`.
 */
export function sumComponentList(spec: ExtractedSpec): ValidationResult {
  const list = spec.component_list;
  if (!list || list.length === 0) return { spec, log: [], degraded: 0 };
  if (spec.total_dissipation_w.status !== "missing") return { spec, log: [], degraded: 0 };

  const total = list.reduce((acc, c) => acc + c.w * c.qty, 0);
  if (!Number.isFinite(total) || total <= 0) return { spec, log: [], degraded: 0 };

  const detalle = list.map((c) => `${c.qty}×${c.name} ${c.w} W`).join(" + ");

  return {
    spec: {
      ...spec,
      total_dissipation_w: {
        status: "declared",
        value: total,
        evidence: null,
        basis: null,
      } as ExtractedSpec["total_dissipation_w"],
    },
    log: [
      {
        field: "total_dissipation_w",
        action: "summed",
        reason: `Suma de las disipaciones declaradas por componente: ${detalle} = ${total} W. Suma, no estimación.`,
        proposed: null,
      },
    ],
    degraded: 0,
  };
}
