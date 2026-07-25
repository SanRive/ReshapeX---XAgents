/**
 * D5 — el generador del brief.
 *
 * Lo ensambla CODIGO a partir de datos ya validados. El modelo no escribe aqui:
 * si un numero aparece en este documento es porque sobrevivio al validador de
 * evidencia o salio del motor de reglas con su cita.
 *
 * El orden de las secciones copia el de los tabs de PSS —Enclosure, Environment,
 * Heat Dissipation— para que el ingeniero de aplicacion lo lea de arriba abajo
 * mientras llena el wizard, sin traducir nada.
 */

import {
  BLOCKING_FIELDS,
  FIELD_LABELS,
  FIELD_UNITS,
  NEMA_BY_LOCATION,
  NEMA_LABELS,
  type Field,
  type Location,
  type ProjectSpec,
  type ProjectSpecKey,
} from "../project-spec";
import { enumLabel, num } from "../format";
import type { TurnResult } from "../turn";

const ENCLOSURE_FIELDS = [
  "height_mm",
  "width_mm",
  "depth_mm",
  "internal_temp_max_c",
  "internal_temp_min_c",
  "housing_material",
  "housing_color",
  "supply_voltage",
] as const satisfies readonly ProjectSpecKey[];

const ENVIRONMENT_FIELDS = [
  "location",
  "ambient_temp_max_c",
  "ambient_temp_min_c",
  "solar_load",
  "wind_exposure",
  "installation",
  "air_quality",
] as const satisfies readonly ProjectSpecKey[];

const HEAT_FIELDS = [
  "total_dissipation_w",
  "measured_temp_inside_c",
  "measured_temp_outside_c",
] as const satisfies readonly ProjectSpecKey[];

const MARK = { declared: "✅", inferred: "⚠️", missing: "❌" } as const;

export function generateBrief(turn: TurnResult, now = new Date()): string {
  const { spec } = turn;
  const out: string[] = [];

  out.push(`# Brief técnico PSS-ready`);
  out.push("");
  out.push(
    `**Proyecto:** ${plain(spec.project_name)} · **Cliente:** ${plain(spec.customer)}`,
  );
  out.push(
    `**Generado:** ${now.toISOString().slice(0, 10)} · **Gabinetes:** ${plain(spec.enclosure_count)}`,
  );
  out.push("");
  out.push(
    `> Pre-selección de tecnología y de producto, con cita. **No es un dimensionamiento certificado.** ` +
      `El paso siguiente es PSS con un ingeniero de aplicación; este documento existe para que ese paso ` +
      `tome cinco minutos en vez de tres días.`,
  );
  out.push("");
  out.push(
    `**Cobertura de datos:** ${countDone(spec)} de ${BLOCKING_FIELDS.length} campos bloqueantes cerrados.`,
  );

  out.push(...tabSection("1 · Enclosure", ENCLOSURE_FIELDS, spec));
  out.push(...tabSection("2 · Environment", ENVIRONMENT_FIELDS, spec));

  const nema = nemaFor(spec);
  if (nema) {
    out.push("");
    out.push(
      `**NEMA requerido:** ${NEMA_LABELS[nema]} — derivado de la ubicación declarada (PSS Tutorial, tab Environment).`,
    );
  }

  out.push(...tabSection("3 · Heat Dissipation", HEAT_FIELDS, spec));

  if (spec.component_list?.length) {
    out.push("");
    out.push(`**Lista de componentes declarada** (se suma, no se estima):`);
    out.push("");
    out.push(`| Componente | Cantidad | W c/u | W total |`);
    out.push(`|---|---:|---:|---:|`);
    for (const c of spec.component_list) {
      out.push(`| ${c.name} | ${c.qty} | ${c.w} | ${c.w * c.qty} |`);
    }
    const total = spec.component_list.reduce((a, c) => a + c.w * c.qty, 0);
    out.push(`| **Total** | | | **${total}** |`);
  }

  if (turn.gate) {
    out.push("");
    out.push(`## Compuerta de tecnología`);
    out.push("");
    for (const v of turn.gate) {
      out.push(`### ${verdictMark(v.verdict)} ${v.label}`);
      out.push("");
      out.push(v.reason);
      out.push("");
      for (const c of v.citations) {
        out.push(`> «${c.texto_citado}»`);
        out.push(`> — ${c.documento} · ${c.pagina}`);
        out.push("");
      }
    }
  }

  if (turn.shortlist) {
    const s = turn.shortlist;
    out.push(`## Shortlist · Cooling Units`);
    out.push("");
    out.push(
      `Disipación declarada **${num(s.total_dissipation_w)} W** × 1.10 de margen = ` +
        `**${num(s.required_w)} W** = **${num(s.required_btuh)} Btu/h** requeridos. ` +
        `${s.units_needed} unidades.`,
    );
    out.push("");
    out.push(`| Modelo | Btu/h | Voltajes | NEMA | Montaje | Alto mm | Veredicto |`);
    out.push(`|---|---|---|---|---|---:|---|`);
    for (const c of [...s.candidates, ...s.rejected]) {
      out.push(
        `| ${c.model} | ${num(c.capacity_btuh[0])} – ${num(c.capacity_btuh[1])} | ` +
          `${c.voltages.join(" / ")} | ${c.nema_available.join(" · ")} | ${c.mounting} | ` +
          `${c.dimensions_mm.h > 0 ? num(c.dimensions_mm.h) : "—"} | ${verdictMark(c.verdict)} |`,
      );
    }
    out.push("");
    for (const c of [...s.candidates, ...s.rejected]) {
      out.push(`**${c.model}** — ${c.reason}`);
      for (const cite of c.citations) {
        out.push(`  · ${cite.documento} · ${cite.pagina}: «${cite.texto_citado}»`);
      }
      out.push("");
    }
    if (s.derating_note) {
      out.push(`### Base de rating`);
      out.push("");
      out.push(s.derating_note);
      out.push("");
    }
  }

  if (turn.questions.length) {
    out.push(`## Datos pendientes del cliente`);
    out.push("");
    for (const q of turn.questions) {
      out.push(`### ${FIELD_LABELS[q.field] ?? q.field} \`${q.field}\``);
      out.push("");
      out.push(`- **Para qué:** ${q.why}`);
      out.push(`- **Dónde:** ${q.where}`);
      if (q.alternative) out.push(`- **Camino alterno:** ${q.alternative}`);
      if (q.antipattern) out.push(`- **No sirve:** ${q.antipattern}`);
      out.push("");
    }
  }

  out.push(`## Log de decisiones`);
  out.push("");
  for (const d of turn.decisions) {
    const cite = d.citation
      ? ` _(${d.citation.documento} · ${d.citation.pagina})_`
      : "";
    out.push(`- \`${d.kind}\` ${d.text}${cite}`);
  }
  out.push("");

  out.push(`## Lo que no afirmamos`);
  out.push("");
  for (const d of turn.disclaimers) out.push(`- ${d}`);
  out.push("");
  out.push(`---`);
  out.push("");
  out.push(
    `_Engineering Copilot Pfannenberg. Las reglas de tecnología y el filtro de producto son ` +
      `código determinista sobre datos transcritos del catálogo con página. El modelo de lenguaje ` +
      `extrae y redacta; no decide, y no puede introducir un número que no esté en la entrada o en ` +
      `un default documentado._`,
  );

  return out.join("\n");
}

