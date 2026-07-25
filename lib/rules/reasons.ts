/**
 * Plantillas deterministas de redacción del motor de reglas.
 *
 * **Ningún texto de `gate.ts` ni de `shortlist.ts` lo redacta un LLM.** La misma entrada
 * tiene que producir exactamente la misma cadena; si no, es un bug y los tests lo cazan.
 *
 * Solo formateo: nada de aquí toma decisiones de ingeniería.
 */

/** Formatea una temperatura en °C sin ceros decimales sobrantes. `38` → `"38 °C"`. */
export function fmtC(value: number): string {
  return `${fmtNum(value)} °C`;
}

/** Formatea W con separador de miles y unidad explícita. */
export function fmtW(value: number): string {
  return `${fmtNum(value)} W`;
}

/** Formatea Btu/h con separador de miles y unidad explícita. */
export function fmtBtuH(value: number): string {
  return `${fmtNum(value)} Btu/h`;
}

/** Porcentaje con un decimal como máximo. */
export function fmtPct(value: number): string {
  return `${fmtNum(value)} %`;
}

/**
 * Número con hasta un decimal y separador de miles fino (espacio estrecho), estable
 * entre entornos: `Intl` puede variar de locale entre Node y el navegador, así que el
 * formateo se hace a mano para que la salida sea reproducible.
 */
export function fmtNum(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const [intPart, decPart] = Math.abs(rounded).toFixed(1).split(".");
  const grouped = (intPart ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const sign = rounded < 0 ? "-" : "";
  return decPart === "0" ? `${sign}${grouped}` : `${sign}${grouped},${decPart}`;
}

/** `["a", "b", "c"]` → `"a, b y c"`. Lista vacía → `""`. */
export function joinEs(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]!}`;
}

/** Etiqueta legible del enum de voltaje. */
export function voltageLabel(v: "115V" | "230V" | "400_460V_3ph"): string {
  switch (v) {
    case "115V":
      return "115 V";
    case "230V":
      return "230 V";
    case "400_460V_3ph":
      return "400/460 V 3~";
  }
}

/** Etiqueta legible del enum de montaje. */
export function mountingLabel(m: "side" | "integrated" | "top"): string {
  switch (m) {
    case "side":
      return "montaje lateral";
    case "integrated":
      return "montaje integrado / recessed";
    case "top":
      return "montaje superior";
  }
}

/** Etiqueta legible del enum de material. */
export function materialLabel(m: "painted_steel" | "stainless_steel"): string {
  return m === "stainless_steel" ? "acero inoxidable" : "acero pintado";
}

/** Etiqueta legible del enum de instalación. */
export function installationLabel(i: "free_standing" | "wall_mounted" | "recessed_in_line"): string {
  switch (i) {
    case "free_standing":
      return "exento";
    case "wall_mounted":
      return "contra pared";
    case "recessed_in_line":
      return "encajonado entre otros gabinetes";
  }
}
