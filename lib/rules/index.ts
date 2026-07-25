/**
 * Punto de entrada del motor de reglas determinista (componente 2).
 *
 * Es lo único que necesita importar `app/api/turn/route.ts` y las tools de la Pista C.
 * Todo lo que sale de aquí es TypeScript puro: sin red, sin LLM, sin efectos.
 */

export type {
  CandidateStatus,
  Citation,
  CoolingUnitCandidate,
  CoolingUnitModel,
  CoolingUnitShortlistResult,
  FieldGuideEntry,
  ModelDimensionsMm,
  MountingType,
  NemaRating,
  TechnologyFamily,
  TechnologyVerdict,
  VerdictStatus,
} from "./types";
export { FAMILY_LABEL, TECHNOLOGY_FAMILIES } from "./types";

export {
  CAPACITY_MARGIN_FACTOR,
  CITATIONS,
  COOLING_UNIT_MODELS,
  DEFAULT_INTERNAL_TEMP_MAX_C,
  DIN_RATING_AMBIENT_C,
  DIN_RATING_INTERNAL_C,
  DOC,
  DTI_MODELS,
  DTS_MODELS,
  DTT_MODELS,
  MOUNTING_BY_INSTALLATION,
  NEMA_BY_LOCATION,
  TECHNOLOGY_MATRIX,
  WATTS_TO_BTU_PER_HOUR,
  coolingUnitSeries,
  variantsOfSeries,
} from "./catalog-data";

export {
  buildGateContext,
  evaluateTechnologyFamily,
  evaluateTechnologyGate,
  gateThresholdMet,
} from "./gate";

export {
  allCoolingUnitModels,
  applyCapacityMargin,
  buildCoolingUnitShortlist,
  evaluateCoolingUnitShortlist,
  resolveTotalDissipationW,
  wattsToBtuPerHour,
} from "./shortlist";

export {
  FIELD_GUIDE,
  FIELD_GUIDE_BY_FIELD,
  blockingFieldNames,
  fieldGuideFor,
} from "./field-guide";
