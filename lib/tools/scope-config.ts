/**
 * scope-config.ts
 *
 * Define qué archivos del corpus_txt/ entran al índice de C1/C2.
 * Alcance del sprint: climatización de tableros eléctricos
 * (ventilador+filtro, aire-aire, A/C, aire-agua).
 * Fuera de alcance: señalización, chillers de proceso, casos de
 * estudio, soluciones por sector industrial.
 *
 * Decidido a mano revisando el MANIFEST.md y el contenido real de
 * archivos ambiguos (no solo por nombre de carpeta).
 */

export interface ScopedFile {
  /** ruta relativa dentro de corpus_txt/ */
  path: string;
  /** categoría funcional, útil para filtrar en buscar_catalogo() */
  categoria:
    | "cooling_unit_ac"       // aire acondicionado
    | "filterfan"             // ventilador con filtro
    | "heat_exchanger_aa"     // intercambiador aire-aire
    | "heat_exchanger_aw"     // intercambiador aire-agua
    | "catalogo_general"      // catálogo maestro, cubre varias tecnologías
    | "controlador"           // controladores de temperatura
    | "guia_general"          // guías de gestión térmica, no un producto puntual
    | "pss_tutorial";         // cómo usar el software PSS (no specs técnicas)
}

export const SCOPED_FILES: ScopedFile[] = [
  // --- Cooling Units (A/C) ---
  { path: "Pfanember/COOLING UNITS/ActivCool_DTS_5000_Flyer.txt", categoria: "cooling_unit_ac" },
  { path: "Pfanember/COOLING UNITS/DTS_2017.txt", categoria: "cooling_unit_ac" },
  { path: "Pfanember/COOLING UNITS/DTT_Flyer_USA_072016.txt", categoria: "cooling_unit_ac" },
  { path: "Pfanember/COOLING UNITS/Flyer_Green_Series_PSA_FINAL.txt", categoria: "cooling_unit_ac" },
  { path: "Pfanember/COOLING UNITS/Flyer_X_Series_PSA.txt", categoria: "cooling_unit_ac" },
  { path: "Pfanember/COOLING UNITS/PQF_Premium_Rollable_Filter.txt", categoria: "filterfan" },
  { path: "DownloadCentre/ThermalManagement/DTT_2015eng.txt", categoria: "cooling_unit_ac" },
  { path: "DownloadCentre/ThermalManagement/Pfannenberg_Brochure_Outdoor_Cooling_Units_DTS3000_EN.txt", categoria: "cooling_unit_ac" },
  { path: "DownloadCentre/ThermalManagement/Pfannenberg_Cut-out_compatibility_list_thermal_management_side_mounted_units.txt", categoria: "cooling_unit_ac" },

  // --- Filterfans (ventilador con filtro) ---
  { path: "Pfanember/FILTERFANS + ACCESSORIES/180417_Broschu╠_re_Filterlu╠_fter_ENG_RZ.txt", categoria: "filterfan" },
  { path: "Pfanember/FILTERFANS + ACCESSORIES/2017_Rainhoods_Product_Launch_Flyer.txt", categoria: "filterfan" },
  { path: "Pfanember/FILTERFANS + ACCESSORIES/Datawind_Filterfan_Rev1_lowres.txt", categoria: "filterfan" },
  { path: "Pfanember/FILTERFANS + ACCESSORIES/Flyer_PTF_1200_and_3R.txt", categoria: "filterfan" },
  { path: "Pfanember/FILTERFANS + ACCESSORIES/Outdoor_Filterfan_Sales_flyer.txt", categoria: "filterfan" },
  { path: "Pfanember/FILTERFANS + ACCESSORIES/PFH_Flyer_Final.txt", categoria: "filterfan" },
  { path: "DownloadCentre/ThermalManagement/Pfannenberg_Brochure_Filterfans_en.txt", categoria: "filterfan" },
  { path: "DownloadCentre/ThermalManagement/Pfannenberg_Filtermattenflyer_en.txt", categoria: "filterfan" },
  { path: "DownloadCentre/ThermalManagement/Flyer_Green_Series_ENG.txt", categoria: "filterfan" },

  // --- Heat Exchangers (aire-aire / aire-agua) ---
  { path: "Pfanember/HEAT EXCHANGERS/PKS_Brochure_Update_2026_Final.txt", categoria: "heat_exchanger_aa" },
  { path: "Pfanember/HEAT EXCHANGERS/WaterCooledGuide_Updated_0819.txt", categoria: "heat_exchanger_aw" },
  { path: "DownloadCentre/ThermalManagement/Flyer_EN_DTFS.txt", categoria: "heat_exchanger_aa" },
  { path: "DownloadCentre/ThermalManagement/ecool_folder_eng.txt", categoria: "heat_exchanger_aw" },

  // --- Catálogos generales (cubren varias tecnologías, con specs de modelo) ---
  { path: "DownloadCentre/CompactCatalogue/Pfannenberg_Compact_catalogue_30_en.txt", categoria: "catalogo_general" },
  { path: "Catalog_InsidePages_Master__Final_2021.txt", categoria: "catalogo_general" },
  { path: "Pfanember/CATALOGS/Catalog_InsidePages_Master__Final_2025.txt", categoria: "catalogo_general" },
  { path: "Pfanember/CATALOGS/Thermal_Management_Catalog_12_Page-Final_2024.txt", categoria: "catalogo_general" },
  { path: "DownloadCentre/LiquidCooling/Thermal_Management_EN_V4.txt", categoria: "catalogo_general" },

  // --- Controladores ---
  { path: "DownloadCentre/ThermalManagement/Controller_eng.txt", categoria: "controlador" },

  // --- Guías generales de gestión térmica de cabinets ---
  { path: "Pfanember/INDUSTRY BROCHURES & DATASHEETS_/Offset_Version.txt", categoria: "guia_general" },
  { path: "Pfanember/INDUSTRY BROCHURES & DATASHEETS_/Protect_Your_Drives_2018.txt", categoria: "guia_general" },

  // --- PSS Tutorial (guía de uso del software, no specs de producto) ---
  { path: "PSS Tutorial/PSS-Tutorial-offline.txt", categoria: "pss_tutorial" },
  { path: "PSS Tutorial/PSS-Tutorial.txt", categoria: "pss_tutorial" },
  { path: "PSS Tutorial/Pfannenberg-Support-Center-offline.txt", categoria: "pss_tutorial" },
  { path: "PSS Tutorial/Pfannenberg-Support-Center.txt", categoria: "pss_tutorial" },
];

