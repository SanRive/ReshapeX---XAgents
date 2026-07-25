# Contratos de módulo — lo que falta implementar

La web está construida y corre contra el fixture del caso §5. Este documento es
lo que **falta**, con la firma exacta que cada pista tiene que cumplir para que
la UI no se toque.

**Regla de oro que sigue en pie:** cada tarea es dueña de archivos distintos.
Los tipos ya existen en `lib/project-spec.ts` y `lib/turn.ts` — nadie los
reescribe, todos los importan.

---

## Lo que ya está y funciona

| Qué | Dónde | Verificado |
|---|---|---|
| El contrato Zod `Field` / `ProjectSpec` (T0.2) | `lib/project-spec.ts` | compila |
| Fixtures del caso §5 y del fuera de alcance | `lib/fixtures/` | pintan la UI entera |
| Chat + ficha de tres estados + vista ingeniero (D1–D4) | `app/page.tsx`, `components/` | `npm run build` |
| Generador de brief + descarga .md (D5) | `lib/brief/generate.ts` | descarga |
| Fallback de proveedor con **rotación de claves** (A2) | `lib/llm/providers.ts`, `lib/llm/key-pool.ts` | 14 tests en verde |
| Guardrail de fuera de alcance (I3) | `lib/fixtures/out-of-scope.ts`, `app/api/turn/route.ts` | responde por HTTP |

`POST /api/turn` ya devuelve el guardrail y devuelve **501** para todo lo demás.

---

## Pista A · Extracción y guardrails

### `lib/extract/extract.ts`

```ts
import { ProjectSpecSchema, type ProjectSpec } from "@/lib/project-spec";
import { withProviderFallback } from "@/lib/llm/providers";
import type { ProviderTrace } from "@/lib/turn";

export async function extract(
  message: string,
  current: ProjectSpec,
): Promise<{ raw: ProjectSpec; trace: ProviderTrace }>;
```

Usa `withProviderFallback`, que ya resuelve la cadena y la rotación de claves.
El callback recibe `{ apiKey, config, signal }` y devuelve lo que produzca
`generateObject`; el `trace` que sale es el que la UI pinta debajo del mensaje.

Lanzar `ProviderCallError(message, status)` cuando el proveedor responda mal —
es lo que le dice al pool si quemar la clave o no.

### `lib/extract/validate.ts` — **A4, el que no se cae nunca**

```ts
export function validate(
  raw: ProjectSpec,
  message: string,
): { clean: ProjectSpec; degraded: DecisionEntry[] };
```

Las cuatro reglas, tal como están en `lib/project-spec.ts`:

- `declared` → `evidence` debe ser substring literal del input **normalizando
  espacios y mayúsculas**. Si no → `missing`.
- Campo numérico → los dígitos de `value` deben aparecer en `evidence`. Aquí
  muere el `22 kW → 22000` y el `38 → 380`.
- `inferred` → `basis` debe coincidir con una entrada de la lista blanca
  `DEFAULTS`. Si no → `missing`.
- `missing` → `value` se fuerza a `null`.

Cada degradación devuelve un `DecisionEntry` de `kind: "degraded"`. **Ese log
entra en el brief**: la UI ya lo pinta y es la prueba de que el guardrail actuó.

### `lib/extract/post-check.ts` — A6

```ts
export function postCheck(
  prose: string,
  spec: ProjectSpec,
  toolResults: unknown[],
): { text: string; replaced: boolean };
```

Todo número de la prosa tiene que existir en el spec validado o en un resultado
de tool de ese turno. Si no, se sustituye por la narración plantilla y se marca.
La UI ya lee `ChatMessage.postCheckReplaced` y pinta el aviso.

---

## Pista B · Motor de reglas

### `lib/rules/catalog-data.ts` — B1

Matriz de tecnología (§4.1), tablas DTS/DTI/DTT (§4.3) y las citas textuales
(§4.2), cada entrada con `{ documento, pagina, texto_citado }` — el tipo
`Citation` de `lib/project-spec.ts`.

> Mientras esto no exista, las citas que usa la UI viven en
> `lib/fixtures/citations.ts`. Cuando B publique `catalog-data.ts`, ese archivo
> pasa a re-exportar de allí y deja de ser fuente.

### `lib/rules/gate.ts` — B2

```ts
import type { FamilyVerdict } from "@/lib/turn";
export function gate(spec: ProjectSpec): FamilyVerdict[];
```

Las cuatro familias siempre, **incluido el caso negativo argumentado**. Sin cita
no sale a la UI.

### `lib/rules/shortlist.ts` — B3

```ts
import type { Shortlist } from "@/lib/turn";
export function shortlist(spec: ProjectSpec): Shortlist;
```

Margen del 10 % citado, filtro por capacidad / voltaje / NEMA / montaje, y los
descartes con razón. Regresión gratis: `PD 1350 → 5 067 Btu/h` tiene que dar
DTS 31X5 ⚠, DTS 32X1 ⚠ y tres rechazados — está resuelto a mano en
`lib/fixtures/barranquilla.ts` y ese objeto sirve de caso de prueba tal cual.

### `lib/rules/field-guide.ts` — B5

```ts
import type { BlockingQuestion } from "@/lib/turn";
export const FIELD_GUIDE: Record<string, BlockingQuestion>;
```

Ocho filas. El campo `antipattern` es el que hace el trabajo — ver las tres que
ya están escritas en el fixture.

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

`specs_modelo` es el que cierra el hueco visible del shortlist: la UI ya reserva
`current_a` y `article_no` en `ModelCandidate` y hoy muestra un pie diciendo que
esa cifra la resuelve esta tool.

---

## Integración

### I1/I2 · `app/api/turn/route.ts`

El esqueleto ya está, con el guardrail de fuera de alcance corriendo antes del
LLM. Falta la espina, en este orden fijo:

```
extract → validate → merge → gate → shortlist → loop (maxSteps: 5) → postCheck
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
