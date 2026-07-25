import {
  BLOCKING_FIELDS,
  FIELD_LABELS,
  GATE_FIELDS,
  NEMA_BY_LOCATION,
  NEMA_LABELS,
  SHORTLIST_FIELDS,
  countSatisfied,
  type Field,
  type Location,
  type ProjectSpec,
  type ProjectSpecKey,
} from "@/lib/project-spec";
import {
  STATUS_CHIP,
  STATUS_GLYPH,
  STATUS_WORD,
  formatFieldValue,
  num,
} from "@/lib/format";
import { ThresholdGauge } from "./threshold-gauge";

/**
 * D2 — LA FICHA DE TRES ESTADOS.
 *
 * Es la salida del validador de evidencia puesta en pantalla. El guardrail deja
 * de ser plomeria invisible y pasa a ser lo que se ve funcionar, que es
 * literalmente el criterio del checklist tecnico del evento.
 *
 * Cada campo es un recibo: nombre humano, nombre tecnico —el que el ingeniero
 * va a buscar en PSS—, valor, y la prueba de donde salio. Los tres estados se
 * distinguen por color, por glifo, por palabra escrita y por el patron del riel
 * izquierdo: solido, rayado, punteado. Nunca solo por color.
 */

const CONTEXT_FIELDS = [
  "project_name",
  "customer",
  "enclosure_count",
  "installation",
  "internal_temp_max_c",
] as const satisfies readonly ProjectSpecKey[];

const PENDING_PSS_FIELDS = [
  "internal_temp_min_c",
  "ambient_temp_min_c",
  "housing_color",
  "solar_load",
  "wind_exposure",
  "measured_temp_inside_c",
  "measured_temp_outside_c",
] as const satisfies readonly ProjectSpecKey[];

export function Ficha({
  spec,
  touched = [],
}: {
  spec: ProjectSpec;
  touched?: string[];
}) {
  const done = countSatisfied(spec, BLOCKING_FIELDS);
  const nema = nemaFor(spec);

  return (
    <section className="plate flex min-h-0 flex-col" aria-labelledby="ficha-title">
      <header className="border-b border-[var(--color-hairline)] px-3.5 py-3">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 id="ficha-title" className="u-nameplate text-[0.9375rem]">
            Ficha de proyecto
          </h2>
          <span className="u-datum text-[0.6875rem] text-[var(--color-ink-faint)]">
            {done}/{BLOCKING_FIELDS.length} bloqueantes
          </span>
        </div>
        <ThresholdGauge spec={spec} />
      </header>

      <div className="scroll-pane min-h-0 flex-1">
        <GroupHeading
          title="Umbral 1 · abre la compuerta"
          note="Con estos tres ya hay veredicto de tecnología, sin conocer la carga térmica."
        />
        {GATE_FIELDS.map((key) => (
          <FieldCard
            key={key}
            fieldKey={key}
            field={spec[key] as Field}
            hot={touched.includes(key)}
          />
        ))}

        {nema && (
          <div className="border-b border-[var(--color-hairline-soft)] bg-[var(--color-water-wash)] px-3.5 py-2">
            <span className="u-eyebrow text-[var(--color-water-deep)]">
              Derivado
            </span>
            <p className="u-datum mt-0.5 text-[var(--color-water-deep)]">
              {NEMA_LABELS[nema]} requerido
            </p>
            <p className="mt-0.5 text-[var(--text-micro)] text-[var(--color-ink-muted)]">
              Mapeo directo de la ubicación declarada, según el tab Environment de
              PSS. No es una decisión del modelo.
            </p>
          </div>
        )}

        <GroupHeading
          title="Umbral 2 · abre el shortlist"
          note="Los modelos concretos no salen hasta que estos cinco estén cerrados."
        />
        {SHORTLIST_FIELDS.map((key) => (
          <FieldCard
            key={key}
            fieldKey={key}
            field={spec[key] as Field}
            hot={touched.includes(key)}
          />
        ))}
        {spec.component_list && spec.component_list.length > 0 && (
          <ComponentSum spec={spec} />
        )}

        <GroupHeading title="Contexto" note="No bloquea ninguna decisión." />
        {CONTEXT_FIELDS.map((key) => (
          <FieldCard
            key={key}
            fieldKey={key}
            field={spec[key] as Field}
            hot={touched.includes(key)}
            compact
          />
        ))}

        <PendingForPss spec={spec} />
      </div>
    </section>
  );
}

/* ========================================================================== */

function GroupHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="border-b border-[var(--color-hairline-soft)] bg-[var(--color-field)] px-3.5 py-1.5">
      <h3 className="u-eyebrow text-[var(--color-ink-muted)]">{title}</h3>
      <p className="mt-0.5 text-[0.6875rem] leading-snug text-[var(--color-ink-faint)]">
        {note}
      </p>
    </div>
  );
}

