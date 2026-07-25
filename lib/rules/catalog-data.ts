/**
 * B1 · Datos curados del catálogo Pfannenberg.
 *
 * **Transcripción a mano desde `corpus_txt/`, con cita.** Aquí no hay lógica: solo
 * hechos del catálogo. Las reglas que los consumen están en `gate.ts` y `shortlist.ts`.
 *
 * Origen de cada dato y cómo reproducirlo:
 *
 *   pdftotext -layout "<archivo>.pdf" salida.txt
 *
 * Los números de página son **páginas del PDF**, contadas por saltos de página (`\f`)
 * del texto extraído. Para `Thermal_Management_Catalog_12_Page-Final_2024` coinciden con
 * el pie impreso; para `Catalog_InsidePages_Master__Final_2025` el PDF va una página por
 * delante del número impreso (portada), y manda el número de PDF por ser el reproducible.
 *
 * Nada de lo que hay aquí se estima. Lo que el catálogo no publica queda `undefined` o,
 * en el caso de `ratingsNema`, como lista vacía — que significa *no publicado*, no
 * *no cumple*.
 */

import type { Citation, CoolingUnitModel, TechnologyFamily } from "./types";

/* ================================================================== *
 * 0 · Documentos del corpus
 * ================================================================== */

export const DOC = {
  /** Catálogo norteamericano de 12 páginas. Fuente de la matriz y las reglas. */
  CAT_NA: "Pfanember/CATALOGS/Thermal_Management_Catalog_12_Page-Final_2024.pdf",
  /** Catálogo maestro 2025. Fuente del desglose por variante Indoor/Outdoor/Washdown. */
  CAT_MASTER: "Pfanember/CATALOGS/Catalog_InsidePages_Master__Final_2025.pdf",
  /** Datasheet DTS. Fuente del margen del 10 %, la base DIN 35/35 y `PC = PD − PR`. */
  DTS_2017: "Pfanember/COOLING UNITS/DTS_2017.pdf",
  /** Tutorial de PSS. Fuente del mapeo location → NEMA y del set de entradas. */
  PSS: "PSS Tutorial/PSS-Tutorial.pdf",
  /** Compact catalogue. Fuente de la advertencia sobre sobredimensionamiento. */
  COMPACT: "DownloadCentre/CompactCatalogue/Pfannenberg_Compact_catalogue_30_en.pdf",
} as const;

/* ================================================================== *
 * 1 · Constantes de ingeniería — con nombre y unidad explícitos
 * ================================================================== */

/**
 * Conversión de unidades. **No es ingeniería**: es el factor exacto W → Btu/h.
 * 1 W = 3.412142 Btu/h.
 */
export const WATTS_TO_BTU_PER_HOUR = 3.412142;

/**
 * Margen obligatorio sobre la disipación. Regla **documentada**, no intuición:
 * `required_w = total_dissipation_w × 1.10`.
 */
export const CAPACITY_MARGIN_FACTOR = 1.1;

/** Default citado de la temperatura interna objetivo, en °C (§3.5 del spec). */
export const DEFAULT_INTERNAL_TEMP_MAX_C = 35;

/** Base de rating de las unidades: DIN 35/35 °C (ambiente/interior). */
export const DIN_RATING_AMBIENT_C = 35;
export const DIN_RATING_INTERNAL_C = 35;

/* ================================================================== *
 * 2 · Citas textuales (§4.2 del spec)
 * ================================================================== */