/* ========================================================================== */

function tabSection(
  title: string,
  keys: readonly ProjectSpecKey[],
  spec: ProjectSpec,
): string[] {
  const out = ["", `## ${title}`, "", `| Campo | Valor | Estado | Respaldo |`, `|---|---|---|---|`];
  for (const key of keys) {
    const f = spec[key] as Field;
    const blank = f.status === "missing" && !f.blocks;
    const mark = blank ? "· sin dato" : `${MARK[f.status]} ${f.status}`;
    out.push(
      `| ${FIELD_LABELS[key] ?? key} \`${key}\` | ${value(key, f)} | ${mark} | ${support(f)} |`,
    );
  }
  return out;
}

function value(key: string, f: Field): string {
  if (f.value === null) return "—";
  if (typeof f.value === "boolean") return f.value ? "sí" : "no";
  if (typeof f.value === "number") {
    const unit = FIELD_UNITS[key];
    return unit ? `${num(f.value)} ${unit}` : num(f.value);
  }
  return enumLabel(f.value);
}

function support(f: Field): string {
  if (f.status === "declared" && f.evidence) return `«${f.evidence}»`;
  if (f.status === "inferred" && f.basis) {
    return `${f.basis.documento} · ${f.basis.pagina}: «${f.basis.texto_citado}»`;
  }
  if (f.status === "missing") return f.blocks ? `traba: ${f.blocks}` : "pendiente-PSS";
  return "";
}

function plain(f: Field): string {
  if (f.value === null) return "—";
  return String(f.value);
}

function countDone(spec: ProjectSpec): number {
  return BLOCKING_FIELDS.filter((k) => {
    const f = spec[k] as Field;
    return f.status !== "missing" && f.value !== null;
  }).length;
}

function verdictMark(v: "viable" | "conditional" | "rejected"): string {
  return v === "viable" ? "✅" : v === "conditional" ? "⚠️" : "❌";
}

function nemaFor(spec: ProjectSpec) {
  const loc = spec.location;
  if (loc.status === "missing" || typeof loc.value !== "string") return null;
  return NEMA_BY_LOCATION[loc.value as Location] ?? null;
}

/** Nombre de archivo estable para la descarga. */
export function briefFilename(spec: ProjectSpec, now = new Date()): string {
  // Sin nombre de proyecto el archivo se llama `brief-pss-proyecto-…`, no
  // `brief-pss-brief-…`: el prefijo ya dice qué es.
  const name =
    typeof spec.project_name.value === "string" && spec.project_name.value.trim()
      ? spec.project_name.value
      : "proyecto";
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `brief-pss-${slug || "proyecto"}-${now.toISOString().slice(0, 10)}.md`;
}
