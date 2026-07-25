/**
 * B2 · Compuerta de selección de tecnología. **TypeScript puro, sin LLM, sin red.**
 *
 * Entra un `ProjectSpec`, salen **cuatro** veredictos — uno por familia, incluidos los
 * negativos argumentados, que es la mitad del valor del producto (§2 del spec, punto 3:
 * *"Pre-califica la tecnología y argumenta el caso negativo con cita — PSS solo muestra
 * qué es viable al final, sin explicar por qué no lo demás"*).
 *
 * Tres invariantes que los tests protegen:
 *
 *  1. Siempre cuatro veredictos, uno por familia.
 *  2. Todo veredicto lleva al menos una cita.
 *  3. **Un dato faltante nunca se convierte en rechazo.** Produce `blocked` y dice qué
 *     campo falta. Un rechazo solo lo emite una regla citada sobre datos presentes.
 *
 * Las razones se arman con plantillas deterministas (`reasons.ts`). El LLM no redacta
 * nada de esto: si la misma entrada produce dos textos distintos, es un bug.
 */

import type { ProjectSpec, ResolvedSpec } from "../project-spec";
import { resolveSpec } from "../project-spec";
import {
  CITATIONS,
  DEFAULT_INTERNAL_TEMP_MAX_C,
  NEMA_BY_LOCATION,
} from "./catalog-data";
import type { Citation, NemaRating, TechnologyFamily, TechnologyVerdict } from "./types";
import { FAMILY_LABEL, TECHNOLOGY_FAMILIES } from "./types";
import { fmtC, joinEs } from "./reasons";

/* ------------------------------------------------------------------ *
 * Contexto térmico — se calcula una vez y lo comparten las cuatro familias
 * ------------------------------------------------------------------ */

export type GateContext = {
  ambientMaxC: number | undefined;
  /** Objetivo interno: declarado, o el default citado del catálogo NA p.2. */
  internalMaxC: number;
  /** `true` si el objetivo interno viene del default en vez del cliente. */
  internalIsDefault: boolean;
  /**
   * `undefined` cuando no se conoce el ambiente. **No es `false`**: no saber no es
   * lo mismo que no hacer falta.
   */
  activeCoolingRequired: boolean | undefined;
  location: ResolvedSpec["location"];
  airQuality: ResolvedSpec["air_quality"];
  nemaRequired: readonly NemaRating[] | undefined;
  washdownRequired: boolean | undefined;
  processWaterAvailable: boolean | undefined;
};

export function buildGateContext(spec: ProjectSpec): GateContext {
  const r = resolveSpec(spec);

  const internalDeclared = r.internal_temp_max_c;
  const internalMaxC = internalDeclared ?? DEFAULT_INTERNAL_TEMP_MAX_C;
  const ambientMaxC = r.ambient_temp_max_c;

  const location = r.location;
  const nemaRequired = location === undefined ? undefined : NEMA_BY_LOCATION[location];

  return {
    ambientMaxC,
    internalMaxC,
    internalIsDefault: internalDeclared === undefined,
    activeCoolingRequired: ambientMaxC === undefined ? undefined : ambientMaxC > internalMaxC,
    location,
    airQuality: r.air_quality,
    nemaRequired,
    washdownRequired: location === undefined ? undefined : location === "washdown",
    processWaterAvailable: r.process_water_available,
  };
}

/* ------------------------------------------------------------------ *
 * API pública
 * ------------------------------------------------------------------ */

/**
 * Devuelve un veredicto por cada una de las cuatro familias, siempre en el orden de la
 * matriz del catálogo.
 */
export function evaluateTechnologyGate(spec: ProjectSpec): TechnologyVerdict[] {
  const ctx = buildGateContext(spec);
  return TECHNOLOGY_FAMILIES.map((family) => evaluateFamily(family, ctx));
}

/** Veredicto de una sola familia. Útil para la tool `explicar_veredicto` (Pista C). */
export function evaluateTechnologyFamily(
  spec: ProjectSpec,
  family: TechnologyFamily,
): TechnologyVerdict {
  return evaluateFamily(family, buildGateContext(spec));
}

