"use client";

import { BrandMark } from "./brand-mark";

export type View = "cliente" | "ingeniero";

/**
 * La chapa de datos del equipo.
 *
 * Aluminio anodizado sobre antracita RAL 7016 —el acabado del gabinete que este
 * producto climatiza— con el nombre troquelado en ancho expandido y una rejilla
 * de ventilación cerrando el canto inferior. El toggle de vista es lo único
 * interactivo: una sola ruta, dos roles, sin navegación.
 */
export function SiteHeader({
  view,
  onView,
  briefReady,
}: {
  view: View;
  onView: (v: View) => void;
  briefReady: boolean;
}) {
  return (
    <header className="nameplate-rail shrink-0 text-[var(--color-ink-inverse)]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark className="h-8 w-8 shrink-0 text-[rgba(238,240,236,0.85)]" />
          <div className="min-w-0">
            <p className="u-eyebrow text-[rgba(238,240,236,0.5)]">
              Pfannenberg · thermal management
            </p>
            <h1 className="u-nameplate engraved text-[1.0625rem] leading-none">
              Engineering Copilot
            </h1>
          </div>
        </div>

        <p className="u-datum hidden max-w-[52ch] border-l border-[rgba(238,240,236,0.16)] pl-5 text-[0.6875rem] leading-snug text-[rgba(238,240,236,0.45)] xl:block">
          PSS dimensiona en 5 minutos. Llegar al punto de poder usar PSS toma 3
          días. Automatizamos los 3 días.
        </p>

        <div className="ml-auto flex items-center gap-3">
          <span
            className="u-datum text-[0.625rem] tracking-wider text-[rgba(238,240,236,0.4)]"
            title="La UI corre contra el fixture del caso §5. El endpoint POST /api/turn está definido y pendiente de conectar (I1)."
          >
            fixture
          </span>
          <div className="seg" role="tablist" aria-label="Vista">
            <button
              type="button"
              role="tab"
              aria-selected={view === "cliente"}
              className={`seg-item ${view === "cliente" ? "seg-item-on" : ""}`}
              onClick={() => onView("cliente")}
            >
              Cliente
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "ingeniero"}
              className={`seg-item ${view === "ingeniero" ? "seg-item-on" : ""}`}
              onClick={() => onView("ingeniero")}
            >
              Ingeniero
              {briefReady && (
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-declared)] align-middle"
                  aria-label="brief listo"
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
