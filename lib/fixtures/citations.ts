/**
 * Citas del corpus que necesitan los fixtures y la UI.
 *
 * Transcritas a mano del catalogo con su pagina (spec §4.2 y §4.2.b). Cuando la
 * pista B publique `lib/rules/catalog-data.ts`, este archivo pasa a re-exportar
 * de alli y deja de ser fuente. Hasta entonces es lo que permite que la UI
 * arranque sin esperar al motor de reglas.
 *
 * ⚠ Pendiente del spec §6: verificar la numeracion de pagina real del catalogo
 * NA de 12 paginas antes de citarla frente a un juez.
 */

import type { Citation } from "../project-spec";

const CAT = "Thermal_Management_Catalog_12_Page-Final_2024";
const PSS = "PSS Tutorial";
const DTS = "DTS_2017";

export const CITE = {
  matrizTecnologia: {
    documento: CAT,
    pagina: "p. 2",
    texto_citado:
      "High Ambient and/or Very Harsh, Dirty Conditions → PWS Air/Water Heat Exchangers",
  },
  matrizCoolAmbient: {
    documento: CAT,
    pagina: "p. 2",
    texto_citado:
      "Cool Ambient, Dirty Conditions → PKS Air/Air Heat Exchangers",
  },
  matrizAltoAmbiente: {
    documento: CAT,
    pagina: "p. 2",
    texto_citado: "High Ambient & Clean or Dirty Conditions → DTS Cooling Units",
  },
  /**
   * ⚠ Re-anclado el 2026-07-25 tras verificar el corpus.
   *
   * Antes apuntaba al catálogo NA: "Electronics are typically most efficient in
   * low humidity with a temperature around 95°". Esa frase habla del punto
   * ÓPTIMO de eficiencia, NO de un máximo, así que no sostiene el default de
   * 35 °C — un juez la tumba con una pregunta.
   *
   * PSS llama a 95 °F la temperatura máxima admisible dentro del gabinete, y
   * 95 °F = 35 °C exactos. Citar a PSS es más fuerte: es la herramienta que
   * alimentamos. Misma cita que `DEFAULTS.internal_temp_max_c`.
   */
  tempInterna: {
    documento: "PSS Tutorial",
    pagina: "Results",
    texto_citado:
      "the ambient temperature selected (100°F) is higher than the maximum allowable temperature inside the enclosure (95°F)",
  },
  conveccionNatural: {
    documento: CAT,
    pagina: "p. 4",
    texto_citado:
      "If the ambient temperature is always lower than the required temperature in the electrical enclosure, then this method is an economical solution.",
  },
  coolingActivo: {
    documento: CAT,
    pagina: "p. 6",
    texto_citado:
      "If the ambient temperature is greater than the target internal temperature of the enclosure, active cooling is required.",
  },
  lazoCerrado: {
    documento: CAT,
    pagina: "p. 6",
    texto_citado:
      "If a NEMA Type 12/3R/4/4x rating is required — closed loop systems can maintain the NEMA Type rating of the cabinet.",
  },
  dtsVariantes: {
    documento: CAT,
    pagina: "p. 7",
    texto_citado: "Also available in Outdoor (Type 3R/4) and Washdown (Type 4/4x).",
  },
  dttSoloType12: {
    documento: CAT,
    pagina: "p. 7",
    texto_citado: "DTT Series Top Mount Type 12 Cooling Units",
  },
  sobredimensionar: {
    documento: CAT,
    pagina: "p. 6",
    texto_citado: "avoid costly oversizing or dangerous undersizing",
  },
  pssNema: {
    documento: PSS,
    pagina: "tab Environment",
    texto_citado:
      "Indoor (NEMA Type 12), Outdoor (NEMA Type 3R/4), or Washdown (NEMA Type 4/4X)",
  },
  pssCompuerta: {
    documento: PSS,
    pagina: "Results",
    texto_citado:
      "filter fan and air/air heat exchanger are not possible, this is because the ambient temperature selected (100 °F) is higher than the maximum allowable temperature inside the enclosure (95 °F)",
  },
  pssVerificarComponentes: {
    documento: PSS,
    pagina: "tab Heat Dissipation",
    texto_citado:
      "It is recommended to still verify heat loss of each individual component as these values might be higher than the actual components that are being used.",
  },
  pssVoltaje: {
    documento: PSS,
    pagina: "tab Enclosure",
    texto_citado:
      "Supply Voltage … Please note this can change which units show in the final solution page.",
  },
  pssTempRegistrada: {
    documento: PSS,
    pagina: "tab Heat Dissipation",
    texto_citado:
      "Calculate Dissipation based on Recorded Temperature … typically for existing enclosures in the field",
  },
  margen10: {
    documento: DTS,
    pagina: "sizing",
    texto_citado:
      "The refrigeration capacity should exceed the dissipation loss from the installed components by approximately 10%.",
  },
  baseDin: {
    documento: DTS,
    pagina: "rating basis",
    texto_citado:
      "Pfannenberg utilizes the DIN standard 35/35 °C when rating our cooling units. Many other companies use 50/50 °C, which provides a higher, non-usable value. Customers should use their own application temperatures to determine the proper cooling capacity of the system.",
  },
  capacidadVaria: {
    documento: DTS,
    pagina: "quick selection",
    texto_citado: "Note: Cooling capacity may vary between voltage and configurations.",
  },
  formulaPcPd: {
    documento: DTS,
    pagina: "sizing",
    texto_citado:
      "PC = PD − PR, con PR = C × A × ΔT — C coeficiente de transmision [W/m²°C], A superficie [m²]",
  },
} as const satisfies Record<string, Citation>;

export type CitationKey = keyof typeof CITE;
