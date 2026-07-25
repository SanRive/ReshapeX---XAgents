import { CITATIONS, COOLING_UNIT_MODELS } from "../rules/catalog-data";
import type { Citation, CoolingUnitModel } from "../rules/types";

export type ModelSpecs = {
  query: string;
  matchedModel: string;
  family?: string;
  series?: string;
  articleNumbers: Array<{
    articleNumber: string;
    voltage?: string;
    frequency?: string;
    currentA?: number;
    citation: Citation;
    currentCitation?: Citation;
  }>;
  capacity?: { min?: number; max?: number; unit: "W" | "Btu/h"; citation: Citation };
  mounting?: "side" | "integrated" | "top";
  dimensions?: { heightMm?: number; widthMm?: number; depthMm?: number; citation: Citation };
  nemaRatings?: string[];
  washdown?: boolean;
  materials?: string[];
  citations: Citation[];
  warnings: string[];
};

export type ModelLookupResult =
  | { status: "found"; specs: ModelSpecs }
  | { status: "ambiguous"; matches: string[] }
  | { status: "not_found"; query: string };

type ElectricalVariant = ModelSpecs["articleNumbers"][number];
const COMPACT_CATALOG = "DownloadCentre/CompactCatalogue/Pfannenberg_Compact_catalogue_30_en.pdf";

/**
 * Fila "Current consumption" de la p.18 del Compact Catalogue: aplica a las
 * cuatro variantes (230V/400V x Standard/Multi Controller) — es una única
 * fila de tabla compartida, no una síntesis por variante.
 */
const DTT_6301_CURRENT_CITATION: Citation = {
  documento: COMPACT_CATALOG,
  pagina: 18,
  texto_citado: "Current consumption 5.73 | 7 A 3.75 | 3.6 A",
};

const DTT_6301_ELECTRICAL: readonly ElectricalVariant[] = [
  {
    articleNumber: "13256341055",
    voltage: "230 V AC",
    frequency: "50 | 60 Hz",
    currentA: 5.73,
    citation: { documento: COMPACT_CATALOG, pagina: 18, texto_citado: "DTT 6301 230 V 13256341055 13256371055" },
    currentCitation: DTT_6301_CURRENT_CITATION,
  },
  {
    articleNumber: "13256349055",
    voltage: "400 V 2~ AC",
    frequency: "50 | 60 Hz",
    currentA: 3.75,
    citation: { documento: COMPACT_CATALOG, pagina: 18, texto_citado: "DTT 6301 400 V 13256349055 13256379055" },
    currentCitation: DTT_6301_CURRENT_CITATION,
  },
  {
    articleNumber: "13256371055",
    voltage: "230 V AC",
    frequency: "50 | 60 Hz",
    currentA: 7,
    citation: { documento: COMPACT_CATALOG, pagina: 18, texto_citado: "DTT 6301 230 V 13256341055 13256371055" },
    currentCitation: DTT_6301_CURRENT_CITATION,
  },
  {
    articleNumber: "13256379055",
    voltage: "400 V 2~ AC",
    frequency: "50 | 60 Hz",
    currentA: 3.6,
    citation: { documento: COMPACT_CATALOG, pagina: 18, texto_citado: "DTT 6301 400 V 13256349055 13256379055" },
    currentCitation: DTT_6301_CURRENT_CITATION,
  },
] as const;

export function normalizeModel(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function uniqueSeries(): CoolingUnitModel[] {
  const series = new Map<string, CoolingUnitModel>();
  for (const model of COOLING_UNIT_MODELS) {
    if (!series.has(model.serie)) series.set(model.serie, model);
  }
  return [...series.values()];
}

function uniqueCitations(citations: Citation[]): Citation[] {
  return [...new Map(citations.map((citation) => [`${citation.documento}:${citation.pagina}:${citation.texto_citado}`, citation])).values()];
}

function buildSpecs(query: string, model: CoolingUnitModel): ModelSpecs {
  const variants = COOLING_UNIT_MODELS.filter((candidate) => candidate.serie === model.serie);
  const articleNumbers = model.serie === "DTT 6301" ? [...DTT_6301_ELECTRICAL] : [];
  const citations = uniqueCitations([
    ...variants.flatMap((variant) => [variant.cita, ...(variant.citaRating ? [variant.citaRating] : [])]),
    ...articleNumbers.flatMap((article) => [article.citation, ...(article.currentCitation ? [article.currentCitation] : [])]),
    CITATIONS.CAPACIDAD_VARIA_POR_VOLTAJE,
  ]);
  const ratings = [...new Set(variants.flatMap((variant) => variant.ratingsNema))];
  const materials = [...new Set(variants.flatMap((variant) => variant.materialDisponible ?? []))];
  const dimensions = model.dimensiones;
  const warnings = [
    "Cooling capacity may vary between voltage and configurations.",
    ...(articleNumbers.length === 0
      ? ["The in-scope tables do not publish article numbers or current consumption for this model series."]
      : ["Current differs by voltage and controller configuration; article variants are kept separate."]),
    ...(variants.length > 1 ? ["Ratings, material and dimensions can vary by Indoor, Outdoor or Washdown configuration."] : []),
  ];
  return {
    query,
    matchedModel: model.serie,
    family: "Cooling Units",
    series: model.serie.slice(0, 3),
    articleNumbers,
    capacity: { min: model.capacidadMinBtuH, max: model.capacidadMaxBtuH, unit: "Btu/h", citation: model.cita },
    mounting: model.montaje,
    ...(dimensions
      ? {
          dimensions: {
            ...(dimensions.altoMm === undefined ? {} : { heightMm: dimensions.altoMm }),
            ...(dimensions.anchoMm === undefined ? {} : { widthMm: dimensions.anchoMm }),
            ...(dimensions.profundidadMm === undefined ? {} : { depthMm: dimensions.profundidadMm }),
            citation: model.cita,
          },
        }
      : {}),
    nemaRatings: ratings,
    washdown: variants.some((variant) => variant.washdown),
    materials,
    citations,
    warnings,
  };
}

export function lookupModelo(modelo: string): ModelLookupResult {
  const query = typeof modelo === "string" ? modelo.trim().slice(0, 100) : "";
  if (!query) return { status: "not_found", query };
  const normalized = normalizeModel(query);
  const series = uniqueSeries();
  const exact = series.filter((model) => normalizeModel(model.serie) === normalized);
  if (exact.length === 1 && exact[0]) return { status: "found", specs: buildSpecs(query, exact[0]) };
  const partial = series.filter((model) => normalizeModel(model.serie).includes(normalized));
  if (partial.length === 1 && partial[0]) return { status: "found", specs: buildSpecs(query, partial[0]) };
  if (partial.length > 1) return { status: "ambiguous", matches: partial.map((model) => model.serie) };
  return { status: "not_found", query };
}

export function specsModelo(modelo: string): ModelSpecs | null {
  const result = lookupModelo(modelo);
  return result.status === "found" ? result.specs : null;
}
