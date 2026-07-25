/**
 * B3 · Shortlist determinista de Cooling Units. **TypeScript puro, sin LLM, sin red.**
 *
 * El presupuesto térmico son tres pasos, todos documentados y sin coeficientes
 * inventados (§4.2.b del spec):
 *
 *   1. `PD` = disipación total **declarada** o **sumada** de la lista de componentes.
 *      Nunca estimada. Si no hay ninguna de las dos, la selección por capacidad se
 *      detiene y `total_dissipation_w` sale como bloqueante.
 *   2. `required_w = PD × 1.10` — margen citado de `DTS_2017`.
 *   3. Se filtran los modelos por el **extremo bajo** de su rango, y se advierte cuando
 *      el punto de operación es más severo que la base DIN 35/35 °C.
 *
 * Lo que este módulo **no** hace, a propósito:
 *
 *   - No implementa `PC = PD − PR`: exige el coeficiente de transmisión `C` y la
 *     superficie efectiva `A`, que es exactamente lo que resuelve PSS.
 *   - No lee las curvas de performance: en el PDF son imágenes.
 *   - No deriva watts disipados de la potencia nominal de un motor o variador.
 *
 * Los modelos rechazados **se devuelven igual**, con su razón. Ocultarlos sería quitar
 * la mitad del valor: el caso negativo argumentado es el producto.
 */

import type { HousingMaterial, ProjectSpec, SupplyVoltage } from "../project-spec";
import { resolveSpec } from "../project-spec";
import {
  CAPACITY_MARGIN_FACTOR,
  CITATIONS,
  COOLING_UNIT_MODELS,
  MOUNTING_BY_INSTALLATION,
  NEMA_BY_LOCATION,
  WATTS_TO_BTU_PER_HOUR,
  coolingUnitSeries,
  variantsOfSeries,
} from "./catalog-data";
import type {
  Citation,
  CoolingUnitCandidate,
  CoolingUnitModel,
  CoolingUnitShortlistResult,
  MountingType,
  NemaRating,
} from "./types";
import {
  fmtBtuH,
  fmtPct,
  fmtW,
  installationLabel,
  joinEs,
  materialLabel,
  mountingLabel,
  voltageLabel,
} from "./reasons";

/* ------------------------------------------------------------------ *
 * Cálculo de capacidad requerida — conversión de unidades, no ingeniería
 * ------------------------------------------------------------------ */

/**
 * Decimales con los que se publican las capacidades derivadas.
 *
 * Los datos de entrada son watts enteros declarados por el cliente, así que un décimo de
 * watt ya está muy por debajo de la incertidumbre real. Redondear aquí evita sacar
 * `1485.0000000000002` al brief y a la ficha — un artefacto del punto flotante que el
 * post-check numérico de la Pista A leería como un número sin respaldo.
 */
const DERIVED_CAPACITY_DECIMALS = 1;

function roundDerived(value: number): number {
  const factor = 10 ** DERIVED_CAPACITY_DECIMALS;
  return Math.round(value * factor) / factor;
}

/** `1 W ≈ 3.412142 Btu/h`. Constante declarada en `catalog-data.ts` y probada en B4. */
export function wattsToBtuPerHour(watts: number): number {
  return watts * WATTS_TO_BTU_PER_HOUR;
}

/** Aplica el margen documentado del 10 %: `required_w = total_dissipation_w × 1.10`. */
export function applyCapacityMargin(totalDissipationW: number): number {
  return totalDissipationW * CAPACITY_MARGIN_FACTOR;
}

export type DissipationResolution = {
  totalDissipationW: number | undefined;
  source: "declared" | "component_sum" | undefined;
};

/**
 * Resuelve `PD` por los dos caminos permitidos, en orden de preferencia.
 *
 * El camino de la lista de componentes es una **suma**, no una estimación: solo suma los
 * watts que el cliente declaró por componente. El tercer camino de PSS (cálculo por
 * temperatura registrada) se detecta y se deriva; aquí no se implementa.
 */
