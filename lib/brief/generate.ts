/**
 * D5 — el generador del brief.
 *
 * Lo ensambla CÓDIGO a partir de datos ya validados. El modelo no escribe aquí:
 * si un número aparece en este documento es porque sobrevivió al validador de
 * evidencia o salió del motor de reglas con su cita.
 *
 * El orden de las secciones copia el de los tabs de PSS —Enclosure, Environment,
 * Heat Dissipation— para que el ingeniero de aplicación lo lea de arriba abajo
 * mientras llena el wizard, sin traducir nada.
 */

import {
  missingForShortlist,
  type AnyField,
  type FieldKey,
  type ProjectSpec,
} from "../project-spec";
import {
  blockingFields,
  FIELD_LABELS,
  FIELD_UNITS,
  NEMA_LABELS,
  basisCitation,
  blocksText,
  enumLabel,
  num,
} from "../format";
import type { TurnResult, Verdict } from "../turn";

const ENCLOSURE_FIELDS = [
  "height_mm",
  "width_mm",
  "depth_mm",
  "internal_temp_max_c",
  "internal_temp_min_c",
  "housing_material",
  "housing_color",
  "supply_voltage",
] as const satisfies readonly FieldKey[];

const ENVIRONMENT_FIELDS = [
  "location",
  "ambient_temp_max_c",
  "ambient_temp_min_c",
  "solar_load",
  "wind_exposure",
  "installation",
  "air_quality",
] as const satisfies readonly FieldKey[];

const MARK = { declared: "✅", inferred: "⚠️", missing: "❌" } as const;
const ACTION_MARK = {
  degraded: "❌ degradado",
  defaulted: "⚠️ default",
  summed: "➕ sumado",
  accepted: "✅ aceptado",
} as const;

export function generateBrief(turn: TurnResult, now = new Date()): string {
  const { spec } = turn;
  const out: string[] = [];
  const blocking = blockingFields(spec).length;
  const done = Math.max(0, blocking - missingForShortlist(spec).length);

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
    `**Cobertura de datos:** ${done} de ${blocking} campos bloqueantes cerrados.`,
  );

  out.push(...tabSection("1 · Enclosure", ENCLOSURE_FIELDS, spec));
  out.push(...tabSection("2 · Environment", ENVIRONMENT_FIELDS, spec));

  if (spec.derived.nema_required) {
    out.push("");
    out.push(
      `**NEMA requerido:** ${NEMA_LABELS[spec.derived.nema_required]} — derivado de la ubicación declarada (PSS Tutorial, tab Environment).`,
    );
  }
  if (spec.derived.available_mounting_faces !== null) {
    out.push(
      `**Caras libres para montar:** ${spec.derived.available_mounting_faces} — derivado de la instalación declarada.`,
    );
  }

  out.push(...tabSection("3 · Heat Dissipation", ["total_dissipation_w"], spec));

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

  out.push("");
  out.push(
    spec.measured_temps
      ? `**Temperaturas registradas:** interior ${spec.measured_temps.inside_c} °C · exterior ${spec.measured_temps.outside_c} °C. ` +
          `Es el tercer camino de PSS: se detecta y se deriva, el cálculo no lo implementamos.`
      : `**Temperaturas registradas:** no declaradas. Es el tercer camino de PSS; si existieran, el cálculo lo hace PSS.`,
  );

  if (spec.derived.required_capacity_btuh !== null) {
    out.push("");
    out.push(
      `**Capacidad requerida:** ${num(spec.derived.required_w ?? 0)} W = ` +
        `**${num(spec.derived.required_capacity_btuh)} Btu/h**, aplicando el margen del 10 % ` +
        `documentado en DTS_2017.`,
    );
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
    out.push(`${s.units_needed} unidades, una por gabinete.`);
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
  out.push(
    `Escrito por el validador, no por el modelo. Es la prueba en papel de que el guardrail actuó.`,
  );
  out.push("");
  for (const d of spec.decision_log) {
    const proposed = d.proposed !== null ? ` Propuesto: \`${d.proposed}\`.` : "";
    out.push(`- ${ACTION_MARK[d.action]} \`${d.field}\` — ${d.reason}${proposed}`);
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
  keys: readonly FieldKey[],
  spec: ProjectSpec,
): string[] {
  const out = [
    "",
    `## ${title}`,
    "",
    `| Campo | Valor | Estado | Respaldo |`,
    `|---|---|---|---|`,
  ];
  for (const key of keys) {
    const f = spec[key] as AnyField;
    const blocks = blocksText(key, spec);
    const blank = f.status === "missing" && !blocks;
    const mark = blank ? "· sin dato" : `${MARK[f.status]} ${f.status}`;
    out.push(
      `| ${FIELD_LABELS[key] ?? key} \`${key}\` | ${value(key, f)} | ${mark} | ${support(f, blocks)} |`,
    );
  }
  return out;
}

function value(key: string, f: AnyField): string {
  if (f.value === null) return "—";
  if (typeof f.value === "boolean") return f.value ? "sí" : "no";
  if (typeof f.value === "number") {
    const unit = FIELD_UNITS[key];
    return unit ? `${num(f.value)} ${unit}` : num(f.value);
  }
  return enumLabel(f.value);
}

function support(f: AnyField, blocks: string | null): string {
  if (f.status === "declared" && f.evidence) return `«${f.evidence}»`;
  if (f.status === "inferred") {
    return basisCitation(f) ?? `default sin respaldo · basis \`${f.basis}\``;
  }
  return blocks ? `traba: ${blocks}` : "pendiente-PSS";
}

function plain(f: AnyField): string {
  return f.value === null ? "—" : String(f.value);
}

function verdictMark(v: Verdict): string {
  return v === "viable" ? "✅" : v === "conditional" ? "⚠️" : "❌";
}

/** Nombre de archivo estable para la descarga. */
export function briefFilename(spec: ProjectSpec, now = new Date()): string {
  const name =
    typeof spec.project_name.value === "string" ? spec.project_name.value : "brief";
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `brief-pss-${slug || "proyecto"}-${now.toISOString().slice(0, 10)}.md`;
}
