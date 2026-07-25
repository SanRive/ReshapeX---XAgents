import {
  GATE_REQUIRED,
  isResolved,
  type AnyField,
  type FieldKey,
  type ProjectSpec,
} from "@/lib/project-spec";
import { shortlistFields } from "@/lib/format";

/**
 * Los dos umbrales de §3.6, dibujados.
 *
 * Pastillas partidas 3 | 5. La división no es decoración: dice que la compuerta
 * de tecnología dispara antes y con menos datos que el shortlist, que es la
 * diferencia entre sentir que aprendiste algo y sentir que llenaste un
 * formulario. Es la afirmación central del producto y por eso vive arriba de la
 * ficha, no enterrada en el brief.
 *
 * El lado derecho crece a seis pastillas cuando el entorno es washdown: ahí el
 * material del gabinete deja de ser cosmético y pasa a bloquear. Contar siempre
 * cinco haría que el medidor mintiera justo en el caso de la demo.
 */
export function ThresholdGauge({ spec }: { spec: ProjectSpec }) {
  const listKeys = shortlistFields(spec);
  const resolved = (k: FieldKey) => isResolved(spec[k] as AnyField);

  const gateDone = GATE_REQUIRED.filter(resolved).length;
  const listDone = listKeys.filter(resolved).length;
  const gateOpen = gateDone === GATE_REQUIRED.length;
  const listOpen = gateOpen && listDone === listKeys.length;

  return (
    <div>
      <div
        className="gauge"
        role="img"
        aria-label={`Compuerta ${gateDone} de ${GATE_REQUIRED.length} campos. Shortlist ${listDone} de ${listKeys.length} campos.`}
      >
        {GATE_REQUIRED.map((key, i) => (
          <span
            key={key}
            className={`gauge-pip ${i < gateDone ? "gauge-pip-on" : ""}`}
          />
        ))}
        <span className="gauge-split" aria-hidden />
        {listKeys.map((key) => (
          <span
            key={key}
            className={`gauge-pip ${resolved(key) ? "gauge-pip-on" : ""}`}
          />
        ))}
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <span className="u-eyebrow">
          Compuerta{" "}
          <span className={gateOpen ? "text-[var(--color-declared)]" : ""}>
            {gateDone}/{GATE_REQUIRED.length}
            {gateOpen ? " · abierta" : ""}
          </span>
        </span>
        <span className="u-eyebrow">
          <span className={listOpen ? "text-[var(--color-declared)]" : ""}>
            {listDone}/{listKeys.length}
            {listOpen ? " · abierto" : ""}
          </span>{" "}
          Shortlist
        </span>
      </div>
    </div>
  );
}