export function resolveTotalDissipationW(spec: ProjectSpec): DissipationResolution {
  const r = resolveSpec(spec);

  if (r.total_dissipation_w !== undefined) {
    return { totalDissipationW: r.total_dissipation_w, source: "declared" };
  }

  const components = r.component_list;
  if (components !== undefined && components.length > 0) {
    const sum = components.reduce((acc, c) => acc + c.w * (c.qty ?? 1), 0);
    return { totalDissipationW: sum, source: "component_sum" };
  }

  return { totalDissipationW: undefined, source: undefined };
}

/* ------------------------------------------------------------------ *
 * API pública
 * ------------------------------------------------------------------ */

/**
 * Firma del plan de implementación. Devuelve los candidatos, aceptados y rechazados.
 *
 * Cuando falta `total_dissipation_w` y no hay lista de componentes, la selección por
 * capacidad **se detiene** y esto devuelve `[]`. El campo bloqueante y el porqué están
 * en `evaluateCoolingUnitShortlist`, que es lo que consume `/api/turn` y el brief.
 */
export function buildCoolingUnitShortlist(spec: ProjectSpec): CoolingUnitCandidate[] {
  return evaluateCoolingUnitShortlist(spec).candidates;
}

/** Resultado completo: capacidad requerida, campos bloqueantes, candidatos y citas. */
export function evaluateCoolingUnitShortlist(spec: ProjectSpec): CoolingUnitShortlistResult {
  const r = resolveSpec(spec);
  const { totalDissipationW, source } = resolveTotalDissipationW(spec);

  const baseCitations: Citation[] = [
    CITATIONS.MARGEN_10_PCT,
    CITATIONS.BASE_DIN_35_35,
    CITATIONS.CAPACIDAD_VARIA_POR_VOLTAJE,
  ];

  const notAsserted = [
    "La capacidad neta en el punto de operación real: el derating está en las curvas de " +
      "performance, que en el PDF son imágenes y no se leen.",
    "El punto exacto dentro del rango de capacidad publicado: varía por voltaje y configuración.",
    "El dimensionamiento certificado. Eso es PSS, con superficie efectiva, material y carga solar.",
    "La fórmula PC = PD − PR no se implementa: exige el coeficiente de transmisión y la " +
      "superficie efectiva del gabinete.",
  ];

  // ---- Bloqueo duro: sin PD no hay selección por capacidad. ----
  if (totalDissipationW === undefined) {
    return {
      blockingFields: ["total_dissipation_w"],
      candidates: [],
      citations: [...baseCitations, CITATIONS.PSS_VERIFICAR_DISIPACION, CITATIONS.FORMULA_PC_PD_PR],
      notAsserted: [
        ...notAsserted,
        "La disipación térmica del gabinete. No se estima: si el cliente no la declara ni da " +
          "una lista de componentes con watts, el campo queda faltante.",
      ],
    };
  }

  const requiredW = roundDerived(applyCapacityMargin(totalDissipationW));
  const requiredBtuH = roundDerived(wattsToBtuPerHour(requiredW));

  const filters = buildFilters(spec);
  const candidates = coolingUnitSeries().map((serie) =>
    evaluateSeries(serie, requiredW, requiredBtuH, filters),
  );

  rankQualifying(candidates, requiredBtuH);
  sortForPresentation(candidates);

  const blockingFields = [...filters.blockingFields];
  if (source === "component_sum") {
    // No bloquea, pero sí obliga a verificar: los valores por componente suelen venir del
    // datasheet del fabricante y ser más altos que el consumo real.
    notAsserted.push(
      "Que la suma por componentes coincida con la disipación real: el propio PSS recomienda " +
        "verificar la pérdida de cada componente.",
    );
  }

  return {
    totalDissipationW,
    ...(source !== undefined ? { totalDissipationSource: source } : {}),
    requiredCapacityW: requiredW,
    requiredCapacityBtuH: requiredBtuH,
    blockingFields,
    candidates,
    citations: [
      ...baseCitations,
      ...(source === "component_sum" ? [CITATIONS.PSS_VERIFICAR_DISIPACION] : []),
      ...(r.location !== undefined ? [CITATIONS.PSS_LOCATION_A_NEMA] : []),
      ...(r.supply_voltage !== undefined ? [CITATIONS.PSS_VOLTAJE_BLOQUEANTE] : []),
      CITATIONS.EVITAR_SOBREDIMENSIONAR,
    ],
    notAsserted,
  };
}

