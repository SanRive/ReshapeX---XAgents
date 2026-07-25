import {
  GATE_REQUIRED,
  missingForShortlist,
  type AnyField,
  type FieldKey,
  type ProjectSpec,
} from "@/lib/project-spec";
import {
  FIELD_LABELS,
  NEMA_LABELS,
  STATUS_CHIP,
  STATUS_GLYPH,
  STATUS_WORD,
  basisCitation,
  blockingFields,
  blocksText,
  formatFieldValue,
  num,
  shortlistFields,
  washdownApplies,
} from "@/lib/format";
import { ThresholdGauge } from "./threshold-gauge";

/**
 * D2 — LA FICHA DE TRES ESTADOS.
 *
 * Es la salida del validador de evidencia puesta en pantalla. El guardrail deja
 * de ser plomería invisible y pasa a ser lo que se ve funcionar, que es
 * literalmente el criterio del checklist técnico del evento.
 *
 * Cada campo es un recibo: nombre humano, nombre técnico —el que el ingeniero
 * va a buscar en PSS—, valor, y la prueba de dónde salió. Los tres estados se
 * distinguen por color, por glifo, por palabra escrita y por el patrón del riel
 * izquierdo: sólido, rayado, punteado. Nunca solo por color.
 *
 * Un cuarto tratamiento, neutro, para el `missing` que no traba nada: antes de
 * leer nada la ficha está vacía, y pintarla entera de rojo grita una alarma que
 * no existe.
 */

const CONTEXT_FIELDS = [
  "project_name",
  "customer",
  "enclosure_count",
  "installation",
  "internal_temp_max_c",
] as const satisfies readonly FieldKey[];

const PENDING_PSS_FIELDS = [
  "internal_temp_min_c",
  "ambient_temp_min_c",
  "housing_color",
  "solar_load",
  "wind_exposure",
] as const satisfies readonly FieldKey[];