export const CITATIONS = {
  /** La matriz de las cuatro familias. */
  MATRIZ_TECNOLOGIA: {
    documento: DOC.CAT_NA,
    pagina: 2,
    texto_citado:
      "Cool Ambient, Clean or Slightly Dirty Conditions — Filterfan 4.0™ & Exhaust Filters | " +
      "Cool Ambient, Dirty Conditions — PKS Air / Air Heat Exchangers | " +
      "High Ambient & Clean or Dirty Conditions — DTS Cooling Units | " +
      "High Ambient and/or Very Harsh, Dirty Conditions — PWS Air/Water Heat Exchangers",
  },

  /** Default de temperatura interna objetivo. */
  TEMPERATURA_INTERNA_OBJETIVO: {
    documento: DOC.CAT_NA,
    pagina: 2,
    texto_citado:
      "Electronics are typically most efficient in low humidity with a temperature around 95°",
  },

  /** Convección natural / exhaust filters: el caso en que NO hace falta cooling activo. */
  CONVECCION_NATURAL_ECONOMICA: {
    documento: DOC.CAT_NA,
    pagina: 4,
    texto_citado:
      "If the ambient temperature is always lower than the required temperature in the " +
      "electrical enclosure, then this method is an economical solution.",
  },

  /** Filterfan 4.0: rating Type 12 por diseño de marco cerrado. */
  FILTERFAN_TYPE_12: {
    documento: DOC.CAT_NA,
    pagina: 3,
    texto_citado:
      "Type 12 Protection ensures that the closed frame design prevents unfiltered air " +
      "from penetrating the cabinet.",
  },

  /** Filterfan: la única variante de intemperie documentada es 3R. */
  FILTERFAN_OUTDOOR_3R: {
    documento: DOC.CAT_NA,
    pagina: 4,
    texto_citado:
      "3R Outdoor Filterfans — Outdoor Rated Type 3R protection against the harmful " +
      "effects of weather.",
  },

  /** La regla madre: ambiente > objetivo interno ⇒ cooling activo. */
  COOLING_ACTIVO_REQUERIDO: {
    documento: DOC.CAT_NA,
    pagina: 6,
    texto_citado:
      "If the ambient temperature is greater than the target internal temperature of the " +
      "enclosure, active cooling is required.",
  },

  /** La regla de lazo cerrado: es lo que conserva el rating NEMA del gabinete. */
  LAZO_CERRADO_CONSERVA_NEMA: {
    documento: DOC.CAT_NA,
    pagina: 6,
    texto_citado:
      "If a NEMA Type 12/3R/4/4x rating is required - closed loop systems can maintain " +
      "the NEMA Type rating of the cabinet.",
  },

  /** Encabezado de COOLING UNITS: dónde encajan. */
  COOLING_UNITS_ENCABEZADO: {
    documento: DOC.CAT_NA,
    pagina: 6,
    texto_citado:
      "Best suited for clean or dirty environments where the ambient temperature is " +
      "greater than the target internal temperature of enclosure.",
  },

  /** Encabezado de PKS: aire ambiente demasiado contaminado para entrar al gabinete. */
  PKS_ENCABEZADO: {
    documento: DOC.CAT_NA,
    pagina: 8,
    texto_citado:
      "Best suited when the ambient air is too contaminated or humid to enter the cabinet.",
  },

  /** Encabezado de PWS: ambientes altos y/o aceitosos o muy sucios. */
  PWS_ENCABEZADO: {
    documento: DOC.CAT_NA,
    pagina: 9,
    texto_citado:
      "Best suited where ambient temperatures are high and/or the air is oily or very dirty.",
  },

  /** PWS: las dos condiciones de aplicabilidad, incluida el agua. */
  PWS_REQUIERE_AGUA: {
    documento: DOC.CAT_NA,
    pagina: 9,
    texto_citado:
      "Is an Air to Water Heat Exchanger Right for my Application? • If there is a chilled " +
      "water supply readily available at the enclosure. • If the environment has extreme " +
      "conditions like extremely high ambients, extremely dirty or caustic, that make " +
      "other systems not applicable.",
  },

  /** PWS: no se derratea en ambiente alto porque no descarga calor al ambiente. */
  PWS_SIN_DERATING: {
    documento: DOC.CAT_NA,
    pagina: 9,
    texto_citado:
      "Because there is no heat transfer to the ambient environment, there is no need to " +
      "de-rate the unit's performance in high ambient conditions.",
  },

  /** DTS: variantes de rating documentadas para toda la serie. */
  DTS_VARIANTES_RATING: {
    documento: DOC.CAT_NA,
    pagina: 7,
    texto_citado: "*Also available in Outdoor (Type 3R/4) and Washdown (Type 4/4x).",
  },

  /** DTS: acabados disponibles, incluido inoxidable. */
  DTS_ACABADOS: {
    documento: DOC.CAT_NA,
    pagina: 6,
    texto_citado: "Available Colors: RAL 7035 Grey | ANSI 61 Grey | Stainless Steel",
  },

  /** DTT: la regla de descarte por rating. Solo figura como Type 12. */
  DTT_SOLO_TYPE_12: {
    documento: DOC.CAT_NA,
    pagina: 7,
    texto_citado: "DTT Series Top Mount Type 12 Cooling Units",
  },

  /** DTT en el catálogo maestro: sigue siendo NEMA 12 y solo NEMA 12. */
  DTT_SOLO_NEMA_12_MASTER: {
    documento: DOC.CAT_MASTER,
    pagina: 47,
    texto_citado: "DTT Series Top Mount NEMA 12 Cooling Units",
  },

  /** DTI: el catálogo lo lista sin declarar rating NEMA. */
  DTI_SIN_RATING_PUBLICADO: {
    documento: DOC.CAT_MASTER,
    pagina: 47,
    texto_citado: "DTI Series Integrated/Recessed (European)",
  },

  /** El desglose por variante del DTS en el catálogo maestro. */
  DTS_VARIANTES_MASTER: {
    documento: DOC.CAT_MASTER,
    pagina: 47,
    texto_citado:
      "DTS Series Indoor Side Mount NEMA Type 12 Cooling Units | " +
      "DTS Series Outdoor Cooling Units - NEMA Type 3R/4 | " +
      "DTS Series Washdown Cooling Units - NEMA Type 4/4X",
  },

  /** El margen del 10 %. Regla documentada, no intuición. */
  MARGEN_10_PCT: {
    documento: DOC.DTS_2017,
    pagina: 2,
    texto_citado:
      "The refrigeration capacity should exceed the dissipation loss from the installed " +
      "components by approximately 10%.",
  },

  /** La base de rating. Justifica por qué el margen no es opcional. */
  BASE_DIN_35_35: {
    documento: DOC.DTS_2017,
    pagina: 2,
    texto_citado:
      "Pfannenberg utilizes the DIN standard 35/35 °C when rating our cooling units. Many " +
      "other companies use 50/50 °C, which provides a higher, non-usable value. Customers " +
      "should use their own application temperatures to determine the proper cooling " +
      "capacity of the system.",
  },

  /** Por qué el rango del quick selection chart no se puede leer como un número fijo. */
  CAPACIDAD_VARIA_POR_VOLTAJE: {
    documento: DOC.DTS_2017,
    pagina: 2,
    texto_citado: "Note: Cooling capacity may vary between voltage and configurations.",
  },

  /**
   * La fórmula de dimensionamiento. **Se cita, no se implementa**: exige `C` (según
   * material) y `A` (superficie efectiva), que es justo lo que resuelve PSS.
   */
  FORMULA_PC_PD_PR: {
    documento: DOC.DTS_2017,
    pagina: 2,
    texto_citado: "{ PC = PD - PR } { PR = C x A x ∆T }",
  },

  /** La advertencia contra sobredimensionar. */
  EVITAR_SOBREDIMENSIONAR: {
    documento: DOC.COMPACT,
    pagina: 35,
    texto_citado:
      "The free and intelligent Pfannenberg Sizing Software supports you to capture " +
      "customized solutions for your projects and makes them even more economical, more " +
      "accurate, safer and avoid costly oversizing or dangerous undersizing.",
  },

  /** Mapeo location → NEMA. Sale del propio PSS. */
  PSS_LOCATION_A_NEMA: {
    documento: DOC.PSS,
    pagina: 5,
    texto_citado:
      "Location: Select where the enclosure will be located — Indoor (NEMA Type 12), " +
      "Outdoor (NEMA Type 3R/4), or Washdown (NEMA Type 4/4X).",
  },

  /** Por qué el voltaje es bloqueante: cambia qué unidades aparecen. */
  PSS_VOLTAJE_BLOQUEANTE: {
    documento: DOC.PSS,
    pagina: 4,
    texto_citado:
      "Supply Voltage for Air Conditioning Components: Select a voltage that can be used " +
      "from the dropdown table. Please note this can change which units show in the final " +
      "solution page.",
  },

  /** La compuerta lógica confirmada por el propio PSS. */
  PSS_COMPUERTA_CONFIRMADA: {
    documento: DOC.PSS,
    pagina: 12,
    texto_citado:
      "The picture below states filter fan and air/air heat exchanger are not possible, " +
      "this is because the ambient temperature selected (100°F) is higher than the maximum " +
      "allowable temperature inside the enclosure (95°F).",
  },

  /** Por qué la disipación declarada por componente hay que verificarla. */
  PSS_VERIFICAR_DISIPACION: {
    documento: DOC.PSS,
    pagina: 7,
    texto_citado:
      "It is recommended to still verify heat loss of each individual component as these " +
      "values might be higher than the actual components that are being used.",
  },

  /** El tercer camino de la carga térmica: se detecta y se deriva a PSS. */
  PSS_TEMPERATURA_REGISTRADA: {
    documento: DOC.PSS,
    pagina: 7,
    texto_citado:
      "Calculate Dissipation based on Recorded Temperature: If total heat load is unknown " +
      "or an incomplete component list, use this tab. […] This is typically for existing " +
      "enclosures in the field.",
  },

  /** Cómo se declara la instalación en PSS y por qué cambia la superficie efectiva. */
  PSS_INSTALACION: {
    documento: DOC.PSS,
    pagina: 5,
    texto_citado:
      "Installation Characteristics: Select from the dropdown table on how the enclosure " +
      "will be mounted. This relates directly to the surface area available for heat " +
      "transfer of the environment into the enclosure or heat transfer from the enclosure " +
      "into the environment.",
  },

  /** El material del gabinete es una entrada de PSS, no un detalle estético. */
  PSS_MATERIAL: {
    documento: DOC.PSS,
    pagina: 4,
    texto_citado:
      "Housing Material: Select from the dropdown for the material used for the enclosure " +
      "or manually input the material information.",
  },

  /** Dimensiones del gabinete como entrada de PSS. */
  PSS_DIMENSIONES: {
    documento: DOC.PSS,
    pagina: 4,
    texto_citado: "Enclosure Dimensions: Input the Height, Width, and Depth of the enclosure.",
  },

  /** El acabado inoxidable de la variante washdown del DTS 31X5. */
  DTS_3185_INOXIDABLE: {
    documento: DOC.CAT_MASTER,
    pagina: 57,
    texto_citado:
      "DTS 3185 Washdown (NEMA Type 4/4x) — Design Housing: galvanized sheet steel " +
      "Cover: stainless steel 304",
  },

  /** El DTS 31X5 y sus tres variantes, descritas en prosa por el catálogo maestro. */
  DTS_31X5_VARIANTES: {
    documento: DOC.CAT_MASTER,
    pagina: 56,
    texto_citado:
      "Our DTS 31X5 cooling units are […] available in 3 models; DTS 3145 (NEMA Type 12) " +
      "for indoor use, DTS 3165 (NEMA Type 3R/4) designed for outdoor use, and the " +
      "stainless steel DTS 3185 (NEMA Type 4/4x) designed for washdown applications.",
  },
} as const satisfies Record<string, Citation>;

