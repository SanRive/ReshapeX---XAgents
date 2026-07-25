import type { Citation } from "@/lib/turn";

/**
 * Sin cita no sale a la UI.
 *
 * Dos densidades: `CiteStamp` para cuando la cita acompaña a un dato ya
 * explicado, y `CiteBlock` para cuando la cita ES el argumento — ahi el texto
 * citado va visible, no escondido tras un click. Un juez no deberia tener que
 * hacer hover para ver de donde salio un descarte.
 */

export function CiteStamp({ citation }: { citation: Citation }) {
  return (
    <span
      className="u-datum inline-block text-[0.6875rem] text-[var(--color-ink-faint)]"
      title={citation.texto_citado}
    >
      {citation.documento} · {citation.pagina}
    </span>
  );
}

export function CiteBlock({
  citation,
  tone = "neutral",
}: {
  citation: Citation;
  tone?: "neutral" | "declared" | "inferred" | "missing";
}) {
  const toneClass =
    tone === "neutral" ? "" : ` receipt-${tone}`;

  return (
    <figure className={`receipt${toneClass}`}>
      <blockquote className="italic">«{citation.texto_citado}»</blockquote>
      <figcaption className="mt-1 text-[0.6875rem] not-italic text-[var(--color-ink-faint)]">
        {citation.documento} · {citation.pagina}
      </figcaption>
    </figure>
  );
}

export function CiteList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {citations.map((c, i) => (
        <CiteBlock key={`${c.documento}-${c.pagina}-${i}`} citation={c} />
      ))}
    </div>
  );
}