export function Ficha({
  spec,
  touched = [],
}: {
  spec: ProjectSpec;
  touched?: string[];
}) {
  const blocking = blockingFields(spec).length;
  const done = Math.max(0, blocking - missingForShortlist(spec).length);
  const listKeys = shortlistFields(spec);

  return (
    <section className="plate flex min-h-0 flex-col" aria-labelledby="ficha-title">
      <header className="border-b border-[var(--color-hairline)] px-3.5 py-3">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 id="ficha-title" className="u-nameplate text-[0.9375rem]">
            Ficha de proyecto
          </h2>
          <span className="u-datum text-[0.6875rem] text-[var(--color-ink-faint)]">
            {done}/{blocking} bloqueantes
          </span>
        </div>
        <ThresholdGauge spec={spec} />
      </header>

      <div className="scroll-pane min-h-0 flex-1">
        <GroupHeading
          title="Umbral 1 · abre la compuerta"
          note="Con estos tres ya hay veredicto de tecnología, sin conocer la carga térmica."
        />
        {GATE_REQUIRED.map((key) => (
          <FieldCard
            key={key}
            fieldKey={key}
            spec={spec}
            hot={touched.includes(key)}
          />
        ))}

        {spec.derived.nema_required && (
          <Derived
            label="Rating requerido"
            value={NEMA_LABELS[spec.derived.nema_required]}
            note="Mapeo directo de la ubicación declarada, según el tab Environment de PSS. No es una decisión del modelo."
          />
        )}

        <GroupHeading
          title="Umbral 2 · abre el shortlist"
          note={`Los modelos concretos no salen hasta que estos ${listKeys.length} estén cerrados.`}
        />
        {listKeys.map((key) => (
          <FieldCard
            key={key}
            fieldKey={key}
            spec={spec}
            hot={touched.includes(key)}
          />
        ))}
        {spec.component_list && spec.component_list.length > 0 && (
          <ComponentSum spec={spec} />
        )}

        {spec.derived.required_capacity_btuh !== null && (
          <Derived
            label="Capacidad requerida"
            value={`${num(spec.derived.required_capacity_btuh)} Btu/h`}
            note={`Disipación × 1.10 de margen citado = ${num(spec.derived.required_w ?? 0)} W. Conversión de unidades, no ingeniería.`}
          />
        )}

        <GroupHeading title="Contexto" note="No bloquea ninguna decisión." />
        {CONTEXT_FIELDS.map((key) => (
          <FieldCard
            key={key}
            fieldKey={key}
            spec={spec}
            hot={touched.includes(key)}
            compact
          />
        ))}
        {!washdownApplies(spec) && (
          <FieldCard
            fieldKey="housing_material"
            spec={spec}
            hot={touched.includes("housing_material")}
            compact
          />
        )}
        {spec.derived.available_mounting_faces !== null && (
          <Derived
            label="Caras libres para montar"
            value={String(spec.derived.available_mounting_faces)}
            note="Derivado de la instalación declarada."
          />
        )}

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

/** Lo que calcula código puro a partir del spec. Se marca aparte a propósito:
 *  no es algo que el modelo pudiera haber escrito. */
function Derived({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="border-b border-[var(--color-hairline-soft)] bg-[var(--color-water-wash)] px-3.5 py-2">
      <span className="u-eyebrow text-[var(--color-water-deep)]">
        Derivado · {label}
      </span>
      <p className="u-datum mt-0.5 text-[1.0625rem] font-medium text-[var(--color-water-deep)]">
        {value}
      </p>
      <p className="mt-0.5 text-[var(--text-micro)] leading-snug text-[var(--color-ink-muted)]">
        {note}
      </p>
    </div>
  );
}

function FieldCard({
  fieldKey,
  spec,
  hot = false,
  compact = false,
}: {
  fieldKey: FieldKey;
  spec: ProjectSpec;
  hot?: boolean;
  compact?: boolean;
}) {
  const field = spec[fieldKey] as AnyField;
  const blocks = blocksText(fieldKey, spec);
  const blank = field.status === "missing" && !blocks;

  return (
    <article
      className={`fieldcard fieldcard-${blank ? "empty" : field.status}${hot ? " fieldcard-hot animate-settle" : ""}`}
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
          className={`chip ${blank ? "chip-neutral" : STATUS_CHIP[field.status]} shrink-0`}
        >
          <span aria-hidden>{blank ? "·" : STATUS_GLYPH[field.status]}</span>
          {blank ? "sin dato" : STATUS_WORD[field.status]}
        </span>
      </div>

      <p
        className={`u-datum mt-1 leading-tight ${
          field.status === "missing"
            ? "text-[var(--color-ink-faint)]"
            : "text-[1.0625rem] font-medium"
        }`}
      >
        {formatFieldValue(fieldKey, field)}
      </p>

      {!compact && (
        <Receipt field={field} fieldKey={fieldKey} spec={spec} blocks={blocks} />
      )}
    </article>
  );
}

/**
 * El recibo. Es lo único que separa este producto de un formulario relleno por
 * un chatbot: cada valor viene acompañado de la prueba, y las tres pruebas son
 * de naturaleza distinta según el estado.
 */
function Receipt({
  field,
  fieldKey,
  spec,
  blocks,
}: {
  field: AnyField;
  fieldKey: string;
  spec: ProjectSpec;
  blocks: string | null;
}) {
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

  if (field.status === "inferred") {
    const cita = basisCitation(field);
    return (
      <div className="receipt receipt-inferred">
        {cita ? (
          <span className="italic">{cita}</span>
        ) : (
          <span>
            Marcado como inferido sin un default válido en la lista blanca. El
            validador tendría que haberlo degradado.
          </span>
        )}
        <span className="mt-1 block text-[0.6875rem] not-italic text-[var(--color-ink-faint)]">
          default documentado · clave{" "}
          <code className="u-datum">{field.basis}</code>
        </span>
      </div>
    );
  }

  if (field.status === "missing") {
    const degraded = spec.decision_log.find(
      (d) => d.field === fieldKey && d.action === "degraded",
    );
    return (
      <>
        {blocks && <div className="receipt receipt-missing">Traba: {blocks}</div>}
        {degraded && (
          <div className="receipt receipt-missing mt-1">
            <span className="u-eyebrow text-[#8e0d0b]">Guardrail</span>
            <span className="mt-0.5 block not-italic">
              {degraded.proposed !== null && (
                <>
                  El modelo propuso{" "}
                  <s className="u-datum">{degraded.proposed}</s>.{" "}
                </>
              )}
              {degraded.reason}
            </span>
          </div>
        )}
      </>
    );
  }

  return null;
}

/** La suma que el código hace sobre componentes declarados. Se muestra el
 *  desglose porque el total no aparece literal en ningún mensaje. */
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
    (k) => (spec[k] as AnyField).status === "missing",
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
