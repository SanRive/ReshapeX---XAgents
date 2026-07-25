"use client";

import { useState } from "react";
import {
  missingForShortlist,
  type AnyField,
  type FieldKey,
  type ProjectSpec,
} from "@/lib/project-spec";
import {
  ACTION_CHIP,
  ACTION_LABEL,
  blockingFields,
  FIELD_LABELS,
  NEMA_LABELS,
  STATUS_CHIP,
  STATUS_GLYPH,
  STATUS_WORD,
  basisCitation,
  blocksText,
  formatFieldValue,
  num,
} from "@/lib/format";
import { briefFilename, generateBrief } from "@/lib/brief/generate";
import type { DecisionEntry, TurnResult } from "@/lib/turn";
import { GateVerdicts } from "./gate-verdicts";
import { ShortlistTable } from "./shortlist-table";

/**
 * D4 — la vista del ingeniero de aplicación.
 *
 * El mismo estado, leído por el otro rol. El cliente ve la conversación; el
 * ingeniero ve el artefacto: el brief mapeado tab por tab al orden de PSS, el
 * shortlist con los rechazados, el log de decisiones y —el que más aguanta una
 * pregunta— la sección de lo que no afirmamos.
 *
 * Corre entero sin red: todo lo que pinta es código puro sobre datos ya
 * validados. Si el wifi del venue se cae a mitad de demo, esta vista sigue.
 */

const PSS_TABS: { title: string; note: string; fields: readonly FieldKey[] }[] = [
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
    fields: ["total_dissipation_w"],
  },
];

export function EngineerView({ turn }: { turn: TurnResult }) {
  const { spec } = turn;
  const [copied, setCopied] = useState(false);
  const blocking = blockingFields(spec).length;
  const done = Math.max(0, blocking - missingForShortlist(spec).length);

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
          {plain(spec.project_name)} · {plain(spec.customer)} ·{" "}
          {plain(spec.enclosure_count)} gabinetes
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-inverse" onClick={download}>
            Descargar .md
          </button>
          <button type="button" className="btn btn-ghost-inverse" onClick={copy}>
            {copied ? "Copiado" : "Copiar al portapapeles"}
          </button>
          <span className="u-datum ml-auto text-[0.6875rem] text-[rgba(238,240,236,0.55)]">
            {done}/{blocking} campos bloqueantes cerrados
          </span>
        </div>
      </header>

      {/* El disclaimer es elemento central de pantalla, no nota al pie: quien
          conversa con el agente es, por definición, quien no puede validar la
          recomendación. */}
      <div className="plate plate-accent px-4 py-3">
        <p className="text-[0.875rem] leading-relaxed">
          <strong className="font-medium">
            Esto no es un dimensionamiento certificado.
          </strong>{" "}
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
            <BriefRow key={key} fieldKey={key} spec={spec} />
          ))}

          {tab.title.startsWith("Tab 2") && spec.derived.nema_required && (
            <DerivedRow
              label="NEMA requerido"
              value={NEMA_LABELS[spec.derived.nema_required]}
              note="derivado de la ubicación, tab Environment de PSS"
            />
          )}

          {tab.title.startsWith("Tab 3") && (
            <>
              {spec.component_list?.length ? (
                <ComponentTable spec={spec} />
              ) : null}
              <MeasuredTemps spec={spec} />
              {spec.derived.required_capacity_btuh !== null && (
                <DerivedRow
                  label="Capacidad requerida"
                  value={`${num(spec.derived.required_capacity_btuh)} Btu/h`}
                  note={`${num(spec.derived.required_w ?? 0)} W con el margen del 10 % citado`}
                />
              )}
            </>
          )}
        </section>
      ))}

      {turn.gate && <GateVerdicts verdicts={turn.gate} />}
      {turn.shortlist && (
        <ShortlistTable shortlist={turn.shortlist} spec={spec} />
      )}

      <DecisionLog decisions={spec.decision_log} />

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

function BriefRow({ fieldKey, spec }: { fieldKey: FieldKey; spec: ProjectSpec }) {
  const field = spec[fieldKey] as AnyField;
  const blocks = blocksText(fieldKey, spec);
  const blank = field.status === "missing" && !blocks;

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
          {support(field, blocks)}
        </span>
      </div>
    </div>
  );
}