/* ------------------------------------------------------------------ *
 * Filtros — cada uno depende de un campo del spec
 * ------------------------------------------------------------------ */

type Filters = {
  supplyVoltage: SupplyVoltage | undefined;
  nemaRequired: readonly NemaRating[] | undefined;
  washdownRequired: boolean | undefined;
  housingMaterial: HousingMaterial | undefined;
  allowedMountings: readonly MountingType[] | undefined;
  installationLabelText: string | undefined;
  enclosureHeightMm: number | undefined;
  enclosureWidthMm: number | undefined;
  enclosureDepthMm: number | undefined;
  blockingFields: string[];
};

function buildFilters(spec: ProjectSpec): Filters {
  const r = resolveSpec(spec);
  const blockingFields: string[] = [];

  if (r.supply_voltage === undefined) blockingFields.push("supply_voltage");
  if (r.location === undefined) blockingFields.push("location");
  if (r.height_mm === undefined || r.width_mm === undefined || r.depth_mm === undefined) {
    blockingFields.push("enclosure_dimensions_mm");
  }
  // El material solo bloquea si la aplicación es washdown (§3.5).
  if (r.location === "washdown" && r.housing_material === undefined) {
    blockingFields.push("housing_material");
  }

  return {
    supplyVoltage: r.supply_voltage,
    nemaRequired: r.location === undefined ? undefined : NEMA_BY_LOCATION[r.location],
    washdownRequired: r.location === undefined ? undefined : r.location === "washdown",
    housingMaterial: r.housing_material,
    allowedMountings:
      r.installation === undefined ? undefined : MOUNTING_BY_INSTALLATION[r.installation],
    installationLabelText: r.installation === undefined ? undefined : installationLabel(r.installation),
    enclosureHeightMm: r.height_mm,
    enclosureWidthMm: r.width_mm,
    enclosureDepthMm: r.depth_mm,
    blockingFields,
  };
}

/* ------------------------------------------------------------------ *
 * Evaluación por serie
 * ------------------------------------------------------------------ */

type VariantCheck = {
  model: CoolingUnitModel;
  rejections: string[];
  warnings: string[];
  citations: Citation[];
};

