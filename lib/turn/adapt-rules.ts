/**
 * I1 — ADAPTADOR entre el motor de reglas y la UI.
 *
 * La pista B modela el dominio con más matiz del que la ficha necesita pintar:
 * cuatro estados de veredicto (`recommended | possible | rejected | blocked`) y
 * campos bloqueantes por familia. La UI dibuja tres (`viable | conditional |
 * rejected`).
 *
 * Traducir aquí y no en ninguno de los dos lados es deliberado: el motor no
 * tiene por qué saber cómo se pinta, y la UI no tiene por qué conocer los
 * estados internos de la compuerta. Es un archivo de nadie, que los une.
 *
 * Regla que se respeta al traducir: **`blocked` NUNCA se convierte en
 * `rejected`.** Falta un dato no es lo mismo que la regla lo descarta, y
 * confundirlos es exactamente la clase de error que este producto existe para
 * no cometer. Un `blocked` sale como `conditional` con su razón.
 */

import type {
  Citation as RuleCitation,
  CoolingUnitCandidate,
  CoolingUnitModel,
  CoolingUnitShortlistResult,
  TechnologyFamily,
  TechnologyVerdict,
} from "../rules";
import { allCoolingUnitModels } from "../rules";
import type { Citation, Family, FamilyVerdict, ModelCandidate, Shortlist, Verdict } from "../turn";

/* ==========================================================================
   Citas
   ========================================================================== */

/** El motor numera la página; la UI la muestra como texto. */
export function adaptCitation(c: RuleCitation): Citation {
  return {
    documento: c.documento,
    pagina: `p. ${c.pagina}`,
    texto_citado: c.texto_citado,
  };
}

/* ==========================================================================
   Compuerta de 4 familias
   ========================================================================== */

const FAMILY_MAP: Record<TechnologyFamily, Family> = {
  filterfan_exhaust: "filterfan",
  pks_air_air: "air_air_hx",
  dts_cooling_units: "cooling_unit",
  pws_air_water: "air_water_hx",
};

function adaptVerdictStatus(v: TechnologyVerdict): Verdict {
  switch (v.status) {
    case "recommended":
      return "viable";
    case "possible":
      return "conditional";
    case "rejected":
      return "rejected";
    // `blocked` = falta un dato. NO es un descarte. Sale como condicional.
    case "blocked":
      return "conditional";
  }
}

/** Añade a la razón lo que falta o lo que hay que confirmar, sin inventar nada. */
function composeReason(v: TechnologyVerdict): string {
  const partes = [v.reason];
  if (v.status === "blocked" && v.blockingFields.length > 0) {
    partes.push(`Falta por declarar: ${v.blockingFields.join(", ")}.`);
  }
  for (const w of v.warnings) partes.push(w);
  return partes.join(" ");
}

export function adaptGate(verdicts: TechnologyVerdict[]): FamilyVerdict[] {
  return verdicts.map((v) => ({
    family: FAMILY_MAP[v.family],
    label: v.familyLabel,
    verdict: adaptVerdictStatus(v),
    reason: composeReason(v),
    citations: v.citations.map(adaptCitation),
  }));
}

/* ==========================================================================
   Shortlist de Cooling Units
   ========================================================================== */

function adaptCandidateStatus(c: CoolingUnitCandidate): Verdict {
  switch (c.status) {
    case "recommended":
      return "viable";
    case "verify":
    case "alternative":
      return "conditional";
    case "rejected":
      return "rejected";
  }
}

const MOUNTING_MAP: Record<string, ModelCandidate["mounting"]> = {
  side: "side",
  recessed: "recessed",
  top: "top",
};

/**
 * El candidato del motor no arrastra voltajes ni dimensiones, pero el catálogo
 * curado sí los tiene. Se buscan aquí en vez de duplicarlos: la fuente sigue
 * siendo `catalog-data.ts` y esto es solo una lectura.
 */
function findModel(c: CoolingUnitCandidate): CoolingUnitModel | undefined {
  const modelos = allCoolingUnitModels();
  return (
    modelos.find((m) => c.designacionComercial && m.designacionComercial === c.designacionComercial) ??
    modelos.find((m) => m.modelo === c.model) ??
    modelos.find((m) => m.serie === c.series)
  );
}

function adaptCandidate(c: CoolingUnitCandidate): ModelCandidate {
  const razones = [c.reason, ...c.rejectionReasons, ...c.verificationWarnings].filter(Boolean);
  const m = findModel(c);
  const d = m?.dimensiones;

  return {
    model: c.designacionComercial ?? c.model,
    capacity_btuh: [c.capacidadMinBtuH, c.capacidadMaxBtuH],
    // Los voltajes tal como los imprime el catálogo, sin normalizar: el
    // ingeniero busca esa cadena, no nuestro enum.
    voltages: [...(m?.voltajesCatalogo ?? [])],
    // Si el catálogo no publica una dimensión, va a 0 y la UI no la pinta.
    // Cero es «no publicado», nunca una medida inventada.
    dimensions_mm: {
      h: d?.altoMm ?? 0,
      w: d?.anchoMm ?? 0,
      d: d?.profundidadMm ?? 0,
    },
    // El montaje va codificado en la serie: DTS = side · DTI = recessed · DTT = top.
    mounting:
      (m && MOUNTING_MAP[m.montaje]) ??
      (c.series.startsWith("DTI") ? "recessed" : c.series.startsWith("DTT") ? "top" : "side"),
    nema_available: [...(m?.ratingsNema ?? [])],
    verdict: adaptCandidateStatus(c),
    reason: razones.join(" "),
    citations: c.citations.map(adaptCitation),
  };
}

/**
 * @param enclosureCount cuántos gabinetes iguales declaró el cliente. Si no lo
 *                       declaró, 1 — no se supone una cantidad.
 */
export function adaptShortlist(
  result: CoolingUnitShortlistResult,
  enclosureCount = 1,
): Shortlist | null {
  // Sin capacidad requerida no hay shortlist: falta la disipación, que es
  // bloqueante duro y nunca se estima.
  if (result.requiredCapacityBtuH === undefined) return null;

  const todos = result.candidates.map(adaptCandidate);

  return {
    candidates: todos.filter((c) => c.verdict !== "rejected"),
    rejected: todos.filter((c) => c.verdict === "rejected"),
    // `notAsserted` es lo que el motor explícitamente no afirma. La nota de
    // derating vive ahí; se une en una línea para la UI.
    derating_note: result.notAsserted.length > 0 ? result.notAsserted.join(" ") : null,
    units_needed: enclosureCount,
  };
}