/** ¿La compuerta tiene los tres datos del umbral 1 (§3.6)? */
export function gateThresholdMet(spec: ProjectSpec): boolean {
  const r = resolveSpec(spec);
  return (
    r.ambient_temp_max_c !== undefined && r.location !== undefined && r.air_quality !== undefined
  );
}

/* ------------------------------------------------------------------ *
 * Despacho
 * ------------------------------------------------------------------ */

function evaluateFamily(family: TechnologyFamily, ctx: GateContext): TechnologyVerdict {
  switch (family) {
    case "filterfan_exhaust":
      return verdictFilterfan(ctx);
    case "pks_air_air":
      return verdictPks(ctx);
    case "dts_cooling_units":
      return verdictCoolingUnits(ctx);
    case "pws_air_water":
      return verdictPws(ctx);
  }
}

type VerdictDraft = Omit<TechnologyVerdict, "family" | "familyLabel">;

function finish(family: TechnologyFamily, draft: VerdictDraft): TechnologyVerdict {
  return { family, familyLabel: FAMILY_LABEL[family], ...draft };
}

/** Nota que se añade cuando el objetivo interno no lo dio el cliente. */
function defaultInternalNote(ctx: GateContext): string[] {
  return ctx.internalIsDefault
    ? [
        `Temperatura interna objetivo tomada del default documentado ` +
          `(${fmtC(DEFAULT_INTERNAL_TEMP_MAX_C)}). Confirmar con el cliente.`,
      ]
    : [];
}

function defaultInternalCitation(ctx: GateContext): Citation[] {
  return ctx.internalIsDefault ? [CITATIONS.TEMPERATURA_INTERNA_OBJETIVO] : [];
}

/* ------------------------------------------------------------------ *
 * Familia 1 · Filterfan 4.0 + Exhaust Filters
 * ------------------------------------------------------------------ *
 *
 * Aire exterior filtrado hacia adentro. Dos frenos independientes:
 *
 *  a) **Térmico.** No puede llevar el interior por debajo del ambiente. Si
 *     `ambiente > objetivo interno`, el catálogo pide cooling activo (NA p.6) y el
 *     propio PSS lo confirma en su página de resultados.
 *  b) **Rating.** El Filterfan 4.0 es Type 12 (NA p.3) y tiene variante Outdoor Type 3R
 *     (NA p.4). **No hay variante 4/4X documentada**, así que un requerimiento washdown
 *     lo descarta: introduce aire exterior al gabinete.
 */
