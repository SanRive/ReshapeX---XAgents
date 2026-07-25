/**
 * La marca del producto.
 *
 * ⚠️ NO es el logotipo de Pfannenberg. En el repo no hay ningún archivo de marca
 * —ni en `corpus_txt/` ni en la documentación, que son solo PDFs de texto— y
 * dibujar de memoria algo que se hiciera pasar por el logotipo de una empresa
 * real sería inventarlo. Esto es la marca de la herramienta: un gabinete visto
 * de frente, con sus lamas de ventilación y la unidad montada en el lateral,
 * que es exactamente lo que hace la app.
 *
 * PARA PONER EL LOGOTIPO REAL, si el equipo tiene derecho a usarlo:
 * dejar el SVG en `public/brand-logo.svg` y cambiar el cuerpo de este
 * componente por
 *
 *   <img src="/brand-logo.svg" alt="Pfannenberg" className={className} />
 *
 * No hace falta tocar nada más: `SiteHeader` solo llama a `<BrandMark />`.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Engineering Copilot"
    >
      <defs>
        <linearGradient id="bm-iron" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-iron-1)" />
          <stop offset="55%" stopColor="var(--color-iron-3)" />
          <stop offset="100%" stopColor="var(--color-iron-5)" />
        </linearGradient>
      </defs>

      {/* El gabinete */}
      <rect
        x="3.5"
        y="3.5"
        width="21"
        height="25"
        rx="1.5"
        fill="rgba(255,255,255,0.06)"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Las lamas: aire que entra, aire que sale */}
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.75">
        <line x1="8" y1="10" x2="20" y2="10" />
        <line x1="8" y1="14" x2="20" y2="14" />
        <line x1="8" y1="18" x2="16" y2="18" />
      </g>

      {/* La unidad de refrigeración, montada al lateral — serie DTS = side mount */}
      <rect x="24" y="9" width="5" height="14" rx="1" fill="url(#bm-iron)" />
    </svg>
  );
}
