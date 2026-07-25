"use client";

import { useState } from "react";
import {
  BLOCKING_FIELDS,
  FIELD_LABELS,
  NEMA_BY_LOCATION,
  NEMA_LABELS,
  countSatisfied,
  type Field,
  type Location,
  type ProjectSpec,
  type ProjectSpecKey,
} from "@/lib/project-spec";
import { STATUS_CHIP, STATUS_GLYPH, STATUS_WORD, formatFieldValue } from "@/lib/format";
import { briefFilename, generateBrief } from "@/lib/brief/generate";
import type { DecisionEntry, TurnResult } from "@/lib/turn";
import { CiteStamp } from "./cite";
import { GateVerdicts } from "./gate-verdicts";
import { ShortlistTable } from "./shortlist-table";

/**
 * D4 — la vista del ingeniero de aplicacion.
 *
 * El mismo estado, leido por el otro rol. El cliente ve la conversacion; el
 * ingeniero ve el artefacto: el brief mapeado tab por tab al orden de PSS, el
 * shortlist con los rechazados, el log de decisiones y —el que mas aguanta una
 * pregunta— la seccion de lo que no afirmamos.
 *
 * Corre entero sin red: todo lo que pinta es codigo puro sobre datos ya
 * validados. Si el wifi del venue se cae a mitad de demo, esta vista sigue.
 */

const PSS_TABS: { title: string; note: string; fields: readonly ProjectSpecKey[] }[] = [
  {
    title: "Tab 1 · Enclosure",
    note: "Geometría, material y alimentación del gabinete.",
    fields: [
      "height_mm",
      "width_mm",
      "depth_mm",
      "internal_temp_max_c",
      "internal_temp_min_c",
      "housing_material",
      "housing_color",
      "supply_voltage",
    ],
  },
  {
    title: "Tab 2 · Environment",
    note: "Dónde vive el gabinete y qué respira.",
    fields: [
      "location",
      "ambient_temp_max_c",
      "ambient_temp_min_c",
      "solar_load",
      "wind_exposure",
      "installation",
      "air_quality",
    ],
  },
  {
    title: "Tab 3 · Heat Dissipation",
    note: "Los tres caminos que PSS reconoce. Declarada, sumada o por temperatura registrada.",
    fields: [
      "total_dissipation_w",
      "measured_temp_inside_c",
      "measured_temp_outside_c",
    ],
  },
];