export type CitationKey = keyof typeof CITATIONS;

/* ================================================================== *
 * 3 · Matriz de selección de tecnología (§4.1 · catálogo NA p.2)
 * ================================================================== */

export type AmbientClass = "cool" | "high";
export type AirQualityClass = "clean_or_slightly_dirty" | "dirty" | "very_harsh";

export type TechnologyMatrixRow = {
  /** Texto de la columna, literal del catálogo. */
  condicion: string;
  familia: TechnologyFamily;
  /** Clase de ambiente que activa la fila. */
  ambiente: AmbientClass;
  /** Calidades de aire que cubre la fila. */
  calidadAire: readonly AirQualityClass[];
  cita: Citation;
};

/**
 * Las cuatro filas de la matriz, en el orden del catálogo.
 *
 * `ambiente` se deriva de la comparación `ambient_temp_max_c` vs
 * `internal_temp_max_c` — que es la misma frontera que enuncia la regla de cooling
 * activo del catálogo NA p.6, no un umbral inventado.
 */
export const TECHNOLOGY_MATRIX: readonly TechnologyMatrixRow[] = [
  {
    condicion: "Cool Ambient, Clean or Slightly Dirty Conditions",
    familia: "filterfan_exhaust",
    ambiente: "cool",
    calidadAire: ["clean_or_slightly_dirty"],
    cita: CITATIONS.MATRIZ_TECNOLOGIA,
  },
  {
    condicion: "Cool Ambient, Dirty Conditions",
    familia: "pks_air_air",
    ambiente: "cool",
    calidadAire: ["dirty"],
    cita: CITATIONS.MATRIZ_TECNOLOGIA,
  },
  {
    condicion: "High Ambient & Clean or Dirty Conditions",
    familia: "dts_cooling_units",
    ambiente: "high",
    calidadAire: ["clean_or_slightly_dirty", "dirty"],
    cita: CITATIONS.MATRIZ_TECNOLOGIA,
  },
  {
    condicion: "High Ambient and/or Very Harsh, Dirty Conditions",
    familia: "pws_air_water",
    ambiente: "high",
    calidadAire: ["clean_or_slightly_dirty", "dirty", "very_harsh"],
    cita: CITATIONS.MATRIZ_TECNOLOGIA,
  },
] as const;

