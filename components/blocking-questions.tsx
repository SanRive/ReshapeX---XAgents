import { FIELD_LABELS } from "@/lib/project-spec";
import type { BlockingQuestion } from "@/lib/turn";
import { CiteStamp } from "./cite";

/**
 * Las preguntas que faltan, con la capa "como consigo este dato".
 *
 * Maximo tres por turno. Cada una sale del FIELD_GUIDE —una tabla estatica
 * escrita a mano y versionada, no improvisacion del modelo— asi que es
 * determinista y citable.
 *
 * El campo `antipatron` es el que hace el trabajo: es el error que la pregunta
 * invita a cometer, dicho antes de que lo cometan. Va destacado porque es la
 * diferencia entre entrevistar y interrogar.
 */
export function BlockingQuestions({
  questions,
}: {
  questions: BlockingQuestion[];
}) {
  if (questions.length === 0) return null;

  return (
    <section className="plate" aria-labelledby="questions-title">
      <div className="plate-head">
        <h3 id="questions-title" className="u-nameplate text-[0.8125rem]">
          Lo que falta
        </h3>
        <span className="u-datum text-[0.6875rem] text-[var(--color-ink-faint)]">
          {questions.length} {questions.length === 1 ? "dato" : "datos"}
        </span>
      </div>

      {questions.map((q) => (
        <article key={q.field} className="fieldcard fieldcard-missing">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-[0.875rem] font-medium">
              {FIELD_LABELS[q.field] ?? q.field}
            </h4>
            <code className="u-datum shrink-0 text-[0.6875rem] text-[var(--color-ink-faint)]">
              {q.field}
            </code>
          </div>

          <dl className="mt-1.5 space-y-1.5 text-[0.8125rem] leading-relaxed">
            <Row term="Para qué" text={q.why} />
            <Row term="Dónde" text={q.where} />
            {q.alternative && <Row term="Alterno" text={q.alternative} />}
          </dl>

          {q.antipattern && (
            <p className="receipt receipt-missing mt-2">
              <strong className="font-medium">No sirve:</strong> {q.antipattern}
            </p>
          )}

          {q.citation && (
            <div className="mt-1.5">
              <CiteStamp citation={q.citation} />
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function Row({ term, text }: { term: string; text: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
      <dt className="u-eyebrow pt-0.5">{term}</dt>
      <dd className="text-[var(--color-ink-muted)]">{text}</dd>
    </div>
  );
}