function verdictFilterfan(ctx: GateContext): TechnologyVerdict {
  const citations: Citation[] = [CITATIONS.MATRIZ_TECNOLOGIA];

  // (a) Freno térmico — tiene prioridad: es físico y no depende del rating.
  if (ctx.activeCoolingRequired === true) {
    return finish("filterfan_exhaust", {
      status: "rejected",
      reason:
        `La temperatura ambiente (${fmtC(ctx.ambientMaxC!)}) supera la temperatura interna ` +
        `objetivo (${fmtC(ctx.internalMaxC)}): un filterfan solo puede introducir aire ` +
        `exterior, nunca enfriar por debajo del ambiente. El catálogo exige cooling activo ` +
        `y el propio PSS descarta el filter fan en ese escenario.`,
      blockingFields: [],
      citations: [
        ...citations,
        CITATIONS.COOLING_ACTIVO_REQUERIDO,
        CITATIONS.CONVECCION_NATURAL_ECONOMICA,
        CITATIONS.PSS_COMPUERTA_CONFIRMADA,
        ...defaultInternalCitation(ctx),
      ],
      warnings: defaultInternalNote(ctx),
    });
  }

  // (b) Freno por rating — washdown exige 4/4X y el filterfan no lo tiene documentado.
  if (ctx.washdownRequired === true) {
    return finish("filterfan_exhaust", {
      status: "rejected",
      reason:
        `La aplicación es washdown y exige NEMA Type 4/4X. El Filterfan 4.0 está documentado ` +
        `como Type 12, con variante Outdoor Type 3R; no hay variante 4/4X. Además introduce ` +
        `aire exterior al gabinete, que es justamente lo que el rating impide. Un sistema de ` +
        `lazo cerrado es lo que conserva el rating del gabinete.`,
      blockingFields: [],
      citations: [
        ...citations,
        CITATIONS.PSS_LOCATION_A_NEMA,
        CITATIONS.FILTERFAN_TYPE_12,
        CITATIONS.FILTERFAN_OUTDOOR_3R,
        CITATIONS.LAZO_CERRADO_CONSERVA_NEMA,
      ],
      warnings: [],
    });
  }

  // Datos que faltan para decidir.
  const blocking = missingBasics(ctx, { needsAmbient: true, needsAirQuality: true });
  if (blocking.length > 0) {
    return finish("filterfan_exhaust", {
      status: "blocked",
      reason: blockedReason("Filterfan 4.0 & Exhaust Filters", blocking),
      blockingFields: blocking,
      citations: [...citations, CITATIONS.CONVECCION_NATURAL_ECONOMICA],
      warnings: defaultInternalNote(ctx),
    });
  }

  // Ambiente fresco. La matriz decide por calidad de aire.
  const warnings: string[] = [...defaultInternalNote(ctx)];
  if (ctx.location === "outdoor") {
    warnings.push(
      "Instalación a la intemperie: solo la variante 3R Outdoor Filterfan está documentada. " +
        "Si el requerimiento real es Type 4, esta familia queda descartada.",
    );
    citations.push(CITATIONS.FILTERFAN_OUTDOOR_3R);
  }

  if (ctx.airQuality === "clean_or_slightly_dirty") {
    return finish("filterfan_exhaust", {
      status: "recommended",
      reason:
        `Ambiente fresco (${fmtC(ctx.ambientMaxC!)} contra un objetivo interno de ` +
        `${fmtC(ctx.internalMaxC)}) y aire limpio o poco sucio: es la fila "Cool Ambient, ` +
        `Clean or Slightly Dirty Conditions" de la matriz, y la convección forzada es la ` +
        `solución económica cuando el ambiente está siempre por debajo del objetivo interno.`,
      blockingFields: [],
      citations: [...citations, CITATIONS.CONVECCION_NATURAL_ECONOMICA],
      warnings,
    });
  }

  return finish("filterfan_exhaust", {
    status: "rejected",
    reason:
      `El aire ambiente está clasificado como "${airQualityLabel(ctx.airQuality!)}". Un ` +
      `filterfan mete ese aire dentro del gabinete; la matriz reserva esta familia para la ` +
      `fila "Cool Ambient, Clean or Slightly Dirty Conditions".`,
    blockingFields: [],
    citations: [...citations, CITATIONS.PKS_ENCABEZADO],
    warnings,
  });
}

/* ------------------------------------------------------------------ *
 * Familia 2 · PKS Air/Air Heat Exchangers
 * ------------------------------------------------------------------ *
 *
 * Lazo cerrado, pero el sumidero de calor sigue siendo el aire ambiente: **no puede
 * llevar el interior por debajo del ambiente.** La matriz lo ubica en "Cool Ambient".
 */
