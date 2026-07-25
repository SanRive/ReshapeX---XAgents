import {
  GATE_FIELDS,
  SHORTLIST_FIELDS,
  countSatisfied,
  type ProjectSpec,
} from "@/lib/project-spec";

/**
 * Los dos umbrales de §3.6, dibujados.
 *
 * Ocho pastillas partidas 3 | 5. La division no es decoracion: dice que la
 * compuerta de tecnologia dispara antes y con menos datos que el shortlist, que
 * es la diferencia entre sentir que aprendiste algo y sentir que llenaste un
 * formulario. Es la afirmacion central del producto y por eso vive arriba de la
 * ficha, no enterrada en el brief.
 */
export function ThresholdGauge({ spec }: { spec: ProjectSpec }) {
  const gateDone = countSatisfied(spec, GATE_FIELDS);
  const listDone = countSatisfied(spec, SHORTLIST_FIELDS);
  const gateOpen = gateDone === GATE_FIELDS.length;
  const listOpen = gateOpen && listDone === SHORTLIST_FIELDS.length;

  return (
    <div>
      <div
        className="gauge"
        role="img"
        aria-label={`Compuerta ${gateDone} de ${GATE_FIELDS.length} campos. Shortlist ${listDone} de ${SHORTLIST_FIELDS.length} campos.`}
      >
        {GATE_FIELDS.map((key, i) => (
          <span
            key={key}
            className={`gauge-pip ${i < gateDone ? "gauge-pip-on" : ""}`}
          />
        ))}
        <span className="gauge-split" aria-hidden />
        {SHORTLIST_FIELDS.map((key, i) => (
          <span
            key={key}
            className={`gauge-pip ${i < listDone ? "gauge-pip-on" : ""}`}
          />
        ))}
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <span className="u-eyebrow">
          Compuerta{" "}
          <span className={gateOpen ? "text-[var(--color-declared)]" : ""}>
            {gateDone}/{GATE_FIELDS.length}
            {gateOpen ? " · abierta" : ""}
          </span>
        </span>
        <span className="u-eyebrow">
          <span className={listOpen ? "text-[var(--color-declared)]" : ""}>
            {listDone}/{SHORTLIST_FIELDS.length}
            {listOpen ? " · abierto" : ""}
          </span>{" "}
          Shortlist
        </span>
      </div>
    </div>
  );
}