/* ================================================================== *
 * 4 · Mapeo location → NEMA requerido (PSS Tutorial · Environment)
 * ================================================================== */

export const NEMA_BY_LOCATION = {
  indoor: ["12"],
  outdoor: ["3R", "4"],
  washdown: ["4", "4X"],
} as const satisfies Record<string, readonly ("12" | "3R" | "4" | "4X")[]>;

/* ================================================================== *
 * 5 · Caras de montaje disponibles según instalación
 * ================================================================== *
 *
 * Derivado de `installation` (§3.5 · "available_mounting_faces ← installation") y de la
 * descripción de PSS de las installation characteristics. **No es una tabla del
 * catálogo**: es la consecuencia geométrica de dónde queda el gabinete, y por eso su
 * incumplimiento produce una verificación mecánica, no un rechazo por catálogo.
 */
export const MOUNTING_BY_INSTALLATION = {
  free_standing: ["side", "integrated", "top"],
  wall_mounted: ["side", "integrated", "top"],
  /** Encajonado entre otros gabinetes: los laterales dejan de estar disponibles. */
  recessed_in_line: ["integrated", "top"],
} as const satisfies Record<string, readonly ("side" | "integrated" | "top")[]>;

/* ================================================================== *
 * 6 · Tablas de modelos — Cooling Units
 * ================================================================== *
 *
 * Capacidades y voltajes: QUICK SELECTION CHART del catálogo NA p.7 y del catálogo
 * maestro p.47. Ambos coinciden en los rangos. El desglose por variante
 * (Indoor / Outdoor / Washdown), con designación comercial y dimensiones propias,
 * solo lo publica el catálogo maestro.
 *
 * `montaje` está codificado en la serie: DTS = side · DTI = integrado/recessed · DTT = top.
 */

const V_115_230 = ["115V", "230V"] as const;
const V_115_230_460 = ["115V", "230V", "400_460V_3ph"] as const;
const V_230_460 = ["230V", "400_460V_3ph"] as const;

const CAT_115_230 = ["115 V", "230 V"] as const;
const CAT_115_230_460 = ["115 V", "230 V", "460 V"] as const;
const CAT_115_230_400_460 = ["115 V", "230 V", "400/460 V"] as const;
const CAT_230_400_460 = ["230 V", "400/460 V"] as const;