function support(field: AnyField, blocks: string | null): string {
  if (field.status === "declared" && field.evidence) return `«${field.evidence}»`;
  if (field.status === "inferred") {
    return basisCitation(field) ?? `default sin respaldo · basis «${field.basis}»`;
  }
  return blocks ? `traba: ${blocks}` : "pendiente-PSS · no bloquea";
}

function DerivedRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="brief-row">
      <span className="u-label text-[var(--color-water-deep)]">{label}</span>
      <span className="u-datum text-[var(--color-water-deep)]">
        {value}{" "}
        <span className="text-[var(--color-ink-faint)]">· {note}</span>
      </span>
    </div>
  );
}

function ComponentTable({ spec }: { spec: ProjectSpec }) {
  const list = spec.component_list ?? [];
  const total = list.reduce((a, c) => a + c.w * c.qty, 0);

  return (
    <div className="mt-2 border-t border-[var(--color-hairline-soft)] pt-2">
      <span className="u-eyebrow">Lista de componentes declarada · se suma</span>
      <table className="mt-1.5 w-full max-w-[26rem] text-[var(--text-micro)]">
        <tbody>
          {list.map((c) => (
            <tr key={c.name}>
              <td className="py-0.5 text-[var(--color-ink-muted)]">{c.name}</td>
              <td className="u-datum py-0.5 text-right whitespace-nowrap">
                {c.qty} × {num(c.w)} W
              </td>
              <td className="u-datum py-0.5 pl-4 text-right">{num(c.w * c.qty)} W</td>
            </tr>
          ))}
          <tr className="border-t border-[var(--color-hairline)]">
            <td className="py-0.5 font-medium" colSpan={2}>
              Total
            </td>
            <td className="u-datum py-0.5 pl-4 text-right font-medium">
              {num(total)} W
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** El tercer camino de PSS. Se detecta y se deriva; el cálculo no se implementa. */
function MeasuredTemps({ spec }: { spec: ProjectSpec }) {
  return (
    <div className="brief-row">
      <div className="flex items-baseline gap-2">
        <span className="text-[0.8125rem]">Temperaturas registradas</span>
        <code className="u-datum text-[0.6875rem] text-[var(--color-ink-faint)]">
          measured_temps
        </code>
      </div>
      <div>
        {spec.measured_temps ? (
          <span className="u-datum font-medium">
            interior {num(spec.measured_temps.inside_c)} °C · exterior{" "}
            {num(spec.measured_temps.outside_c)} °C
          </span>
        ) : (
          <span className="u-datum text-[var(--color-ink-faint)]">—</span>
        )}
        <span className="mt-0.5 block text-[0.75rem] leading-snug text-[var(--color-ink-faint)]">
          Tercer camino de PSS. Se detecta y se deriva; el cálculo por temperatura
          registrada no lo implementamos.
        </span>
      </div>
    </div>
  );
}

/**
 * El log no es telemetría: es la prueba de que el guardrail actuó. Una entrada
 * `degraded` diciendo «propuso 22000, la evidencia no lo respaldaba → missing»
 * vale más en una demo que cualquier claim sobre precisión.
 *
 * Viene dentro del `ProjectSpec`, escrito por el validador. Esta vista solo lo
 * pinta.
 */
function DecisionLog({ decisions }: { decisions: DecisionEntry[] }) {
  if (decisions.length === 0) return null;

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
            key={`${d.field}-${d.action}-${i}`}
            className="flex gap-3 border-b border-[var(--color-hairline-soft)] py-1.5 last:border-b-0"
          >
            <span className={`chip shrink-0 ${ACTION_CHIP[d.action]}`}>
              {ACTION_LABEL[d.action]}
            </span>
            <div className="min-w-0">
              <code className="u-datum text-[0.6875rem] text-[var(--color-ink-faint)]">
                {d.field}
              </code>
              <p className="text-[0.8125rem] leading-relaxed">
                {d.proposed !== null && (
                  <>
                    El modelo propuso <s className="u-datum">{d.proposed}</s>.{" "}
                  </>
                )}
                {d.reason}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function plain(f: AnyField): string {
  return f.value === null ? "—" : String(f.value);
}
