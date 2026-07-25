# Contratos de módulo — lo que falta implementar

La web está construida y corre contra los fixtures del contrato. Este documento
es lo que **falta**, con la firma exacta que cada pista tiene que cumplir para
que la UI no se toque.

**El contrato es `lib/project-spec.ts` (T0.2).** Nadie lo reescribe: todos lo
importan. Los tipos salen de `z.infer<>`.

---

## Lo que ya está y funciona

| Qué | Dónde | Verificado |
|---|---|---|
| El contrato Zod, `DEFAULTS`, umbrales y helpers (T0.2) | `lib/project-spec.ts` | 21 tests |
| Fixtures de Barranquilla y del fuera de alcance | `lib/fixtures/` | evidencia comprobada literal |
| Chat + ficha de tres estados + vista ingeniero (D1–D4) | `app/page.tsx`, `components/` | `npm run build` |
| Generador de brief + descarga .md (D5) | `lib/brief/generate.ts` | descarga |
| Fallback de proveedor con **rotación de claves** (A2) | `lib/llm/` | 14 tests |
| Guardrail de fuera de alcance (I3) | `lib/fixtures/out-of-scope.ts`, `app/api/turn/route.ts` | responde por HTTP |

`POST /api/turn` ya devuelve el guardrail y devuelve **501** para todo lo demás.

### Andamio que se borra

`lib/demo/` es de la pista D y **no es parte del contrato**: contiene el estado
del turno 2, los veredictos de la compuerta, el shortlist, las citas del
catálogo y el guion de la demo. Todo eso son salidas de A, B y C simuladas para
que la UI se pueda enseñar hoy. Cuando esas pistas aterricen, la carpeta entera
desaparece.

---

## Cómo se lee un campo

```ts
type AnyField = {
  status: "declared" | "inferred" | "missing";
  value: string | number | boolean | null;
  evidence: string | null;   // substring literal del input · solo si declared
  basis: string | null;      // CLAVE de DEFAULTS   · solo si inferred
};
```

**`basis` es una clave, no un texto.** El texto de la cita sale de
`DEFAULTS[basis].cita`. Eso es lo que impide que el modelo invente una
justificación creíble: si la clave no está en la lista blanca, el validador
degrada el campo. La UI usa `basisCitation()` de `lib/format.ts` para resolverlo.

**No hay campo `blocks`.** Qué traba un campo se deriva de los umbrales
(`GATE_REQUIRED`, `SHORTLIST_REQUIRED`, `missingForShortlist`). El texto legible
vive en `blocksText()` de `lib/format.ts`, que es de la pista D.

**El `decision_log` vive dentro del `ProjectSpec`**, escrito por el validador.
No hay un segundo log: la vista ingeniero pinta ese y solo ese.

---

## Pista A · Extracción y guardrails

### `lib/extract/extract.ts`

```ts
import { ExtractedSpecSchema, type ExtractedSpec } from "@/lib/project-spec";
import { withProviderFallback } from "@/lib/llm/providers";
import type { ProviderTrace } from "@/lib/turn";

export async function extract(
  message: string,
  current: ExtractedSpec,
): Promise<{ raw: ExtractedSpec; trace: ProviderTrace }>;
```

Se le pasa `ExtractedSpecSchema` a `generateObject`, no `ProjectSpecSchema`: el
modelo no debe poder escribir `derived` ni `decision_log`.

`withProviderFallback` ya resuelve la cadena y la rotación de claves. El callback
recibe `{ apiKey, config, signal }`. Lanzar `ProviderCallError(message, status)`
cuando el proveedor responda mal — es lo que le dice al pool si quemar la clave.

### `lib/extract/validate.ts` — **A4, el que no se cae nunca**

```ts
export function validate(
  raw: ExtractedSpec,
  message: string,
): { clean: ExtractedSpec; log: ProjectSpec["decision_log"] };
```

Las cuatro reglas están escritas en el docblock de `field()` en el contrato.
`NUMERIC_FIELD_KEYS` ya lista sobre qué campos corre la regla de los dígitos.

Cada degradación escribe una entrada con `action: "degraded"` y el valor
propuesto en `proposed`. **Eso se ve en pantalla**: la ficha lo pinta debajo del
campo y el brief lo lleva entero. Es la prueba de que el guardrail actuó.

> ### ⚠️ Decisión pendiente: el camino de la suma
>
> Cuando hay `component_list`, `total_dissipation_w` se calcula sumando. El
> resultado (1 350) **no aparece literal en ningún mensaje**, así que la regla de
> los dígitos lo degradaría y el shortlist no saldría nunca.
>
> El contrato ya trae `action: "summed"` en el log, lo que sugiere que el camino
> queda exento — el valor lo escribe código, no el modelo. El fixture del turno 2
> está construido con esa premisa y hay un test que lo deja por escrito:
> `lib/demo/__tests__/fixtures.test.ts` → *"la suma es literal en sus términos,
> no en su resultado"*.
>
> **Si A decide lo contrario, ese test es el que hay que cambiar, y el shortlist
> deja de salir en la demo.** Conviene cerrarlo por voz antes de escribir
> `validate.ts`.