const NEMA_INDOOR = ["12"] as const;
const NEMA_OUTDOOR = ["3R", "4"] as const;
const NEMA_WASHDOWN = ["4", "4X"] as const;

const MAT_PAINTED = ["painted_steel"] as const;
const MAT_STAINLESS = ["stainless_steel"] as const;

const CHART_NA: Citation = {
  documento: DOC.CAT_NA,
  pagina: 7,
  texto_citado: "SIDE MOUNT COOLING UNITS QUICK SELECTION CHART / COOLING UNITS QUICK SELECTION CHART",
};

const CHART_MASTER: Citation = {
  documento: DOC.CAT_MASTER,
  pagina: 47,
  texto_citado: "COOLING UNITS QUICK SELECTION CHART — Type / Cooling Capacity Btu/h / Rated Voltage / Dimensions H x W x D",
};

/** Serie DTS — montaje lateral. Tres variantes de rating por serie. */
export const DTS_MODELS: readonly CoolingUnitModel[] = [
  // --- DTS 3021 · 900 – 1300 Btu/h ---
  {
    familia: "cooling_units",
    serie: "DTS 3021",
    modelo: "DTS 3021",
    designacionComercial: "DTS 3021",
    capacidadMinBtuH: 900,
    capacidadMaxBtuH: 1300,
    voltajes: V_115_230,
    voltajesCatalogo: CAT_115_230,
    montaje: "side",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 393, anchoMm: 177, profundidadMm: 191 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 3021",
    modelo: "DTS 3021 Outdoor",
    designacionComercial: "DTS 3031",
    capacidadMinBtuH: 900,
    capacidadMaxBtuH: 1300,
    voltajes: V_115_230,
    voltajesCatalogo: CAT_115_230,
    montaje: "side",
    ratingsNema: NEMA_OUTDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 393, anchoMm: 177, profundidadMm: 191 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 3021",
    modelo: "DTS 3021 Washdown",
    designacionComercial: "DTS 3031 SS",
    capacidadMinBtuH: 900,
    capacidadMaxBtuH: 1300,
    voltajes: V_115_230,
    voltajesCatalogo: CAT_115_230,
    montaje: "side",
    ratingsNema: NEMA_WASHDOWN,
    washdown: true,
    materialDisponible: MAT_STAINLESS,
    dimensiones: { altoMm: 393, anchoMm: 177, profundidadMm: 191 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_ACABADOS,
  },

  // --- DTS 30X1 · 2000 – 3000 Btu/h ---
  {
    familia: "cooling_units",
    serie: "DTS 30X1",
    modelo: "DTS 30X1",
    designacionComercial: "DTS 3041",
    capacidadMinBtuH: 2000,
    capacidadMaxBtuH: 3000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_460,
    montaje: "side",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 512, anchoMm: 254, profundidadMm: 274 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 30X1",
    modelo: "DTS 30X1 Outdoor",
    designacionComercial: "DTS 3061",
    capacidadMinBtuH: 2000,
    capacidadMaxBtuH: 3000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_460,
    montaje: "side",
    ratingsNema: NEMA_OUTDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 512, anchoMm: 254, profundidadMm: 274 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 30X1",
    modelo: "DTS 30X1 Washdown",
    designacionComercial: "DTS 3081",
    capacidadMinBtuH: 2000,
    capacidadMaxBtuH: 3000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_460,
    montaje: "side",
    ratingsNema: NEMA_WASHDOWN,
    washdown: true,
    materialDisponible: MAT_STAINLESS,
    dimensiones: { altoMm: 512, anchoMm: 254, profundidadMm: 274 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_ACABADOS,
  },

  // --- DTS 31X1 · 3000 – 4000 Btu/h ---
  {
    familia: "cooling_units",
    serie: "DTS 31X1",
    modelo: "DTS 31X1",
    designacionComercial: "DTS 3141",
    capacidadMinBtuH: 3000,
    capacidadMaxBtuH: 4000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 748, anchoMm: 395, profundidadMm: 237 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 31X1",
    modelo: "DTS 31X1 Outdoor",
    designacionComercial: "DTS 3161",
    capacidadMinBtuH: 3000,
    capacidadMaxBtuH: 4000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_OUTDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 748, anchoMm: 395, profundidadMm: 294 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 31X1",
    modelo: "DTS 31X1 Washdown",
    designacionComercial: "DTS 3181",
    capacidadMinBtuH: 3000,
    capacidadMaxBtuH: 4000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_WASHDOWN,
    washdown: true,
    materialDisponible: MAT_STAINLESS,
    dimensiones: { altoMm: 748, anchoMm: 395, profundidadMm: 294 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_ACABADOS,
  },

  // --- DTS 31X1 SL · 3000 – 5000 Btu/h ---
  {
    familia: "cooling_units",
    serie: "DTS 31X1 SL",
    modelo: "DTS 31X1 SL",
    designacionComercial: "DTS 3141 SL",
    capacidadMinBtuH: 3000,
    capacidadMaxBtuH: 5000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 914, anchoMm: 305, profundidadMm: 304 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 31X1 SL",
    modelo: "DTS 31X1 SL Outdoor",
    designacionComercial: "DTS 3161 SL",
    capacidadMinBtuH: 3000,
    capacidadMaxBtuH: 5000,
    voltajes: V_230_460,
    voltajesCatalogo: CAT_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_OUTDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 914, anchoMm: 305, profundidadMm: 366 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 31X1 SL",
    modelo: "DTS 31X1 SL Washdown",
    designacionComercial: "DTS 3181 SL",
    capacidadMinBtuH: 3000,
    capacidadMaxBtuH: 5000,
    voltajes: V_230_460,
    voltajesCatalogo: CAT_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_WASHDOWN,
    washdown: true,
    materialDisponible: MAT_STAINLESS,
    dimensiones: { altoMm: 914, anchoMm: 305, profundidadMm: 366 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_ACABADOS,
  },

  // --- DTS 31X5 · 5000 – 7000 Btu/h ---
  {
    familia: "cooling_units",
    serie: "DTS 31X5",
    modelo: "DTS 31X5",
    designacionComercial: "DTS 3145",
    capacidadMinBtuH: 5000,
    capacidadMaxBtuH: 7000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 914, anchoMm: 305, profundidadMm: 304 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTS_31X5_VARIANTES,
  },
  {
    familia: "cooling_units",
    serie: "DTS 31X5",
    modelo: "DTS 31X5 Outdoor",
    designacionComercial: "DTS 3165",
    capacidadMinBtuH: 5000,
    capacidadMaxBtuH: 7000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_OUTDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 914, anchoMm: 305, profundidadMm: 368 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_31X5_VARIANTES,
  },
  {
    familia: "cooling_units",
    serie: "DTS 31X5",
    modelo: "DTS 31X5 Washdown",
    designacionComercial: "DTS 3185",
    capacidadMinBtuH: 5000,
    capacidadMaxBtuH: 7000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_WASHDOWN,
    washdown: true,
    materialDisponible: MAT_STAINLESS,
    dimensiones: { altoMm: 914, anchoMm: 305, profundidadMm: 368 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_3185_INOXIDABLE,
  },

  // --- DTS 32X1 · 7000 – 8500 Btu/h ---
  {
    familia: "cooling_units",
    serie: "DTS 32X1",
    modelo: "DTS 32X1",
    designacionComercial: "DTS 3241",
    capacidadMinBtuH: 7000,
    capacidadMaxBtuH: 8500,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 1209, anchoMm: 395, profundidadMm: 269 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 32X1",
    modelo: "DTS 32X1 Outdoor",
    designacionComercial: "DTS 3261",
    capacidadMinBtuH: 7000,
    capacidadMaxBtuH: 8500,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_OUTDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 1209, anchoMm: 395, profundidadMm: 326 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 32X1",
    modelo: "DTS 32X1 Washdown",
    designacionComercial: "DTS 3281",
    capacidadMinBtuH: 7000,
    capacidadMaxBtuH: 8500,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_WASHDOWN,
    washdown: true,
    materialDisponible: MAT_STAINLESS,
    dimensiones: { altoMm: 1209, anchoMm: 395, profundidadMm: 326 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_ACABADOS,
  },

  // --- DTS 32X5 · 9000 – 12000 Btu/h ---
  {
    familia: "cooling_units",
    serie: "DTS 32X5",
    modelo: "DTS 32X5",
    designacionComercial: "DTS 3245",
    capacidadMinBtuH: 9000,
    capacidadMaxBtuH: 12000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 1347, anchoMm: 406, profundidadMm: 301 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 32X5",
    modelo: "DTS 32X5 Outdoor",
    designacionComercial: "DTS 3265",
    capacidadMinBtuH: 9000,
    capacidadMaxBtuH: 12000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_OUTDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 1347, anchoMm: 411, profundidadMm: 365 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 32X5",
    modelo: "DTS 32X5 Washdown",
    designacionComercial: "DTS 3285",
    capacidadMinBtuH: 9000,
    capacidadMaxBtuH: 12000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_WASHDOWN,
    washdown: true,
    materialDisponible: MAT_STAINLESS,
    dimensiones: { altoMm: 1347, anchoMm: 411, profundidadMm: 365 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_ACABADOS,
  },

  // --- DTS 34X1C · 15000 – 20000 Btu/h ---
  {
    familia: "cooling_units",
    serie: "DTS 34X1C",
    modelo: "DTS 34X1C",
    designacionComercial: "DTS 3441C",
    capacidadMinBtuH: 15000,
    capacidadMaxBtuH: 20000,
    voltajes: V_230_460,
    voltajesCatalogo: CAT_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 1440, anchoMm: 406, profundidadMm: 405 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 34X1C",
    modelo: "DTS 34X1C Outdoor",
    designacionComercial: "DTS 3461C",
    capacidadMinBtuH: 15000,
    capacidadMaxBtuH: 20000,
    voltajes: V_230_460,
    voltajesCatalogo: CAT_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_OUTDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 1440, anchoMm: 406, profundidadMm: 405 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 34X1C",
    modelo: "DTS 34X1C Washdown",
    designacionComercial: "DTS 3481C",
    capacidadMinBtuH: 15000,
    capacidadMaxBtuH: 20000,
    voltajes: V_230_460,
    voltajesCatalogo: CAT_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_WASHDOWN,
    washdown: true,
    materialDisponible: MAT_STAINLESS,
    dimensiones: { altoMm: 1440, anchoMm: 406, profundidadMm: 484 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_ACABADOS,
  },

  // --- DTS 36X1C · 20000 – 24000 Btu/h ---
  {
    familia: "cooling_units",
    serie: "DTS 36X1C",
    modelo: "DTS 36X1C",
    designacionComercial: "DTS 3641C",
    capacidadMinBtuH: 20000,
    capacidadMaxBtuH: 24000,
    voltajes: V_230_460,
    voltajesCatalogo: CAT_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 1665, anchoMm: 485, profundidadMm: 520 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 36X1C",
    modelo: "DTS 36X1C Outdoor",
    designacionComercial: "DTS 3661C",
    capacidadMinBtuH: 20000,
    capacidadMaxBtuH: 24000,
    voltajes: V_230_460,
    voltajesCatalogo: CAT_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_OUTDOOR,
    washdown: false,
    materialDisponible: MAT_PAINTED,
    dimensiones: { altoMm: 1665, anchoMm: 485, profundidadMm: 620 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_VARIANTES_MASTER,
  },
  {
    familia: "cooling_units",
    serie: "DTS 36X1C",
    modelo: "DTS 36X1C Washdown",
    designacionComercial: "DTS 3681C",
    capacidadMinBtuH: 20000,
    capacidadMaxBtuH: 24000,
    voltajes: V_230_460,
    voltajesCatalogo: CAT_230_400_460,
    montaje: "side",
    ratingsNema: NEMA_WASHDOWN,
    washdown: true,
    materialDisponible: MAT_STAINLESS,
    dimensiones: { altoMm: 1665, anchoMm: 485, profundidadMm: 620 },
    cita: CHART_MASTER,
    citaRating: CITATIONS.DTS_ACABADOS,
  },
] as const;

/**
 * Serie DTI — montaje integrado / recessed.
 *
 * **El catálogo no publica rating NEMA para esta serie**, ni en el NA de 12 páginas ni
 * en el maestro 2025. `ratingsNema: []` codifica exactamente eso: *no publicado*. La
 * consecuencia la decide `shortlist.ts`, no estos datos.
 */
export const DTI_MODELS: readonly CoolingUnitModel[] = [
  {
    familia: "cooling_units",
    serie: "DTI 6201 C",
    modelo: "DTI 6201 C",
    capacidadMinBtuH: 3000,
    capacidadMaxBtuH: 4000,
    voltajes: V_230_460,
    voltajesCatalogo: CAT_230_400_460,
    montaje: "integrated",
    ratingsNema: [],
    washdown: false,
    dimensiones: { altoMm: 962, anchoMm: 410, profundidadMm: 243 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTI_SIN_RATING_PUBLICADO,
  },
  {
    familia: "cooling_units",
    serie: "DTI 6301 C",
    modelo: "DTI 6301 C",
    capacidadMinBtuH: 5000,
    capacidadMaxBtuH: 6000,
    voltajes: V_230_460,
    voltajesCatalogo: CAT_230_400_460,
    montaje: "integrated",
    ratingsNema: [],
    washdown: false,
    dimensiones: { altoMm: 962, anchoMm: 410, profundidadMm: 243 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTI_SIN_RATING_PUBLICADO,
  },
  {
    familia: "cooling_units",
    serie: "DTI 6201 Green Series",
    modelo: "DTI 6201 Green Series",
    capacidadMinBtuH: 3000,
    capacidadMaxBtuH: 4000,
    voltajes: V_230_460,
    voltajesCatalogo: CAT_230_400_460,
    montaje: "integrated",
    ratingsNema: [],
    washdown: false,
    dimensiones: { altoMm: 1536, anchoMm: 485, profundidadMm: 218 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTI_SIN_RATING_PUBLICADO,
  },
  {
    familia: "cooling_units",
    serie: "DTI 6301 Green Series",
    modelo: "DTI 6301 Green Series",
    capacidadMinBtuH: 5000,
    capacidadMaxBtuH: 6000,
    voltajes: V_230_460,
    voltajesCatalogo: CAT_230_400_460,
    montaje: "integrated",
    ratingsNema: [],
    washdown: false,
    dimensiones: { altoMm: 1536, anchoMm: 485, profundidadMm: 218 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTI_SIN_RATING_PUBLICADO,
  },
  {
    familia: "cooling_units",
    serie: "DTI 6401 Green Series",
    modelo: "DTI 6401 Green Series",
    capacidadMinBtuH: 7000,
    capacidadMaxBtuH: 8000,
    voltajes: ["400_460V_3ph"],
    voltajesCatalogo: ["400/460 V"],
    montaje: "integrated",
    ratingsNema: [],
    washdown: false,
    dimensiones: { altoMm: 1536, anchoMm: 485, profundidadMm: 278 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTI_SIN_RATING_PUBLICADO,
  },
  {
    familia: "cooling_units",
    serie: "DTI 6501 Green Series",
    modelo: "DTI 6501 Green Series",
    capacidadMinBtuH: 9000,
    capacidadMaxBtuH: 11000,
    voltajes: ["400_460V_3ph"],
    voltajesCatalogo: ["400/460 V"],
    montaje: "integrated",
    ratingsNema: [],
    washdown: false,
    dimensiones: { altoMm: 1536, anchoMm: 485, profundidadMm: 278 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTI_SIN_RATING_PUBLICADO,
  },
  {
    familia: "cooling_units",
    serie: "DTI 6801 Green Series",
    modelo: "DTI 6801 Green Series",
    capacidadMinBtuH: 13000,
    capacidadMaxBtuH: 16000,
    voltajes: ["400_460V_3ph"],
    voltajesCatalogo: ["400/460 V"],
    montaje: "integrated",
    ratingsNema: [],
    washdown: false,
    dimensiones: { altoMm: 1539, anchoMm: 485, profundidadMm: 372 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTI_SIN_RATING_PUBLICADO,
  },
] as const;

/**
 * Serie DTT — montaje superior.
 *
 * **Solo Type 12.** No hay variante washdown documentada en ninguno de los dos
 * catálogos. Es una regla de descarte real, no una omisión de la transcripción.
 */
export const DTT_MODELS: readonly CoolingUnitModel[] = [
  {
    familia: "cooling_units",
    serie: "DTT 6101",
    modelo: "DTT 6101",
    capacidadMinBtuH: 1200,
    capacidadMaxBtuH: 2000,
    voltajes: V_115_230,
    voltajesCatalogo: CAT_115_230,
    montaje: "top",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    dimensiones: { altoMm: 435, anchoMm: 595, profundidadMm: 395 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTT_SOLO_TYPE_12,
  },
  {
    familia: "cooling_units",
    serie: "DTT 6201",
    modelo: "DTT 6201",
    capacidadMinBtuH: 2500,
    capacidadMaxBtuH: 4000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "top",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    dimensiones: { altoMm: 435, anchoMm: 595, profundidadMm: 395 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTT_SOLO_TYPE_12,
  },
  {
    familia: "cooling_units",
    serie: "DTT 6301",
    modelo: "DTT 6301",
    capacidadMinBtuH: 4000,
    capacidadMaxBtuH: 5500,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "top",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    dimensiones: { altoMm: 435, anchoMm: 595, profundidadMm: 495 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTT_SOLO_TYPE_12,
  },
  {
    familia: "cooling_units",
    serie: "DTT 6401",
    modelo: "DTT 6401",
    capacidadMinBtuH: 5500,
    capacidadMaxBtuH: 7000,
    voltajes: V_115_230_460,
    voltajesCatalogo: CAT_115_230_400_460,
    montaje: "top",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    dimensiones: { altoMm: 435, anchoMm: 595, profundidadMm: 495 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTT_SOLO_TYPE_12,
  },
  {
    familia: "cooling_units",
    serie: "DTT 6601",
    modelo: "DTT 6601",
    capacidadMinBtuH: 7000,
    capacidadMaxBtuH: 10000,
    voltajes: ["400_460V_3ph"],
    voltajesCatalogo: ["400/460 V"],
    montaje: "top",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    dimensiones: { altoMm: 485, anchoMm: 795, profundidadMm: 575 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTT_SOLO_TYPE_12,
  },
  {
    familia: "cooling_units",
    serie: "DTT 6801",
    modelo: "DTT 6801",
    capacidadMinBtuH: 12000,
    capacidadMaxBtuH: 14000,
    voltajes: ["400_460V_3ph"],
    voltajesCatalogo: ["400/460 V"],
    montaje: "top",
    ratingsNema: NEMA_INDOOR,
    washdown: false,
    dimensiones: { altoMm: 485, anchoMm: 795, profundidadMm: 575 },
    cita: CHART_NA,
    citaRating: CITATIONS.DTT_SOLO_TYPE_12,
  },
] as const;

/** Todo el catálogo de cooling units en alcance, en un solo array. */
export const COOLING_UNIT_MODELS: readonly CoolingUnitModel[] = [
  ...DTS_MODELS,
  ...DTI_MODELS,
  ...DTT_MODELS,
];

/** Series únicas, en el orden de capacidad creciente del catálogo. */
export function coolingUnitSeries(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of COOLING_UNIT_MODELS) {
    if (!seen.has(m.serie)) {
      seen.add(m.serie);
      out.push(m.serie);
    }
  }
  return out;
}

/** Todas las variantes de una serie. */
export function variantsOfSeries(serie: string): CoolingUnitModel[] {
  return COOLING_UNIT_MODELS.filter((m) => m.serie === serie);
}