function evaluateSeries(
  serie: string,
  requiredW: number,
  requiredBtuH: number,
  filters: Filters,
): CoolingUnitCandidate {
  const variants = variantsOfSeries(serie);
  const head = variants[0]!;
  const { capacidadMinBtuH, capacidadMaxBtuH } = head;

  const base = {
    series: serie,
    requiredCapacityW: requiredW,
    requiredCapacityBtuH: requiredBtuH,
    capacidadMinBtuH,
    capacidadMaxBtuH,
  } as const;

  // ---- 1 · Capacidad. Es propiedad de la serie, así que se resuelve antes que nada. ----
  if (capacidadMaxBtuH < requiredBtuH) {
    return {
      ...base,
      model: serie,
      ...(head.designacionComercial !== undefined
        ? { designacionComercial: head.designacionComercial }
        : {}),
      status: "rejected",
      reason:
        `Capacidad insuficiente: el techo del rango publicado (${fmtBtuH(capacidadMaxBtuH)}) ` +
        `queda por debajo de lo requerido (${fmtBtuH(requiredBtuH)} = ${fmtW(requiredW)} con el ` +
        `margen documentado del 10 %).`,
      citations: [head.cita, CITATIONS.MARGEN_10_PCT],
      rejectionReasons: [
        `Capacidad máxima ${fmtBtuH(capacidadMaxBtuH)} < requerido ${fmtBtuH(requiredBtuH)}`,
      ],
      verificationWarnings: [],
    };
  }

  // ---- 2 · Variantes: rating, washdown, material, voltaje, montaje, dimensiones. ----
  const checks = variants.map((m) => checkVariant(m, filters));
  const qualifying = checks.filter((c) => c.rejections.length === 0);

  if (qualifying.length === 0) {
    // Ninguna variante de la serie sirve. Se agrega el porqué, deduplicado y estable.
    const rejectionReasons = dedupe(checks.flatMap((c) => c.rejections));
    const citations = dedupeCitations([
      head.cita,
      ...(head.citaRating !== undefined ? [head.citaRating] : []),
      ...checks.flatMap((c) => c.citations),
    ]);
    return {
      ...base,
      model: serie,
      ...(head.designacionComercial !== undefined
        ? { designacionComercial: head.designacionComercial }
        : {}),
      status: "rejected",
      reason:
        `La capacidad alcanzaría (${fmtBtuH(capacidadMinBtuH)} – ${fmtBtuH(capacidadMaxBtuH)}), ` +
        `pero ninguna variante documentada de la serie cumple: ${joinEs(rejectionReasons)}.`,
      citations,
      rejectionReasons,
      verificationWarnings: dedupe(checks.flatMap((c) => c.warnings)),
    };
  }

  // Entre las variantes válidas se toma la primera del catálogo — el orden de
  // `catalog-data.ts` es Indoor → Outdoor → Washdown, de menos a más rating.
  const chosen = qualifying[0]!;
  const margenPct = ((capacidadMinBtuH - requiredBtuH) / requiredBtuH) * 100;

  const warnings = [...chosen.warnings];
  const citations = dedupeCitations([
    chosen.model.cita,
    ...(chosen.model.citaRating !== undefined ? [chosen.model.citaRating] : []),
    ...chosen.citations,
    CITATIONS.MARGEN_10_PCT,
    CITATIONS.CAPACIDAD_VARIA_POR_VOLTAJE,
  ]);

  // El requerido cae DENTRO del rango publicado: como el rango varía por voltaje y
  // configuración, no se puede afirmar que la unidad entregue el valor necesario.
  const dentroDelRango = capacidadMinBtuH < requiredBtuH;

  if (dentroDelRango) {
    const deficitPct = ((requiredBtuH - capacidadMinBtuH) / requiredBtuH) * 100;
    warnings.unshift(
      `El extremo bajo del rango (${fmtBtuH(capacidadMinBtuH)}) queda ${fmtPct(deficitPct)} por ` +
        `debajo de lo requerido (${fmtBtuH(requiredBtuH)}). Como la capacidad varía por voltaje ` +
        `y configuración, hay que confirmar el valor específico` +
        (filters.supplyVoltage !== undefined ? ` a ${voltageLabel(filters.supplyVoltage)}` : "") +
        ` antes de comprometer el modelo.`,
    );
  } else {
    warnings.push(
      `Margen de ${fmtPct(margenPct)} sobre lo requerido en el extremo bajo del rango. ` +
        `Aceptable, pero el catálogo advierte contra el sobredimensionamiento costoso.`,
    );
    citations.push(CITATIONS.EVITAR_SOBREDIMENSIONAR);
  }

  return {
    ...base,
    model: chosen.model.modelo,
    ...(chosen.model.designacionComercial !== undefined
      ? { designacionComercial: chosen.model.designacionComercial }
      : {}),
    // `rankQualifying` decide entre `recommended` / `verify` / `alternative`.
    status: dentroDelRango ? "verify" : "recommended",
    reason: qualifyingReason(chosen.model, requiredBtuH, dentroDelRango, filters),
    margenSobreRequeridoPct: margenPct,
    citations,
    rejectionReasons: [],
    verificationWarnings: warnings,
  };
}

function qualifyingReason(
  model: CoolingUnitModel,
  requiredBtuH: number,
  dentroDelRango: boolean,
  filters: Filters,
): string {
  const partes: string[] = [
    `Rango publicado ${fmtBtuH(model.capacidadMinBtuH)} – ${fmtBtuH(model.capacidadMaxBtuH)} ` +
      `contra ${fmtBtuH(requiredBtuH)} requeridos`,
  ];

  if (filters.supplyVoltage !== undefined) {
    partes.push(`disponible en ${voltageLabel(filters.supplyVoltage)}`);
  }
  if (model.ratingsNema.length > 0) {
    partes.push(`NEMA Type ${model.ratingsNema.join("/")}`);
  }
  partes.push(mountingLabel(model.montaje));
  if (filters.washdownRequired === true) {
    partes.push("variante washdown documentada");
  }
  if (
    filters.housingMaterial === "stainless_steel" &&
    model.materialDisponible?.includes("stainless_steel") === true
  ) {
    partes.push("disponible en acero inoxidable");
  }

  const cierre = dentroDelRango
    ? " El requerido cae dentro del rango, así que queda como recomendado con verificación."
    : " Cumple con margen sobre el extremo bajo del rango.";

  return `${partes.join(" · ")}.${cierre}`;
}

