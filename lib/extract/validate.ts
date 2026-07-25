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
      const def = DEFAULTS[f.basis as keyof typeof DEFAULTS] as {
        value?: unknown;
        cita: string;
      };

      // Una entrada sin `value` no es un default: es una regla de clasificación
      // documentada. Ahí el modelo elige el valor —el enum de Zod ya acota
      // cuáles— pero no puede inventarse la regla, porque la clave del basis
      // tiene que existir en la lista blanca.
      if (def.value === undefined) {
        if (f.value === null) {
          degrade(key, "Regla de clasificación invocada sin valor.", null);
          continue;
        }
        out[key] = { status: "inferred", value: f.value, evidence: null, basis: f.basis };
        log.push({
          field: key,
          action: "defaulted",
          reason: `Clasificado como «${String(f.value)}» según la regla documentada. ${def.cita}`,
          proposed: null,
        });
        continue;
      }

      // El valor de un default lo pone la lista blanca, no el modelo.
      out[key] = {
        status: "inferred",
        value: def.value as AnyField["value"],
        evidence: null,
        basis: f.basis,
      };
      if (f.value !== null && String(f.value) !== String(def.value)) {
        log.push({
          field: key,
          action: "defaulted",
          reason: `El modelo propuso ${f.value}; se aplica el valor documentado ${String(def.value)}. ${def.cita}`,
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
// Fusión entre turnos
// ---------------------------------------------------------------------------

/**
 * Combina el estado acumulado con lo que aporta el turno nuevo.
 *
 * ⚠️ NO es un spread. El modelo re-extrae **solo del mensaje nuevo**, así que
 * todo campo que no aparezca ahí vuelve como `missing`. Un `{...prev, ...next}`
 * machaca con esos `missing` lo que ya estaba resuelto, y el agente acaba
 * preguntando dos veces por un dato que el cliente ya dio — que es justo lo que
 * este producto existe para evitar.
 *
 * Regla: un campo resuelto solo lo pisa otro campo resuelto. Un `missing` nunca
 * borra un `declared` ni un `inferred`.
 */
export function mergeSpec(previous: ExtractedSpec, incoming: ExtractedSpec): ExtractedSpec {
  const out = { ...previous } as Record<string, unknown>;

  for (const key of FIELD_KEYS) {
    const nuevo = incoming[key] as AnyField | undefined;
    const viejo = previous[key] as AnyField | undefined;
    if (!nuevo) continue;

    const nuevoResuelto = nuevo.status !== "missing" && nuevo.value !== null;
    const viejoResuelto = !!viejo && viejo.status !== "missing" && viejo.value !== null;

    if (nuevoResuelto || !viejoResuelto) out[key] = nuevo;
  }

  // La lista de componentes solo se sustituye si el turno nuevo trae una.
  if (incoming.component_list && incoming.component_list.length > 0) {
    out.component_list = incoming.component_list;
  }
  if (incoming.measured_temps) out.measured_temps = incoming.measured_temps;

  return out as unknown as ExtractedSpec;
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
export function sumComponentList(spec: ExtractedSpec, sourceText = ""): ValidationResult {
  const list = spec.component_list;
  if (!list || list.length === 0) return { spec, log: [], degraded: 0 };
  if (spec.total_dissipation_w.status !== "missing") return { spec, log: [], degraded: 0 };

  const normSource = norm(sourceText);

  /**
   * Cada línea tiene que traer un fragmento literal del cliente donde aparezcan
   * SUS dos cifras: los watts Y la cantidad. Comprobarlas contra la
   * conversación entera no basta — el «4» de «4 gabinetes» valida un `qty: 4`
   * de variadores que nadie declaró.
   *
   * Sin exonerar `qty === 1`. Se probó y era peor: con la cita «cada uno
   * declara 650 W de pérdidas», que no dice cuántos, el modelo ponía
   * honestamente `qty: 1` y la suma daba 700 W. No es 2 650, pero tampoco es
   * 1 350 — sigue siendo un número inventado, solo que por defecto. «Es uno» y
   * «no sé cuántos» tienen que ser distinguibles.
   */
  const noRastreables = list.filter((c) => {
    if (!c.evidence || !c.evidence.trim()) return true;
    if (!normSource.includes(norm(c.evidence))) return true;
    if (!evidenceHasNumber(c.evidence, c.w)) return true;
    if (!evidenceHasNumber(c.evidence, c.qty)) return true;
    return false;
  });

  if (noRastreables.length > 0) {
    const detalle = noRastreables
      .map((c) => `${c.qty}×${c.name} ${c.w} W (cita: ${c.evidence ? `«${c.evidence}»` : "ninguna"})`)
      .join("; ");
    return {
      spec,
      log: [
        {
          field: "total_dissipation_w",
          action: "degraded",
          reason:
            `No se suma la disipación: hay líneas de la lista de componentes cuyas cifras no ` +
            `están respaldadas por un fragmento literal del cliente (${detalle}). ` +
            `Se pregunta en vez de suponer.`,
          proposed: null,
        },
      ],
      degraded: 0,
    };
  }

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