export function EngineerView({ turn }: { turn: TurnResult }) {
  const { spec } = turn;
  const [copied, setCopied] = useState(false);
  const done = countSatisfied(spec, BLOCKING_FIELDS);
  const nema = nemaFor(spec);

  function download() {
    const blob = new Blob([generateBrief(turn)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = briefFilename(spec);
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    await navigator.clipboard.writeText(generateBrief(turn));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto flex w-full max-w-[62rem] flex-col gap-4 pb-10">
      {/* Cabecera del artefacto: placa antracita, como la chapa de un equipo. */}
      <header className="rounded-[3px] bg-[var(--color-anthracite)] px-5 py-5 text-[var(--color-ink-inverse)] sm:px-7 sm:py-6">
        <span className="u-eyebrow text-[rgba(238,240,236,0.55)]">
          Fase 4 · artefacto
        </span>
        <h1 className="u-nameplate mt-2 text-[clamp(1.5rem,4vw,2.25rem)]">
          Brief técnico
          <br />
          PSS-ready
        </h1>
        <p className="u-datum mt-3 text-[0.8125rem] text-[rgba(238,240,236,0.72)]">
          {stringOf(spec.project_name)} · {stringOf(spec.customer)} ·{" "}
          {stringOf(spec.enclosure_count)} gabinetes
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-inverse" onClick={download}>
            Descargar .md
          </button>
          <button type="button" className="btn btn-ghost-inverse" onClick={copy}>
            {copied ? "Copiado" : "Copiar al portapapeles"}
          </button>
          <span className="u-datum ml-auto text-[0.6875rem] text-[rgba(238,240,236,0.55)]">
            {done}/{BLOCKING_FIELDS.length} campos bloqueantes cerrados
          </span>
        </div>
      </header>

      {/* El disclaimer es elemento central de pantalla, no nota al pie: quien
          conversa con el agente es, por definicion, quien no puede validar la
          recomendacion. */}
      <div className="plate plate-accent px-4 py-3">
        <p className="text-[0.875rem] leading-relaxed">
          <strong className="font-medium">Esto no es un dimensionamiento
          certificado.</strong>{" "}
          Es una pre-selección de tecnología y de producto, cada afirmación con su
          cita. El cálculo certificado —carga solar, material, superficie efectiva,
          curvas de derating— lo hace PSS. Este documento existe para que abrir PSS
          tome cinco minutos en vez de tres días.
        </p>
      </div>

      {PSS_TABS.map((tab) => (
        <section key={tab.title} className="plate px-4 py-3.5">
          <div className="brief-prose">
            <h3>{tab.title}</h3>
            <p className="mb-2 text-[0.8125rem] text-[var(--color-ink-faint)]">
              {tab.note}
            </p>
          </div>
          {tab.fields.map((key) => (
            <BriefRow key={key} fieldKey={key} field={spec[key] as Field} />
          ))}
          {tab.title.startsWith("Tab 2") && nema && (
            <div className="brief-row">
              <span className="u-label text-[var(--color-water-deep)]">
                NEMA requerido
              </span>
              <span className="u-datum text-[var(--color-water-deep)]">
                {NEMA_LABELS[nema]}{" "}
                <span className="text-[var(--color-ink-faint)]">
                  · derivado de la ubicación, tab Environment de PSS
                </span>
              </span>
            </div>
          )}
        </section>
      ))}

      {turn.gate && <GateVerdicts verdicts={turn.gate} />}
      {turn.shortlist && <ShortlistTable shortlist={turn.shortlist} />}

      <DecisionLog decisions={turn.decisions} />

      <section className="plate px-4 py-3.5">
        <div className="brief-prose">
          <h3>Lo que no afirmamos</h3>
          <p className="mb-2.5 text-[0.8125rem] text-[var(--color-ink-faint)]">
            La sección que separa una pre-selección honesta de una recomendación
            con confianza falsa.
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {turn.disclaimers.map((d, i) => (
            <li
              key={i}
              className="border-l-2 border-l-[var(--color-hairline)] pl-3 text-[0.875rem] leading-relaxed text-[var(--color-ink-muted)]"
            >
              {d}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ========================================================================== */

function BriefRow({ fieldKey, field }: { fieldKey: string; field: Field }) {
  // Mismo criterio que la ficha: sin decision trabada, un hueco es un hueco.
  const blank = field.status === "missing" && !field.blocks;

  return (
    <div className="brief-row">
      <div className="flex items-baseline gap-2">
        <span className="text-[0.8125rem]">{FIELD_LABELS[fieldKey] ?? fieldKey}</span>
        <code className="u-datum text-[0.6875rem] text-[var(--color-ink-faint)]">
          {fieldKey}
        </code>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span
          className={`u-datum ${field.status === "missing" ? "text-[var(--color-ink-faint)]" : "font-medium"}`}
        >
          {formatFieldValue(fieldKey, field)}
        </span>
        <span className={`chip ${blank ? "chip-neutral" : STATUS_CHIP[field.status]}`}>
          <span aria-hidden>{blank ? "·" : STATUS_GLYPH[field.status]}</span>
          {blank ? "sin dato" : STATUS_WORD[field.status]}
        </span>
        <span className="min-w-0 basis-full text-[0.75rem] leading-snug text-[var(--color-ink-faint)]">
          {supportText(field)}
        </span>
      </div>
    </div>
  );
}

function supportText(field: Field): string {
  if (field.status === "declared" && field.evidence) return `«${field.evidence}»`;
  if (field.status === "inferred" && field.basis) {
    return `${field.basis.documento} · ${field.basis.pagina} — «${field.basis.texto_citado}»`;
  }
  if (field.status === "missing") {
    return field.blocks ? `traba: ${field.blocks}` : "pendiente-PSS · no bloquea";
  }
  return "";
}

/**
 * El log no es telemetria: es la prueba de que el guardrail actuo. Una entrada
 * `degraded` diciendo «propuso 380, la evidencia no contenia esos digitos →
 * missing» vale mas en una demo que cualquier claim sobre precision.
 */
function DecisionLog({ decisions }: { decisions: DecisionEntry[] }) {
  const KIND_LABEL: Record<DecisionEntry["kind"], string> = {
    extract: "extracción",
    degraded: "degradado",
    default: "default",
    gate: "compuerta",
    shortlist: "shortlist",
    guardrail: "guardrail",
    tool: "tool",
  };

  return (
    <section className="plate px-4 py-3.5">
      <div className="brief-prose">
        <h3>Log de decisiones</h3>
        <p className="mb-2.5 text-[0.8125rem] text-[var(--color-ink-faint)]">
          Cada paso que tocó el estado, en orden, con lo que lo justifica.
        </p>
      </div>
      <ol className="flex flex-col">
        {decisions.map((d, i) => (
          <li
            key={i}
            className="flex gap-3 border-b border-[var(--color-hairline-soft)] py-1.5 last:border-b-0"
          >
            <span
              className={`chip shrink-0 ${d.kind === "guardrail" ? "chip-missing" : d.kind === "default" ? "chip-inferred" : "chip-neutral"}`}
            >
              {KIND_LABEL[d.kind]}
            </span>
            <div className="min-w-0">
              <p className="text-[0.8125rem] leading-relaxed">{d.text}</p>
              {d.citation && (
                <div className="mt-0.5">
                  <CiteStamp citation={d.citation} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function stringOf(f: Field): string {
  return f.value === null ? "—" : String(f.value);
}

function nemaFor(spec: ProjectSpec) {
  const loc = spec.location;
  if (loc.status === "missing" || typeof loc.value !== "string") return null;
  return NEMA_BY_LOCATION[loc.value as Location] ?? null;
}
