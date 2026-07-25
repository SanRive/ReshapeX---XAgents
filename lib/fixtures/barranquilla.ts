/**
 * FIXTURE — el caso validado end-to-end del spec §5.
 *
 * Es el estado del `ProjectSpec` justo DESPUÉS del primer turno: el cliente ha
 * pegado su correo, la extracción ha corrido y el validador ha hecho su trabajo.
 *
 * La pista D pinta contra esto sin esperar a que la extracción funcione.
 *
 * ⚠️ Toda `evidence` de un campo `declared` es substring LITERAL de
 * `BARRANQUILLA_INPUT`. Si tocas el correo, revisa las evidencias — el
 * validador degradará a `missing` cualquiera que deje de coincidir.
 */

import type { ProjectSpec } from "../project-spec";

export const BARRANQUILLA_INPUT = `Buenas tardes,

Estamos montando una línea de llenado nueva en nuestra planta de Barranquilla y necesitamos climatizar los tableros de control. Son 4 gabinetes iguales de 2000 x 800 x 600 mm, montados contra pared en la zona de proceso. La zona se lava a presión al final de cada turno.

Cada gabinete lleva dos variadores de 22 kW y un PLC. La planta trabaja 24/7 y la temperatura ambiente en esa zona llega a 38 °C en temporada seca.

¿Qué nos recomiendan?`;

export const BARRANQUILLA_SPEC: ProjectSpec = {
  // ---- A · Identificación -------------------------------------------------
  project_name: {
    status: "declared",
    value: "Línea de llenado — planta Barranquilla",
    evidence: "una línea de llenado nueva en nuestra planta de Barranquilla",
    basis: null,
  },
  customer: { status: "missing", value: null, evidence: null, basis: null },

  // ---- B · Gabinete -------------------------------------------------------
  height_mm: {
    status: "declared",
    value: 2000,
    evidence: "2000 x 800 x 600 mm",
    basis: null,
  },
  width_mm: {
    status: "declared",
    value: 800,
    evidence: "2000 x 800 x 600 mm",
    basis: null,
  },
  depth_mm: {
    status: "declared",
    value: 600,
    evidence: "2000 x 800 x 600 mm",
    basis: null,
  },
  internal_temp_max_c: {
    status: "inferred",
    value: 35,
    evidence: null,
    basis: "internal_temp_max_c",
  },
  internal_temp_min_c: { status: "missing", value: null, evidence: null, basis: null },
  // BLOQUEANTE: en washdown el material deja de ser cosmético.
  housing_material: { status: "missing", value: null, evidence: null, basis: null },
  housing_color: {
    status: "inferred",
    value: "RAL 7035",
    evidence: null,
    basis: "housing_color",
  },
  // BLOQUEANTE: el catálogo advierte que la capacidad varía por voltaje.
  supply_voltage: { status: "missing", value: null, evidence: null, basis: null },

  // ---- C · Entorno --------------------------------------------------------
  location: {
    status: "declared",
    value: "washdown",
    evidence: "La zona se lava a presión al final de cada turno.",
    basis: null,
  },
  ambient_temp_max_c: {
    status: "declared",
    value: 38,
    evidence: "la temperatura ambiente en esa zona llega a 38 °C",
    basis: null,
  },
  ambient_temp_min_c: { status: "missing", value: null, evidence: null, basis: null },
  // Sin default en la lista blanca → missing. No lo inferimos «porque suena razonable».
  solar_load: { status: "missing", value: null, evidence: null, basis: null },
  wind_exposure: { status: "missing", value: null, evidence: null, basis: null },
  installation: {
    status: "declared",
    value: "wall_mounted",
    evidence: "montados contra pared",
    basis: null,
  },
  air_quality: {
    status: "declared",
    value: "very_harsh",
    evidence: "La zona se lava a presión al final de cada turno.",
    basis: null,
  },

  // ---- D · Carga térmica --------------------------------------------------
  /**
   * EL MOMENTO DE LA DEMO.
   *
   * El correo dice «dos variadores de 22 kW». Un chatbot escribe 22000 W y
   * pierde. 22 kW es potencia nominal del motor; la disipación del variador
   * es otra magnitud y no está declarada. Por eso: missing.
   */
  total_dissipation_w: { status: "missing", value: null, evidence: null, basis: null },
  /** No hay lista de componentes con W declarados → no hay nada que sumar. */
  component_list: null,
  measured_temps: null,

  enclosure_count: {
    status: "declared",
    value: 4,
    evidence: "Son 4 gabinetes iguales",
    basis: null,
  },

  // ---- Derivados — los calcula código, nunca el modelo --------------------
  derived: {
    // Ambos null: dependen de total_dissipation_w, que está missing.
    required_w: null,
    required_capacity_btuh: null,
    // washdown → NEMA Type 4/4X (PSS Tutorial, tab Environment)
    nema_required: "4_4X",
    // contra pared → quedan 3 caras libres
    available_mounting_faces: 3,
  },

  // ---- Log de decisiones — va al brief ------------------------------------
  decision_log: [
    {
      field: "total_dissipation_w",
      action: "degraded",
      reason:
        "Los 22 kW son potencia nominal del variador, no su disipación térmica. Son magnitudes distintas y la disipación no está declarada.",
      proposed: "22000",
    },
    {
      field: "internal_temp_max_c",
      action: "defaulted",
      reason:
        "Sin objetivo interno declarado. Se aplica el default documentado de 35 °C del catálogo NA p.2.",
      proposed: null,
    },
    {
      field: "enclosure_count",
      action: "accepted",
      reason:
        "Se declaran 4 gabinetes iguales. El análisis cubre uno; la cantidad se traslada al brief.",
      proposed: null,
    },
  ],
};