### `lib/extract/post-check.ts` — A6

```ts
export function postCheck(
  prose: string,
  spec: ProjectSpec,
  toolResults: unknown[],
): { text: string; replaced: boolean };
```

La UI ya lee `ChatMessage.postCheckReplaced` y pinta el aviso.

### Derivados

Los calcula código, nunca el modelo:

```ts
required_w              = total_dissipation_w * 1.10   // margen citado, DTS_2017
required_capacity_btuh  = required_w * 3.412           // conversión de unidades
nema_required           ← location                     // PSS Tutorial, Environment
available_mounting_faces ← installation
```

---

## Pista B · Motor de reglas

### `lib/rules/catalog-data.ts` — B1

Matriz de tecnología (§4.1), tablas DTS/DTI/DTT (§4.3) y las citas textuales
(§4.2), cada entrada con `{ documento, pagina, texto_citado }` — el tipo
`Citation` de `lib/turn.ts`.

> Mientras no exista, las citas que usa la UI viven en `lib/demo/citations.ts`.
> Cuando B publique `catalog-data.ts`, ese archivo se borra.
>
> No confundir con `DEFAULTS` del contrato: eso justifica **valores por defecto**
> y `basis` es una clave suya. Esto justifica **veredictos y descartes**.

### `lib/rules/gate.ts` — B2

```ts
import type { FamilyVerdict } from "@/lib/turn";
export function gate(spec: ExtractedSpec): FamilyVerdict[];
```

Las cuatro familias siempre, **incluido el caso negativo argumentado**. Sin cita
no sale a la UI. Precondición: `missingForGate(spec).length === 0`.

### `lib/rules/shortlist.ts` — B3

```ts
import type { Shortlist } from "@/lib/turn";
export function shortlist(spec: ProjectSpec): Shortlist;
```

Lee `spec.derived.required_capacity_btuh`; no recalcula el margen. Devuelve
candidatos y rechazados con razón. Precondición:
`missingForShortlist(spec).length === 0`.

Regresión gratis: `PD 1350 → 5 067 Btu/h` tiene que dar DTS 31X5 ⚠, DTS 32X1 ⚠ y
tres rechazados. Está resuelto a mano en `lib/demo/turns.ts`.

### `lib/rules/field-guide.ts` — B5

```ts
import type { BlockingQuestion } from "@/lib/turn";
export const FIELD_GUIDE: Record<FieldKey, BlockingQuestion>;
```

Ocho filas. El campo `antipattern` es el que hace el trabajo — hay tres escritas
en `lib/demo/turns.ts` que sirven de plantilla.

---

## Pista C · Knowledge tools

**Búsqueda por keywords, no embeddings** (§7.7). Cuatro tools, todas de solo
lectura, sobre los ~30 archivos **en alcance** de `corpus_txt/`. Indexar los 104
mete señalización y chillers en el retrieval y arruina la precisión.

| Tool | Archivo | Devuelve |
|---|---|---|
| `buscar_catalogo(query)` | `lib/tools/search-catalog.ts` | fragmentos con `Citation` |
| `specs_modelo(modelo)` | `lib/tools/model-specs.ts` | capacidad, voltajes, dimensiones, **corriente en A**, artículo |
| `explicar_veredicto(familia)` | `lib/tools/explain.ts` | envuelve a B2 |
| `guia_de_campo(campo)` | `lib/tools/explain.ts` | envuelve a B5 |

El índice va en `lib/tools/corpus-index.ts`, troceado con `{ documento, pagina }`.

`specs_modelo` cierra el hueco visible del shortlist: `ModelCandidate` ya reserva
`current_a` y `article_no`, y la tabla muestra hoy un pie diciendo que esa cifra
la resuelve esta tool.

---

## Integración

### I1/I2 · `app/api/turn/route.ts`

El esqueleto ya está, con el guardrail de fuera de alcance corriendo antes del
LLM. Falta la espina, en este orden fijo:

```
extract → validate → merge → derive → gate → shortlist → loop (maxSteps: 5) → postCheck
```

y devolver un `TurnResult`. **Que lo abra una sola persona.**

### I4 · `app/page.tsx` — **la hace D**

Una sola función cambia. En `runTurn`, sustituir la búsqueda en `DEMO_SCRIPT`
por:

```ts
const res = await fetch("/api/turn", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: input, spec }),
});
const turn: TurnResult = await res.json();
```

Ningún componente de `components/` cambia.

---

## Fuera del alcance de esta entrega, a propósito

- **RAG con embeddings, índice vectorial, base de datos.** Cortado en §7.7 y no
  se reabre: el corpus de reglas son ~11 k tokens.
- **Precios y coste de operación.** Cortado en §3.4 con tres razones verificadas
  contra el corpus.
- **Tests de UI.** No se testean ni la vista ni la calidad de respuesta del LLM.