/**
 * EXCLUIDOS explícitamente (documentado para que el equipo entienda el porqué,
 * no solo el qué):
 *
 * - Todo lo de señalización (Signaling_Catalog_2022V2, Visual_Signaling_Solutions,
 *   SIL_Signaling, Fire_Alarm*, Fixed_Gas_Alarms, Cranes_2020, Marine_Flyer,
 *   3D-Coverage, brochure_EN54-23, DNV-GL, patrol_flyer, schalling/*) —
 *   fuera de alcance por definición del proyecto (§ "Lo que NO vamos a hacer").
 *
 * - Chillers de proceso (Chiller/*, Pfannenberg_Chiller_Brochure_EN,
 *   Process-Cooling, Induction_Heating, Food_Beverage_2017 -- este último
 *   habla de EB Series *Chillers*, no de climatización de tablero) —
 *   son refrigeración de proceso industrial, no de armario eléctrico.
 *
 * - Casos de estudio, folletos por sector (Automotive, Marine, Wastewater,
 *   IndustrySolution/*, CaseStudies/*, Corporate_Brochure, Line_Card) —
 *   marketing / vertical-specific, sin datos técnicos citables para el
 *   motor de reglas.
 *
 * - Service (service_folder_eng, Service_Flyer_Refurb, Service_Solutions) —
 *   posventa, no dimensionamiento.
 *
 * - El PDF/txt del propio enunciado del hackathon — es meta-documento,
 *   no catálogo de producto.
 */