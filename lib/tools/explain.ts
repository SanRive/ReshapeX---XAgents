import { CITATIONS } from "../rules/catalog-data";
import { fieldGuideFor } from "../rules/field-guide";
import { FAMILY_LABEL, TECHNOLOGY_FAMILIES, type Citation, type TechnologyFamily, type TechnologyVerdict } from "../rules/types";

export type VerdictExplanation = {
  family: string;
  summary: string;
  applicableRules: Array<{ ruleId: string; explanation: string; citation: Citation }>;
};

export type FieldGuideResult = {
  field: string;
  whyItMatters: string;
  whereToFindIt: string;
  alternativeEvidence: string;
  antiPattern: string;
  citation: Citation;
};

const FAMILY_ALIASES: Readonly<Record<string, TechnologyFamily>> = {
  dts: "dts_cooling_units",
  coolingunit: "dts_cooling_units",
  coolingunits: "dts_cooling_units",
  filterfan: "filterfan_exhaust",
  filterfans: "filterfan_exhaust",
  exhaustfilter: "filterfan_exhaust",
  pks: "pks_air_air",
  airair: "pks_air_air",
  airairheatexchanger: "pks_air_air",
  pws: "pws_air_water",
  airwater: "pws_air_water",
  airwaterheatexchanger: "pws_air_water",
};

const GENERAL_RULES: Readonly<Record<TechnologyFamily, VerdictExplanation["applicableRules"]>> = {
  filterfan_exhaust: [
    { ruleId: "technology-matrix", explanation: "Familia indicada para ambiente fresco y aire limpio o ligeramente sucio.", citation: CITATIONS.MATRIZ_TECNOLOGIA },
    { ruleId: "active-cooling", explanation: "No aplica cuando el ambiente supera la temperatura interna objetivo.", citation: CITATIONS.COOLING_ACTIVO_REQUERIDO },
  ],
  pks_air_air: [
    { ruleId: "technology-matrix", explanation: "Familia indicada para ambiente fresco con aire sucio.", citation: CITATIONS.MATRIZ_TECNOLOGIA },
    { ruleId: "contaminated-air", explanation: "Mantiene el aire contaminado o húmedo fuera del gabinete mediante lazo cerrado.", citation: CITATIONS.PKS_ENCABEZADO },
  ],
  dts_cooling_units: [
    { ruleId: "technology-matrix", explanation: "Familia indicada para ambiente alto con aire limpio o sucio.", citation: CITATIONS.MATRIZ_TECNOLOGIA },
    { ruleId: "active-cooling", explanation: "Se requiere enfriamiento activo cuando el ambiente supera el objetivo interno.", citation: CITATIONS.COOLING_ACTIVO_REQUERIDO },
    { ruleId: "closed-loop", explanation: "El lazo cerrado permite conservar el rating NEMA del gabinete.", citation: CITATIONS.LAZO_CERRADO_CONSERVA_NEMA },
  ],
  pws_air_water: [
    { ruleId: "technology-matrix", explanation: "Familia indicada para ambiente alto y/o aire muy hostil o sucio.", citation: CITATIONS.MATRIZ_TECNOLOGIA },
    { ruleId: "process-water", explanation: "La aplicabilidad requiere agua enfriada disponible junto al gabinete.", citation: CITATIONS.PWS_REQUIERE_AGUA },
  ],
};

const FIELD_ALIASES: Readonly<Record<string, string>> = {
  disipacion: "total_dissipation_w",
  disipaciontermica: "total_dissipation_w",
  cargatermica: "total_dissipation_w",
  voltaje: "supply_voltage",
  tension: "supply_voltage",
  material: "housing_material",
  materialgabinete: "housing_material",
  temperaturaambiente: "ambient_temp_max_c",
  temperaturainterna: "internal_temp_max_c",
  aguadeproceso: "process_water_available",
  montaje: "installation",
  nema: "location",
  ratingnema: "location",
  washdown: "location",
  lavado: "location",
  dimensiones: "enclosure_dimensions_mm",
  dimension: "enclosure_dimensions_mm",
};

function normalizeAlias(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function resolveFamily(value: string): TechnologyFamily | null {
  const normalized = normalizeAlias(value);
  const direct = TECHNOLOGY_FAMILIES.find((family) => normalizeAlias(family) === normalized);
  return direct ?? FAMILY_ALIASES[normalized] ?? null;
}

export function explicarVeredicto(familia: string, verdicts?: TechnologyVerdict[]): VerdictExplanation | null {
  if (typeof familia !== "string" || familia.length > 100) return null;
  const family = resolveFamily(familia);
  if (!family) return null;
  const verdict = verdicts?.find((candidate) => candidate.family === family);
  if (verdict) {
    return {
      family: verdict.familyLabel,
      summary: `${verdict.status}: ${verdict.reason}`,
      applicableRules: verdict.citations.map((citation, index) => ({
        ruleId: `${family}-${verdict.status}-${index + 1}`,
        explanation: verdict.reason,
        citation,
      })),
    };
  }
  return {
    family: FAMILY_LABEL[family],
    summary: `Descripción general documentada de ${FAMILY_LABEL[family]}; no constituye una selección para un proyecto particular.`,
    applicableRules: GENERAL_RULES[family],
  };
}

export function guiaDeCampo(campo: string): FieldGuideResult | null {
  if (typeof campo !== "string" || campo.length > 100) return null;
  const normalized = normalizeAlias(campo);
  const resolved = FIELD_ALIASES[normalized] ?? normalized;
  const entry = fieldGuideFor(resolved);
  return entry ? { ...entry } : null;
}
