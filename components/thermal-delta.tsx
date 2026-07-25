import { isSatisfied, type ProjectSpec } from "@/lib/project-spec";
import { num } from "@/lib/format";

/**
 * EL DELTA TÉRMICO — la regla de la compuerta, dibujada.
 *
 * El catálogo lo dice en una frase: *"If the ambient temperature is greater than
 * the target internal temperature of the enclosure, active cooling is required."*
 * Esto es esa frase en forma de imagen. Dos marcas sobre la rampa de un
 * termógrafo y la banda rayada entre ellas: se ve por qué el filterfan no sirve
 * antes de leer el veredicto.
 *
 * Por qué la rampa de termógrafo y no un degradado cualquiera: el tercer camino
 * de carga térmica que reconoce PSS es *"calculate dissipation based on recorded
 * temperature"*, es decir una medición de campo. El instrumento de esa medición
 * es la cámara termográfica, y ese es su vocabulario cromático.
 *
 * No calcula ingeniería: resta dos números que ya están en el spec, igual que
 * `required_capacity_btuh` convierte unidades. Si falta cualquiera de los dos,
 * no se pinta nada — nunca se supone una temperatura.
 */

/** Rango de las curvas de performance del datasheet (§4.2.b). */
const SCALE_MIN = 20;
const SCALE_MAX = 55;

const pct = (c: number) =>
  ((Math.min(Math.max(c, SCALE_MIN), SCALE_MAX) - SCALE_MIN) /
    (SCALE_MAX - SCALE_MIN)) *
  100;

export function ThermalDelta({ spec }: { spec: ProjectSpec }) {
  const ambientField = spec.ambient_temp_max_c;
  const internalField = spec.internal_temp_max_c;

  if (!isSatisfied(ambientField) || !isSatisfied(internalField)) return null;
  if (typeof ambientField.value !== "number") return null;
  if (typeof internalField.value !== "number") return null;

  const ambient = ambientField.value;
  const internal = internalField.value;
  const delta = ambient - internal;
  const needsActive = delta > 0;

  const lo = Math.min(ambient, internal);
  const hi = Math.max(ambient, internal);

  return (
    <section
      className="border-b border-[var(--color-hairline)] bg-[var(--color-panel)] px-3.5 pt-3 pb-3"
      aria-labelledby="delta-title"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="delta-title" className="u-eyebrow text-[var(--color-ink-muted)]">
          Delta térmico
        </h3>
        <span className="u-datum text-[0.6875rem] text-[var(--color-ink-faint)]">
          derivado
        </span>
      </div>

      <p className="mt-1.5 mb-6">
        <span
          className={`datum-hero ${needsActive ? "text-[var(--color-iron-3)]" : "text-[var(--color-declared)]"}`}
        >
          {needsActive ? "+" : "−"}
          {num(Math.abs(delta))}
        </span>{" "}
        <span className="datum-unit">°C sobre el objetivo interno</span>
      </p>

      <div className="relative mx-1">
        <div
          className="thermal-scale"
          role="img"
          aria-label={`Escala de ${SCALE_MIN} a ${SCALE_MAX} grados. Objetivo interno ${internal}, ambiente máximo ${ambient}.`}
        >
          {needsActive && (
            <span
              className="thermal-gap"
              style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
            />
          )}
          <span className="thermal-mark" style={{ left: `${pct(internal)}%` }} />
          <span className="thermal-mark" style={{ left: `${pct(ambient)}%` }} />

          <span className="thermal-flag" style={{ left: `${pct(internal)}%` }}>
            {num(internal)} interno
          </span>
          <span
            className="thermal-flag"
            style={{ left: `${pct(ambient)}%`, top: "1rem" }}
          >
            {num(ambient)} ambiente
          </span>
        </div>

        <div className="mt-7 flex justify-between">
          <span className="u-datum text-[0.625rem] text-[var(--color-ink-faint)]">
            {SCALE_MIN} °C
          </span>
          <span className="u-datum text-[0.625rem] text-[var(--color-ink-faint)]">
            {SCALE_MAX} °C
          </span>
        </div>
      </div>

      <p className="mt-1 text-[var(--text-micro)] leading-snug text-[var(--color-ink-muted)]">
        {needsActive ? (
          <>
            El ambiente supera el objetivo interno, así que hace falta{" "}
            <strong className="font-medium">enfriamiento activo</strong>. Ningún
            equipo que mueva aire exterior puede bajar de la línea de ambiente.
          </>
        ) : (
          <>
            El ambiente queda por debajo del objetivo interno: la ventilación
            forzada entra en juego y el catálogo la llama la solución económica.
          </>
        )}
      </p>
    </section>
  );
}