function verdictPks(ctx: GateContext): TechnologyVerdict {
  const citations: Citation[] = [CITATIONS.MATRIZ_TECNOLOGIA, CITATIONS.PKS_ENCABEZADO];

  if (ctx.activeCoolingRequired === true) {
    return finish("pks_air_air", {
      status: "rejected",
      reason:
        `Un intercambiador aire/aire transfiere el calor al aire ambiente: no puede llevar el ` +
        `interior por debajo de la temperatura ambiente. Aquí el ambiente ` +
        `(${fmtC(ctx.ambientMaxC!)}) ya supera el objetivo interno (${fmtC(ctx.internalMaxC)}), ` +
        `así que se requiere cooling activo. La matriz ubica esta familia en "Cool Ambient, ` +
        `Dirty Conditions", y el propio PSS descarta el air/air en ese escenario.`,
      blockingFields: [],
      citations: [
        ...citations,
        CITATIONS.COOLING_ACTIVO_REQUERIDO,
        CITATIONS.PSS_COMPUERTA_CONFIRMADA,
        ...defaultInternalCitation(ctx),
      ],
      warnings: defaultInternalNote(ctx),
    });
  }

  const blocking = missingBasics(ctx, { needsAmbient: true, needsAirQuality: true });
  if (blocking.length > 0) {
    return finish("pks_air_air", {
      status: "blocked",
      reason: blockedReason("PKS Air/Air Heat Exchangers", blocking),
      blockingFields: blocking,
      citations,
      warnings: defaultInternalNote(ctx),
    });
  }

  if (ctx.airQuality === "dirty") {
    return finish("pks_air_air", {
      status: "recommended",
      reason:
        `Ambiente fresco (${fmtC(ctx.ambientMaxC!)} contra ${fmtC(ctx.internalMaxC)} internos) ` +
        `con aire sucio: fila "Cool Ambient, Dirty Conditions" de la matriz. El lazo cerrado ` +
        `evita meter aire contaminado al gabinete y conserva el rating NEMA.`,
      blockingFields: [],
      citations: [...citations, CITATIONS.LAZO_CERRADO_CONSERVA_NEMA],
      warnings: defaultInternalNote(ctx),
    });
  }

  if (ctx.airQuality === "very_harsh") {
    return finish("pks_air_air", {
      status: "possible",
      reason:
        `Ambiente fresco, pero el aire está clasificado como muy hostil. La matriz manda esa ` +
        `condición a PWS Air/Water; el PKS sigue siendo técnicamente aplicable por ser lazo ` +
        `cerrado, no es la primera opción del catálogo.`,
      blockingFields: [],
      citations: [...citations, CITATIONS.PWS_ENCABEZADO],
      warnings: defaultInternalNote(ctx),
    });
  }

  return finish("pks_air_air", {
    status: "possible",
    reason:
      `Ambiente fresco y aire limpio o poco sucio. El PKS funciona y conserva el rating NEMA, ` +
      `pero la matriz reserva esta fila al Filterfan, que es la solución económica cuando el ` +
      `aire exterior puede entrar al gabinete.`,
    blockingFields: [],
    citations: [...citations, CITATIONS.CONVECCION_NATURAL_ECONOMICA],
    warnings: defaultInternalNote(ctx),
  });
}

/* ------------------------------------------------------------------ *
 * Familia 3 · DTS Cooling Units
 * ------------------------------------------------------------------ *
 *
 * Dos disparadores independientes, ambos citados en la p.6 del catálogo NA:
 * el térmico (`ambiente > objetivo interno`) y el de rating (3R/4/4X exige lazo cerrado).
 */