function FieldCard({
  fieldKey,
  field,
  hot = false,
  compact = false,
}: {
  fieldKey: string;
  field: Field;
  hot?: boolean;
  compact?: boolean;
}) {
  const status = field.status;
  // Un `missing` sin decision trabada es un hueco, no una alarma: va neutro.
  const blank = status === "missing" && !field.blocks;

  return (
    <article
      className={`fieldcard fieldcard-${blank ? "empty" : status}${hot ? " fieldcard-hot animate-settle" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[0.8125rem] leading-tight font-medium">
            {FIELD_LABELS[fieldKey] ?? fieldKey}
          </h4>
          <code className="u-datum text-[0.6875rem] text-[var(--color-ink-faint)]">
            {fieldKey}
          </code>
        </div>
        <span
          className={`chip ${blank ? "chip-neutral" : STATUS_CHIP[status]} shrink-0`}
        >
          <span aria-hidden>{blank ? "·" : STATUS_GLYPH[status]}</span>
          {blank ? "sin dato" : STATUS_WORD[status]}
        </span>
      </div>

      <p
        className={`u-datum mt-1 leading-tight ${
          status === "missing"
            ? "text-[var(--color-ink-faint)]"
            : "text-[1.0625rem] font-medium"
        }`}
      >
        {formatFieldValue(fieldKey, field)}
      </p>

      {!compact && <Receipt field={field} />}
    </article>
  );
}

/**
 * El recibo. Es lo unico que separa este producto de un formulario relleno por
 * un chatbot: cada valor viene acompañado de la prueba, y las tres pruebas son
 * de naturaleza distinta segun el estado.
 */
function Receipt({ field }: { field: Field }) {
  if (field.status === "declared" && field.evidence) {
    return (
      <div className="receipt receipt-declared">
        <span className="italic">«{field.evidence}»</span>
        <span className="mt-1 block text-[0.6875rem] not-italic text-[var(--color-ink-faint)]">
          fragmento literal del mensaje del cliente
        </span>
      </div>
    );
  }

  if (field.status === "inferred" && field.basis) {
    return (
      <div className="receipt receipt-inferred">
        <span className="italic">«{field.basis.texto_citado}»</span>
        <span className="mt-1 block text-[0.6875rem] not-italic text-[var(--color-ink-faint)]">
          {field.basis.documento} · {field.basis.pagina}
        </span>
      </div>
    );
  }

  if (field.status === "missing" && field.blocks) {
    return <div className="receipt receipt-missing">Traba: {field.blocks}</div>;
  }

  return null;
}

/** La suma que el codigo hace sobre componentes declarados. Se muestra el
 *  desglose porque el numero total no aparece literal en ningun mensaje. */
function ComponentSum({ spec }: { spec: ProjectSpec }) {
  const list = spec.component_list ?? [];
  const total = list.reduce((acc, c) => acc + c.w * c.qty, 0);

  return (
    <div className="border-b border-[var(--color-hairline-soft)] px-3.5 py-2 pl-[1.15rem]">
      <span className="u-eyebrow">Suma de componentes declarados</span>
      <table className="mt-1 w-full text-[var(--text-micro)]">
        <tbody>
          {list.map((c) => (
            <tr key={c.name}>
              <td className="py-0.5 text-[var(--color-ink-muted)]">{c.name}</td>
              <td className="u-datum py-0.5 text-right whitespace-nowrap">
                {c.qty} × {num(c.w)} W
              </td>
            </tr>
          ))}
          <tr className="border-t border-[var(--color-hairline)]">
            <td className="py-0.5 font-medium">Total</td>
            <td className="u-datum py-0.5 text-right font-medium">
              {num(total)} W
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-[0.6875rem] leading-snug text-[var(--color-ink-faint)]">
        Suma de código sobre valores declarados. No es una estimación.
      </p>
    </div>
  );
}

function PendingForPss({ spec }: { spec: ProjectSpec }) {
  const pending = PENDING_PSS_FIELDS.filter(
    (k) => (spec[k] as Field).status === "missing",
  );
  if (pending.length === 0) return null;

  return (
    <details className="border-b border-[var(--color-hairline-soft)] px-3.5 py-2 last:border-b-0">
      <summary className="u-eyebrow cursor-pointer list-none marker:content-none">
        Pendiente para PSS · {pending.length} campos
      </summary>
      <p className="mt-1 text-[0.6875rem] leading-snug text-[var(--color-ink-faint)]">
        No bloquean nuestra decisión, pero PSS los va a pedir. Van listados en el
        brief para que el ingeniero no los descubra a mitad del wizard.
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1">
        {pending.map((k) => (
          <li key={k} className="chip chip-neutral">
            {FIELD_LABELS[k] ?? k}
          </li>
        ))}
      </ul>
    </details>
  );
}

function nemaFor(spec: ProjectSpec) {
  const loc = spec.location;
  if (loc.status === "missing" || typeof loc.value !== "string") return null;
  return NEMA_BY_LOCATION[loc.value as Location] ?? null;
}