/**
 * Ordena los candidatos válidos y reparte los estados.
 *
 * Regla general, **no atada a nombres de modelo**: entre los que cumplen, el de menor
 * extremo bajo es la primera opción; el resto pasan a alternativas. Si el requerido cae
 * dentro del rango de la primera opción, esa queda en `verify` en vez de `recommended`.
 */
function rankQualifying(candidates: CoolingUnitCandidate[], requiredBtuH: number): void {
  const qualifying = candidates
    .filter((c) => c.status !== "rejected")
    .sort((a, b) => a.capacidadMinBtuH - b.capacidadMinBtuH);

  qualifying.forEach((c, index) => {
    if (index === 0) {
      c.status = c.capacidadMinBtuH < requiredBtuH ? "verify" : "recommended";
      return;
    }
    c.status = "alternative";
    c.reason = `${c.reason} Se reporta como alternativa: hay una serie más ajustada que cumple.`;
  });
}

/**
 * Orden de presentación, determinista y sin umbrales inventados: primero la opción
 * principal, luego las alternativas de menor a mayor sobredimensionamiento, y al final
 * los descartes de mayor a menor capacidad.
 *
 * **Los rechazados no se filtran, solo se ordenan.** La UI puede cortar la lista donde
 * quiera; el motor entrega todo, que es lo que sostiene el caso negativo argumentado.
 */
function sortForPresentation(candidates: CoolingUnitCandidate[]): void {
  const rank: Record<string, number> = { recommended: 0, verify: 0, alternative: 1, rejected: 2 };
  candidates.sort((a, b) => {
    const byStatus = rank[a.status]! - rank[b.status]!;
    if (byStatus !== 0) return byStatus;
    if (a.status === "rejected") return b.capacidadMaxBtuH - a.capacidadMaxBtuH;
    return a.capacidadMinBtuH - b.capacidadMinBtuH;
  });
}

/* ------------------------------------------------------------------ *
 * Chequeo de una variante
 * ------------------------------------------------------------------ */

