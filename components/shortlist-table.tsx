import { num, VERDICT_CHIP, VERDICT_GLYPH, VERDICT_WORD } from "@/lib/format";
import type { ModelCandidate, Shortlist } from "@/lib/turn";
import { CiteStamp } from "./cite";

/**
 * El quick selection chart, que es el artefacto nativo del catalogo.
 *
 * La unica visualizacion de la app: una barra de rango por modelo contra la
 * linea de capacidad requerida. Es la forma correcta porque el dato ES un
 * intervalo —el catalogo publica un rango, no un punto— y verlo cruzar o no
 * cruzar la linea del requerido explica el veredicto sin leer una palabra.
 *
 * Los descartados no se esconden: van en la misma tabla, con la barra en gris y
 * su razon. Enseñar lo que se descarto y por que es la mitad del producto.
 */
export function ShortlistTable({ shortlist }: { shortlist: Shortlist }) {
  const all = [...shortlist.candidates, ...shortlist.rejected];
  const domain = computeDomain(all, shortlist.required_btuh);

  return (
    <section className="plate" aria-labelledby="shortlist-title">
      <div className="plate-head">
        <h3 id="shortlist-title" className="u-nameplate text-[0.8125rem]">
          Shortlist · Cooling Units
        </h3>
        <span className="u-datum text-[0.6875rem] text-[var(--color-ink-faint)]">
          {shortlist.candidates.length} pasan · {shortlist.rejected.length}{" "}
          descartados
        </span>
      </div>

      <div className="border-b border-[var(--color-hairline-soft)] px-3.5 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <Figure label="Disipación declarada" value={`${num(shortlist.total_dissipation_w)} W`} />
          <Figure label="× 1.10 margen" value={`${num(shortlist.required_w)} W`} />
          <Figure
            label="Requerido"
            value={`${num(shortlist.required_btuh)} Btu/h`}
            strong
          />
          <Figure label="Unidades" value={`${shortlist.units_needed}`} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="qs-table min-w-[46rem]">
          <caption className="sr-only">
            Modelos de cooling unit evaluados contra una capacidad requerida de{" "}
            {num(shortlist.required_btuh)} Btu/h.
          </caption>
          <thead>
            <tr>
              <th scope="col">Modelo</th>
              <th scope="col">Capacidad Btu/h</th>
              <th scope="col" className="w-[16rem]">
                <span className="inline-flex items-center gap-1.5">
                  Rango vs requerido
                  <span
                    className="inline-block h-3 w-0.5 bg-[var(--color-anthracite)] align-middle"
                    aria-hidden
                  />
                  <span className="normal-case tracking-normal">
                    {num(shortlist.required_btuh)}
                  </span>
                </span>
              </th>
              <th scope="col">NEMA</th>
              <th scope="col">Alto mm</th>
              <th scope="col">Veredicto</th>
            </tr>
          </thead>
          <tbody>
            {all.map((c) => (
              <ModelRows
                key={c.model}
                candidate={c}
                domain={domain}
                required={shortlist.required_btuh}
              />
            ))}
          </tbody>
        </table>
      </div>

      {shortlist.derating_note && (
        <div className="border-t border-[var(--color-hairline)] bg-[var(--color-inferred-wash)] px-3.5 py-2.5">
          <span className="u-eyebrow text-[#7a4d00]">Base de rating</span>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#7a4d00]">
            {shortlist.derating_note}
          </p>
        </div>
      )}

      <p className="border-t border-[var(--color-hairline-soft)] px-3.5 py-2 text-[0.6875rem] leading-snug text-[var(--color-ink-faint)]">
        Sin precio: Pfannenberg no publica lista y cotiza por distribución. La
        corriente en amperios y el número de artículo por modelo y voltaje sí
        están publicados — los resuelve <code className="u-datum">specs_modelo()</code>{" "}
        sobre <code className="u-datum">Compact_catalogue</code>.
      </p>
    </section>
  );
}

/* ========================================================================== */

function ModelRows({
  candidate,
  domain,
  required,
}: {
  candidate: ModelCandidate;
  domain: [number, number];
  required: number;
}) {
  const rejected = candidate.verdict === "rejected";

  return (
    <>
      <tr className={`qs-pair-top ${rejected ? "qs-rejected" : ""}`}>
        <th scope="row" className="u-datum px-2.5 py-2 text-left font-medium">
          {candidate.model}
        </th>
        <td className="u-datum whitespace-nowrap">
          {num(candidate.capacity_btuh[0])} – {num(candidate.capacity_btuh[1])}
        </td>
        <td>
          <RangeBar
            candidate={candidate}
            domain={domain}
            required={required}
          />
        </td>
        <td className="u-datum whitespace-nowrap">
          {candidate.nema_available.join(" · ")}
        </td>
        <td className="u-datum">
          {candidate.dimensions_mm.h > 0 ? num(candidate.dimensions_mm.h) : "—"}
        </td>
        <td>
          <span className={`chip ${VERDICT_CHIP[candidate.verdict]}`}>
            <span aria-hidden>{VERDICT_GLYPH[candidate.verdict]}</span>
            {VERDICT_WORD[candidate.verdict]}
          </span>
        </td>
      </tr>
      <tr className={rejected ? "qs-rejected" : undefined}>
        <td colSpan={6} className="pt-0 pb-2.5 pl-2.5">
          <p className="max-w-[58ch] text-[0.8125rem] leading-relaxed text-[var(--color-ink-muted)]">
            {candidate.reason}
          </p>
          {candidate.citations.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {candidate.citations.map((c, i) => (
                <CiteStamp key={i} citation={c} />
              ))}
            </div>
          )}
        </td>
      </tr>
    </>
  );
}

function RangeBar({
  candidate,
  domain,
  required,
}: {
  candidate: ModelCandidate;
  domain: [number, number];
  required: number;
}) {
  const [lo, hi] = candidate.capacity_btuh;
  const pct = (v: number) =>
    ((v - domain[0]) / (domain[1] - domain[0])) * 100;

  const fill =
    candidate.verdict === "viable"
      ? "var(--color-declared)"
      : candidate.verdict === "conditional"
        ? "var(--color-inferred)"
        : // Los descartados retroceden, pero el intervalo tiene que leerse: en
          // gris de pista sobre pista gris no se ve donde empieza ni acaba.
          "var(--color-ink-faint)";

  return (
    <div
      className="range-track"
      title={`${candidate.model}: ${num(lo)} – ${num(hi)} Btu/h · requerido ${num(required)} Btu/h`}
    >
      <span
        className="range-fill"
        style={{
          left: `${pct(lo)}%`,
          width: `${Math.max(pct(hi) - pct(lo), 1.5)}%`,
          background: fill,
        }}
      />
      <span className="range-threshold" style={{ left: `${pct(required)}%` }} />
    </div>
  );
}

function Figure({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <span className="u-eyebrow block">{label}</span>
      <span
        className={`u-datum ${strong ? "text-[1.0625rem] font-medium" : "text-[0.9375rem]"}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Dominio comun con holgura. No arranca en cero a proposito: el dato es un
 *  intervalo, no una magnitud medida desde el origen, y anclar en cero
 *  aplastaria todas las barras contra el borde derecho. Los dos extremos y la
 *  linea de requerido van rotulados, asi que la escala es legible. */
function computeDomain(
  candidates: ModelCandidate[],
  required: number,
): [number, number] {
  const lows = candidates.map((c) => c.capacity_btuh[0]);
  const highs = candidates.map((c) => c.capacity_btuh[1]);
  const min = Math.min(...lows, required);
  const max = Math.max(...highs, required);
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}