function verdictCoolingUnits(ctx: GateContext): TechnologyVerdict {
  const citations: Citation[] = [CITATIONS.MATRIZ_TECNOLOGIA, CITATIONS.COOLING_UNITS_ENCABEZADO];
  const warnings: string[] = [...defaultInternalNote(ctx)];

  const closedLoopByRating =
    ctx.nemaRequired !== undefined && ctx.nemaRequired.some((n) => n === "3R" || n === "4" || n === "4X");

  if (ctx.activeCoolingRequired === true) {
    const razonRating = closedLoopByRating
      ? ` Además el rating requerido (NEMA Type ${ctx.nemaRequired!.join("/")}) exige un sistema ` +
        `de lazo cerrado, que es lo que conserva el rating del gabinete.`
      : "";

    // La base de rating es una advertencia, no un veredicto: la capacidad útil real a un
    // punto de operación más severo que DIN 35/35 está en las curvas, que son imágenes.
    if (ctx.ambientMaxC! > 35 || ctx.internalMaxC < 35) {
      warnings.push(
        `La capacidad publicada está referida a la base DIN 35/35 °C. El punto de operación ` +
          `(${fmtC(ctx.ambientMaxC!)} ambiente contra ${fmtC(ctx.internalMaxC)} internos) es más ` +
          `severo que esa referencia, así que la capacidad útil real es menor que la nominal. ` +
          `El derating exacto está en las curvas de performance del datasheet y en PSS.`,
      );
      citations.push(CITATIONS.BASE_DIN_35_35);
    }

    if (ctx.airQuality === "very_harsh") {
      warnings.push(
        "El aire está clasificado como muy hostil: la matriz manda esa condición a PWS " +
          "Air/Water. Conviene comparar ambas familias antes de cerrar.",
      );
    }

    return finish("dts_cooling_units", {
      status: "recommended",
      reason:
        `La temperatura ambiente (${fmtC(ctx.ambientMaxC!)}) supera la temperatura interna ` +
        `objetivo (${fmtC(ctx.internalMaxC)}), así que se requiere cooling activo.${razonRating}`,
      blockingFields: [],
      citations: [
        ...citations,
        CITATIONS.COOLING_ACTIVO_REQUERIDO,
        ...(closedLoopByRating
          ? [CITATIONS.LAZO_CERRADO_CONSERVA_NEMA, CITATIONS.PSS_LOCATION_A_NEMA]
          : []),
        ...defaultInternalCitation(ctx),
      ],
      warnings,
    });
  }

  // El ambiente no obliga, pero el rating puede seguir obligando al lazo cerrado.
  if (ctx.activeCoolingRequired === false && closedLoopByRating) {
    return finish("dts_cooling_units", {
      status: "possible",
      reason:
        `El ambiente (${fmtC(ctx.ambientMaxC!)}) no supera el objetivo interno ` +
        `(${fmtC(ctx.internalMaxC)}), así que el catálogo no obliga a cooling activo. Pero el ` +
        `rating requerido (NEMA Type ${ctx.nemaRequired!.join("/")}) sí exige un sistema de lazo ` +
        `cerrado, y una cooling unit lo cumple. Compárese con PKS Air/Air, que también es lazo ` +
        `cerrado y no consume ciclo de refrigeración.`,
      blockingFields: [],
      citations: [...citations, CITATIONS.LAZO_CERRADO_CONSERVA_NEMA, CITATIONS.PSS_LOCATION_A_NEMA],
      warnings,
    });
  }

  if (ctx.activeCoolingRequired === false) {
    return finish("dts_cooling_units", {
      status: "possible",
      reason:
        `El ambiente (${fmtC(ctx.ambientMaxC!)}) está por debajo del objetivo interno ` +
        `(${fmtC(ctx.internalMaxC)}): el catálogo no exige cooling activo y la convección ` +
        `forzada es la solución económica. Una cooling unit funcionaría, pero es la opción ` +
        `cara para esta condición.`,
      blockingFields: [],
      citations: [...citations, CITATIONS.CONVECCION_NATURAL_ECONOMICA],
      warnings,
    });
  }

  // Falta el ambiente: no se puede aplicar la regla. No se rechaza.
  const blocking = missingBasics(ctx, { needsAmbient: true, needsAirQuality: false });
  return finish("dts_cooling_units", {
    status: "blocked",
    reason: blockedReason("DTS Cooling Units", blocking),
    blockingFields: blocking,
    citations: [...citations, CITATIONS.COOLING_ACTIVO_REQUERIDO],
    warnings,
  });
}

/* ------------------------------------------------------------------ *
 * Familia 4 · PWS Air/Water Heat Exchangers
 * ------------------------------------------------------------------ *
 *
 * El catálogo enuncia dos condiciones (NA p.9): que **haya agua** disponible en el
 * gabinete, y que el entorno sea extremo. Sin saber lo primero, el veredicto es
 * `blocked` — nunca un rechazo.
 */