function checkVariant(model: CoolingUnitModel, filters: Filters): VariantCheck {
  const rejections: string[] = [];
  const warnings: string[] = [];
  const citations: Citation[] = [];

  // --- Rating NEMA ---
  if (filters.nemaRequired !== undefined) {
    citations.push(CITATIONS.PSS_LOCATION_A_NEMA);
    if (model.ratingsNema.length === 0) {
      rejections.push(
        `${model.modelo}: el catálogo no publica rating NEMA para esta serie y la aplicación ` +
          `exige NEMA Type ${filters.nemaRequired.join("/")}`,
      );
    } else {
      const faltantes = filters.nemaRequired.filter((n) => !model.ratingsNema.includes(n));
      if (faltantes.length > 0) {
        rejections.push(
          `${model.modelo}: documentado como NEMA Type ${model.ratingsNema.join("/")}, no cubre ` +
            `Type ${faltantes.join("/")}`,
        );
      }
    }
  } else {
    warnings.push(
      "Falta saber si la instalación es indoor, outdoor o washdown: el rating NEMA no se pudo " +
        "verificar.",
    );
  }

  // --- Washdown ---
  if (filters.washdownRequired === true && !model.washdown) {
    citations.push(CITATIONS.LAZO_CERRADO_CONSERVA_NEMA);
    rejections.push(
      `${model.modelo}: no hay variante washdown documentada para esta serie`,
    );
  }

  // --- Material del gabinete (solo bloquea en washdown, §3.5) ---
  if (filters.washdownRequired === true && filters.housingMaterial === "stainless_steel") {
    if (model.materialDisponible === undefined) {
      warnings.push(
        `${model.modelo}: el catálogo no publica los materiales disponibles de esta serie; ` +
          `confirmar el acabado inoxidable con Pfannenberg.`,
      );
    } else if (!model.materialDisponible.includes("stainless_steel")) {
      rejections.push(
        `${model.modelo}: solo documentado en ${joinEs(
          model.materialDisponible.map(materialLabel),
        )}, y el gabinete es de acero inoxidable`,
      );
    }
  }

  // --- Voltaje ---
  if (filters.supplyVoltage !== undefined) {
    citations.push(CITATIONS.PSS_VOLTAJE_BLOQUEANTE);
    if (!model.voltajes.includes(filters.supplyVoltage)) {
      rejections.push(
        `${model.modelo}: no disponible en ${voltageLabel(filters.supplyVoltage)} ` +
          `(catálogo: ${model.voltajesCatalogo.join(" / ")})`,
      );
    }
  } else {
    warnings.push(
      "Falta el voltaje de alimentación: el catálogo advierte que cambia qué unidades " +
        "aparecen en la solución.",
    );
  }

  // --- Montaje ---
  if (filters.allowedMountings !== undefined) {
    citations.push(CITATIONS.PSS_INSTALACION);
    if (!filters.allowedMountings.includes(model.montaje)) {
      rejections.push(
        `${model.modelo}: ${mountingLabel(model.montaje)} no es viable con el gabinete ` +
          `${filters.installationLabelText}`,
      );
    }
  } else {
    warnings.push(
      "Falta cómo va instalado el gabinete: no se pudieron descartar los montajes sin cara " +
        "disponible.",
    );
  }

  // --- Verificación mecánica ---
  const dim = model.dimensiones;
  if (dim === undefined) {
    warnings.push(`${model.modelo}: el catálogo no publica dimensiones para esta variante.`);
  } else if (
    filters.enclosureHeightMm === undefined ||
    filters.enclosureWidthMm === undefined ||
    filters.enclosureDepthMm === undefined
  ) {
    citations.push(CITATIONS.PSS_DIMENSIONES);
    warnings.push(
      "Faltan las dimensiones del gabinete: la verificación mecánica del montaje queda pendiente.",
    );
  } else {
    citations.push(CITATIONS.PSS_DIMENSIONES);
    const fits = fitsOnEnclosure(model, dim, filters);
    if (fits === false) {
      rejections.push(
        `${model.modelo}: no cabe en el gabinete declarado ` +
          `(${filters.enclosureHeightMm} × ${filters.enclosureWidthMm} × ` +
          `${filters.enclosureDepthMm} mm)`,
      );
    }
  }

  return { model, rejections, warnings, citations };
}

/**
 * Verificación mecánica mínima y honesta: la unidad tiene que caber en la cara donde va.
 * No sustituye a la `Cut-out compatibility list`, que está fuera del alcance del MVP.
 */
function fitsOnEnclosure(
  model: CoolingUnitModel,
  dim: NonNullable<CoolingUnitModel["dimensiones"]>,
  filters: Filters,
): boolean | undefined {
  const h = filters.enclosureHeightMm;
  const w = filters.enclosureWidthMm;
  const d = filters.enclosureDepthMm;
  if (h === undefined || w === undefined || d === undefined) return undefined;

  if (model.montaje === "top") {
    if (dim.anchoMm === undefined || dim.profundidadMm === undefined) return undefined;
    return dim.anchoMm <= w && dim.profundidadMm <= d;
  }
  // Lateral e integrado ocupan una cara vertical: manda el alto.
  if (dim.altoMm === undefined) return undefined;
  return dim.altoMm <= h;
}

/* ------------------------------------------------------------------ *
 * Utilidades
 * ------------------------------------------------------------------ */

function dedupe(items: readonly string[]): string[] {
  return [...new Set(items)];
}

function dedupeCitations(items: readonly Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of items) {
    const key = `${c.documento}#${c.pagina}#${c.texto_citado}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

/** Todas las series del catálogo, para tests y para la tool `specs_modelo` (Pista C). */
export function allCoolingUnitModels(): readonly CoolingUnitModel[] {
  return COOLING_UNIT_MODELS;
}
