import { VERDICT_CHIP, VERDICT_GLYPH, VERDICT_WORD } from "@/lib/format";
import type { FamilyVerdict } from "@/lib/turn";
import { CiteBlock } from "./cite";

/**
 * La compuerta de 4 familias, con el caso negativo argumentado.
 *
 * PSS solo muestra que es viable al final, sin explicar por que no lo demas.
 * Aqui las cuatro familias aparecen siempre —incluidas las descartadas— y cada
 * descarte trae la linea del catalogo que lo sostiene. Es la mitad del valor del
 * producto, asi que ninguna familia se colapsa ni se esconde.
 */
export function GateVerdicts({ verdicts }: { verdicts: FamilyVerdict[] }) {
  const viable = verdicts.filter((v) => v.verdict !== "rejected").length;

  return (
    <section className="plate" aria-labelledby="gate-title">
      <div className="plate-head">
        <h3 id="gate-title" className="u-nameplate text-[0.8125rem]">
          Compuerta de tecnología
        </h3>
        <span className="u-datum text-[0.6875rem] text-[var(--color-ink-faint)]">
          {viable} de {verdicts.length} familias en pie
        </span>
      </div>

      {verdicts.map((v) => (
        <article key={v.family} className={`fieldcard fieldcard-${railFor(v)}`}>
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-[0.875rem] leading-tight font-medium">{v.label}</h4>
            <span className={`chip ${VERDICT_CHIP[v.verdict]} shrink-0`}>
              <span aria-hidden>{VERDICT_GLYPH[v.verdict]}</span>
              {VERDICT_WORD[v.verdict]}
            </span>
          </div>

          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--color-ink-muted)]">
            {v.reason}
          </p>

          {v.citations[0] && <CiteBlock citation={v.citations[0]} />}

          {v.citations.length > 1 && (
            <details className="mt-1">
              <summary className="u-eyebrow cursor-pointer list-none marker:content-none hover:text-[var(--color-water-deep)]">
                + {v.citations.length - 1} cita
                {v.citations.length > 2 ? "s" : ""}
              </summary>
              <div className="mt-1 flex flex-col gap-1.5">
                {v.citations.slice(1).map((c, i) => (
                  <CiteBlock key={i} citation={c} />
                ))}
              </div>
            </details>
          )}
        </article>
      ))}
    </section>
  );
}

/** El riel reusa el lenguaje de la ficha: mismo color, mismo patron, mismo
 *  significado. Confirmado, con reserva, fuera. */
function railFor(v: FamilyVerdict) {
  if (v.verdict === "viable") return "declared";
  if (v.verdict === "conditional") return "inferred";
  return "missing";
}
