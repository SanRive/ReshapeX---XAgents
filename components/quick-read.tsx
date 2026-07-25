import { missingForShortlist, valueOf, type ProjectSpec } from "@/lib/project-spec";
import { FIELD_LABELS, NEMA_LABELS, num } from "@/lib/format";
import type { TurnResult } from "@/lib/turn";

/**
 * LECTURA RÁPIDA — la banda de instrumento que abre el brief.
 *
 * El problema que resuelve: en la vista anterior toda fila pesaba lo mismo, así
 * que «Color RAL 7035» se leía con la misma fuerza que «Capacidad requerida
 * 5 067 Btu/h». Un ingeniero que abre este documento necesita saber en tres
 * segundos cuatro cosas — cuánto calor hay que sacar, cuánta capacidad hace
 * falta, qué rating exige el entorno y qué familia aplica — y solo después leer
 * el detalle campo por campo.
 *
 * Va en antracita, como la cabecera: es bastidor, no dato. Y ninguna cifra sale
 * de aquí sin venir del spec ya validado o del motor de reglas — si no está,
 * se pinta una raya, nunca un valor de relleno.
 */
export function QuickRead({ turn }: { turn: TurnResult }) {
  const { spec } = turn;

  const disipacion = valueOf(spec.total_dissipation_w) as number | undefined;
  const requerido = spec.derived.required_capacity_btuh;
  const nema = spec.derived.nema_required;

  // La familia que la compuerta da por viable. Si hay varias, la primera:
  // el motor las devuelve en orden de recomendación.
  const familia = turn.gate?.find((g) => g.verdict === "viable");
  // El primer candidato no rechazado del shortlist.
  const modelo = turn.shortlist?.candidates[0];

  const faltan = missingForShortlist(spec);

  return (
    <section
      className="plate plate-instrument overflow-hidden rounded-[3px]"
      aria-label="Lectura rápida"
    >
      <div className="band-chrome flex items-baseline justify-between gap-3 px-4 py-2">
        <span className="u-eyebrow">Lectura rápida</span>
        <span className="u-datum text-[0.6875rem] text-[rgba(238,240,236,0.55)]">
          {faltan.length === 0
            ? "sin datos bloqueantes"
            : `${faltan.length} ${faltan.length === 1 ? "dato bloquea" : "datos bloquean"}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-[rgba(255,255,255,0.07)] lg:grid-cols-4">
        <Celda
          rotulo="Disipación total"
          valor={disipacion === undefined ? null : num(disipacion)}
          unidad="W"
          pie={
            spec.total_dissipation_w.status === "declared"
              ? spec.component_list?.length
                ? "suma de lo declarado"
                : "declarada por el cliente"
              : "nunca se estima"
          }
        />
        <Celda
          rotulo="Capacidad requerida"
          valor={requerido === null ? null : num(requerido)}
          unidad="Btu/h"
          pie={
            requerido === null
              ? "necesita la disipación"
              : `${num(spec.derived.required_w ?? 0)} W · margen 10 % citado`
          }
          destacada
        />
        <Celda
          rotulo="Rating exigido"
          valor={nema ? NEMA_LABELS[nema] : null}
          pie={nema ? "derivado de la ubicación" : "necesita la ubicación"}
        />
        <Celda
          rotulo="Tecnología"
          valor={familia ? familia.label.split(/\s[&·]/)[0]! : null}
          pie={
            familia
              ? modelo
                ? `${modelo.model} · ${num(modelo.capacity_btuh[0])}–${num(modelo.capacity_btuh[1])} Btu/h`
                : "shortlist pendiente"
              : "la compuerta necesita 3 datos"
          }
        />
      </div>

      {faltan.length > 0 && (
        <p className="border-t border-[rgba(255,255,255,0.09)] px-4 py-2.5 text-[0.8125rem] leading-snug text-[rgba(238,240,236,0.72)]">
          <span className="u-datum text-[var(--color-inferred-wash)]">Falta por declarar:</span>{" "}
          {faltan.map((k) => FIELD_LABELS[k] ?? k).join(" · ")}
        </p>
      )}
    </section>
  );
}

/**
 * Una celda del instrumento. La cifra manda y la unidad acompaña un escalón por
 * debajo, que es como se lee una hoja de datos y no como se lee un formulario.
 */
function Celda({
  rotulo,
  valor,
  unidad,
  pie,
  destacada = false,
}: {
  rotulo: string;
  valor: string | null;
  unidad?: string;
  pie: string;
  destacada?: boolean;
}) {
  const ausente = valor === null;

  return (
    <div className="bg-[var(--color-anthracite)] px-4 py-3">
      <span
        className={`u-eyebrow block ${ausente ? "text-[rgba(245,231,201,0.62)]" : "text-[rgba(238,240,236,0.5)]"}`}
      >
        {rotulo}
      </span>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className={[
            "u-datum leading-none",
            ausente
              ? "text-[1.375rem] text-[rgba(245,231,201,0.45)]"
              : destacada
                ? "text-[1.625rem] font-medium text-[var(--color-inferred-wash)]"
                : "text-[1.375rem] text-[var(--color-ink-inverse)]",
          ].join(" ")}
        >
          {/* Una raya, nunca un valor de relleno. */}
          {ausente ? "—" : valor}
        </span>
        {!ausente && unidad && (
          <span className="u-datum text-[0.8125rem] text-[rgba(238,240,236,0.6)]">{unidad}</span>
        )}
      </p>
      <span
        className={`mt-1 block text-[0.6875rem] leading-snug ${
          ausente ? "text-[rgba(245,231,201,0.72)]" : "text-[rgba(238,240,236,0.45)]"
        }`}
      >
        {pie}
      </span>
    </div>
  );
}