function verdictPws(ctx: GateContext): TechnologyVerdict {
  const citations: Citation[] = [
    CITATIONS.MATRIZ_TECNOLOGIA,
    CITATIONS.PWS_ENCABEZADO,
    CITATIONS.PWS_REQUIERE_AGUA,
  ];
  const warnings: string[] = [...defaultInternalNote(ctx)];

  if (ctx.processWaterAvailable === false) {
    return finish("pws_air_water", {
      status: "rejected",
      reason:
        `El cliente declara que no hay agua de proceso disponible en el gabinete. El catálogo ` +
        `pone esa disponibilidad como primera condición de aplicabilidad del Air/Water Heat ` +
        `Exchanger, así que la familia queda descartada por acometida, no por capacidad.`,
      blockingFields: [],
      citations,
      warnings,
    });
  }

  const blocking = missingBasics(ctx, { needsAmbient: true, needsAirQuality: true });
  if (ctx.processWaterAvailable === undefined) blocking.push("process_water_available");

  const encaja =
    ctx.activeCoolingRequired === true || ctx.airQuality === "very_harsh" || ctx.airQuality === "dirty";

  if (blocking.length > 0) {
    // Se dice lo que ya se sabe aunque el veredicto siga trabado: eso es lo que convierte
    // la compuerta en algo útil antes de tener todos los datos.
    const preludio = encaja
      ? `Las condiciones del entorno encajan con la fila "High Ambient and/or Very Harsh, Dirty ` +
        `Conditions" de la matriz, y el PWS no se derratea en ambiente alto porque no descarga ` +
        `calor al ambiente. `
      : "";
    if (encaja) citations.push(CITATIONS.PWS_SIN_DERATING);

    return finish("pws_air_water", {
      status: "blocked",
      reason:
        preludio +
        `No se puede confirmar la familia: ${blockedTail(blocking)}. ` +
        `El veredicto queda bloqueado y se reporta como alternativa, no como recomendación.`,
      blockingFields: blocking,
      citations,
      warnings,
    });
  }

  if (ctx.airQuality === "very_harsh" || ctx.activeCoolingRequired === true) {
    return finish("pws_air_water", {
      status: "recommended",
      reason:
        `Hay agua de proceso disponible y el entorno encaja con la fila "High Ambient and/or ` +
        `Very Harsh, Dirty Conditions" de la matriz. A diferencia de una cooling unit, el PWS ` +
        `no descarga calor al ambiente, así que no hay que derratearlo en ambiente alto.`,
      blockingFields: [],
      citations: [...citations, CITATIONS.PWS_SIN_DERATING],
      warnings,
    });
  }

  return finish("pws_air_water", {
    status: "possible",
    reason:
      `Hay agua de proceso disponible, pero el entorno no es de los extremos que el catálogo ` +
      `pone como segunda condición: el ambiente (${fmtC(ctx.ambientMaxC!)}) no supera el ` +
      `objetivo interno (${fmtC(ctx.internalMaxC)}) y el aire no está clasificado como muy ` +
      `hostil. Aplicable, pero hay opciones más simples en la matriz.`,
    blockingFields: [],
    citations,
    warnings,
  });
}

/* ------------------------------------------------------------------ *
 * Ayudas — pequeñas, puras, sin efectos
 * ------------------------------------------------------------------ */

function missingBasics(
  ctx: GateContext,
  needs: { needsAmbient: boolean; needsAirQuality: boolean },
): string[] {
  const out: string[] = [];
  if (needs.needsAmbient && ctx.ambientMaxC === undefined) out.push("ambient_temp_max_c");
  if (ctx.location === undefined) out.push("location");
  if (needs.needsAirQuality && ctx.airQuality === undefined) out.push("air_quality");
  return out;
}

const FIELD_LABEL: Readonly<Record<string, string>> = {
  ambient_temp_max_c: "la temperatura ambiente máxima",
  location: "si la instalación es indoor, outdoor o washdown",
  air_quality: "la calidad del aire del entorno",
  process_water_available: "si hay agua de proceso disponible en el gabinete",
  total_dissipation_w: "la disipación térmica total real del gabinete",
  supply_voltage: "el voltaje de alimentación disponible",
  housing_material: "el material del gabinete",
};

function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

function blockedTail(blocking: string[]): string {
  return `falta ${joinEs(blocking.map(fieldLabel))}`;
}

function blockedReason(familyLabel: string, blocking: string[]): string {
  return (
    `No hay datos suficientes para pronunciarse sobre ${familyLabel}: ` +
    `${blockedTail(blocking)}. El veredicto queda bloqueado, no rechazado.`
  );
}

function airQualityLabel(q: "clean_or_slightly_dirty" | "dirty" | "very_harsh"): string {
  switch (q) {
    case "clean_or_slightly_dirty":
      return "limpio o poco sucio";
    case "dirty":
      return "sucio";
    case "very_harsh":
      return "muy hostil";
  }
}
