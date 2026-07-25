/**
 * Constructores de `ProjectSpec` para los tests del motor de reglas.
 *
 * No son mocks: son specs reales del contrato, montados campo a campo. El único fixture
 * "de negocio" es el de Barranquilla (§5 del spec), que ya viene resuelto a mano en el
 * documento de diseño y por eso sirve de regresión gratis.
 */

import type {
  AirQuality,
  HousingMaterial,
  Installation,
  Location,
  ProjectSpec,
  SupplyVoltage,
} from "../../project-spec";
import { declaredField, emptyProjectSpec, inferredField } from "../../project-spec";

export type SpecOverrides = {
  ambient_temp_max_c?: number;
  internal_temp_max_c?: number;
  location?: Location;
  air_quality?: AirQuality;
  installation?: Installation;
  supply_voltage?: SupplyVoltage;
  housing_material?: HousingMaterial;
  process_water_available?: boolean;
  total_dissipation_w?: number;
  height_mm?: number;
  width_mm?: number;
  depth_mm?: number;
};

/** Spec con solo los campos indicados declarados. Todo lo demás queda `missing`. */
export function makeSpec(overrides: SpecOverrides): ProjectSpec {
  const spec = emptyProjectSpec();
  const ev = "declarado por el cliente en el test";

  if (overrides.ambient_temp_max_c !== undefined)
    spec.ambient_temp_max_c = declaredField(overrides.ambient_temp_max_c, ev);
  if (overrides.internal_temp_max_c !== undefined)
    spec.internal_temp_max_c = declaredField(overrides.internal_temp_max_c, ev);
  if (overrides.location !== undefined) spec.location = declaredField(overrides.location, ev);
  if (overrides.air_quality !== undefined)
    spec.air_quality = declaredField(overrides.air_quality, ev);
  if (overrides.installation !== undefined)
    spec.installation = declaredField(overrides.installation, ev);
  if (overrides.supply_voltage !== undefined)
    spec.supply_voltage = declaredField(overrides.supply_voltage, ev);
  if (overrides.housing_material !== undefined)
    spec.housing_material = declaredField(overrides.housing_material, ev);
  if (overrides.process_water_available !== undefined)
    spec.process_water_available = declaredField(overrides.process_water_available, ev);
  if (overrides.total_dissipation_w !== undefined)
    spec.total_dissipation_w = declaredField(overrides.total_dissipation_w, ev);
  if (overrides.height_mm !== undefined) spec.height_mm = declaredField(overrides.height_mm, ev);
  if (overrides.width_mm !== undefined) spec.width_mm = declaredField(overrides.width_mm, ev);
  if (overrides.depth_mm !== undefined) spec.depth_mm = declaredField(overrides.depth_mm, ev);

  return spec;
}

/**
 * El caso de §5 del spec, **antes** de que el cliente responda a las preguntas
 * bloqueantes: planta de envasado en Barranquilla, zona de lavado a presión, ambiente
 * 38 °C, gabinetes 2000 × 800 × 600 mm contra pared, dos variadores de 22 kW + PLC.
 *
 * Falta a propósito la disipación, el voltaje y el material: son los tres bloqueantes
 * que el agente detecta. **Los 22 kW nominales no aparecen en ningún campo del spec.**
 */
export function barranquillaSinRespuesta(): ProjectSpec {
  const spec = emptyProjectSpec();
  spec.project_name = declaredField("Línea de llenado — planta de envasado", "línea de llenado");
  spec.customer = declaredField("Planta de envasado, Barranquilla", "Barranquilla");
  spec.height_mm = declaredField(2000, "gabinetes 2000×800×600 mm");
  spec.width_mm = declaredField(800, "gabinetes 2000×800×600 mm");
  spec.depth_mm = declaredField(600, "gabinetes 2000×800×600 mm");
  spec.ambient_temp_max_c = declaredField(38, "ambiente 38 °C");
  spec.location = declaredField("washdown", "zona de lavado a presión");
  spec.air_quality = declaredField("dirty", "zona de lavado a presión");
  spec.installation = declaredField("wall_mounted", "contra pared");
  spec.internal_temp_max_c = inferredField(
    35,
    "Electronics are typically most efficient in low humidity with a temperature around 95°",
  );
  spec.solar_load = inferredField(false, "instalación indoor, sin exposición solar directa");
  return spec;
}

/**
 * El mismo caso **después** de que el cliente responde: 650 W por variador + 50 W del
 * PLC (`PD = 2 × 650 + 50 = 1350 W`), 460 V 3~ e inoxidable.
 *
 * `PD` se declara como total, que es el camino directo del spec. La suma por componentes
 * se prueba aparte.
 */
export function barranquillaConRespuesta(): ProjectSpec {
  const spec = barranquillaSinRespuesta();
  spec.total_dissipation_w = declaredField(1350, "650 W por variador y 50 W el PLC");
  spec.supply_voltage = declaredField("400_460V_3ph", "460 V 3~");
  spec.housing_material = declaredField("stainless_steel", "inoxidable");
  return spec;
}
