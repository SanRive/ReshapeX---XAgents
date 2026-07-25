# Plan de implementación — reparto para 4 personas

Derivado de la §7 del spec. **Regla de oro: cada tarea es dueña de archivos distintos.**
Si dos personas nunca abren el mismo fichero, no hay conflicto de merge que resolver.

Cada quien elige tareas de su pista. Al terminar una, se marca y se coge la siguiente.

---

## T0 · Lo que bloquea a los demás — primeros 15 minutos

Estas dos van antes que todo. Que las coja quien esté libre; son rápidas.

| # | Tarea | Archivos | Desbloquea |
|---|---|---|---|
| **T0.1** | Scaffold `create-next-app` + TypeScript + shadcn/ui. Nada de features. | raíz del proyecto | a todos |
| **T0.2** | **El contrato.** `Field` y `ProjectSpec` (§3.5) **escritos en Zod**, con los tipos TS derivados por `z.infer<>`. Más los dos fixtures (Barranquilla de §5 y el fuera de alcance). | `lib/project-spec.ts`<br>`lib/fixtures/*.ts` | pistas A y D |

> **En Zod, no en `interface`.** Si el contrato se escribe como tipo TS y luego A lo
> reescribe en Zod para `generateObject`, hay dos definiciones que se desincronizan sola.
> Una sola fuente: el schema Zod, y `type ProjectSpec = z.infer<typeof ProjectSpecSchema>`.

> **T0.2 es el contrato entre los cuatro.** Quien lo escriba, lo commitea y avisa por voz.
> Si A y D no coinciden en la forma del objeto, se pierde media hora en el merge.

---

## Pista B · Motor de reglas — arranca ya, sin red y sin key

Es la pista que más pesa en el checklist técnico y la única que no depende de nada.

| # | Tarea | Archivos | Hecho cuando |
|---|---|---|---|
| **B1** | Transcribir a mano los datos curados del catálogo: matriz de tecnología (§4.1), tablas DTS/DTI/DTT (§4.3), y las citas textuales (§4.2). Cada entrada con `{documento, página, texto_citado}`. | `lib/rules/catalog-data.ts` | los datos de §4.1 y §4.3 están en TS y compilan |
| **B2** | Compuerta de 4 familias. Entra `ProjectSpec`, sale un veredicto por familia con su cita — **incluido el caso negativo argumentado**. | `lib/rules/gate.ts` | los 4 veredictos del caso §5 salen correctos |
| **B3** | Shortlist de Cooling Units: margen del 10% citado, filtro por capacidad / voltaje / NEMA / montaje, y descartes con razón (DTT no tiene washdown). | `lib/rules/shortlist.ts` | `PD 1350 → 5067 Btu/h` da DTS 31X5 ⚠ y los 3 rechazados |
| **B4** | Tests de B2 y B3. El caso de §5 es regresión gratis: ya está resuelto a mano en el spec. | `lib/rules/__tests__/` | `npm test` pasa en verde |
| **B5** | `FIELD_GUIDE`: 8 filas, una por campo bloqueante, con `por_qué · dónde · alterno · cita · antipatrón` (§3.7). | `lib/rules/field-guide.ts` | las 8 filas escritas |

---

## Pista C · Knowledge tools — arranca ya, sin key

| # | Tarea | Archivos | Hecho cuando |
|---|---|---|---|
| **C1** | Cargar los ~30 archivos **en alcance** de `corpus_txt/` y trocearlos con `{documento, página}`. **No indexar los 104**: mete señalización y chillers en el retrieval y arruina la precisión. | `lib/tools/corpus-index.ts` | devuelve chunks con su procedencia |
| **C2** | `buscar_catalogo(query)` — búsqueda por keywords con ranking. Sin embeddings (§7.7). | `lib/tools/search-catalog.ts` | una consulta devuelve fragmentos con cita |
| **C3** | `specs_modelo(modelo)` — capacidad, voltajes, dimensiones, **corriente en A** y número de artículo, desde `Compact_catalogue` y `Flyer_X_Series_PSA`. | `lib/tools/model-specs.ts` | DTS 31X5 devuelve sus specs citadas |
| **C4** | `explicar_veredicto(familia)` y `guia_de_campo(campo)`. Envuelven a B2 y B5 como tools. | `lib/tools/explain.ts` | ambas devuelven texto con cita |

---

## Pista A · Extracción y guardrails — necesita T0.2 y la key

| # | Tarea | Archivos | Hecho cuando |
|---|---|---|---|
| **A1** | *Absorbida por T0.2* — el schema Zod ya es el contrato. A arranca directo en A2. | — | — |
| **A2** | Fallback de proveedor: `groq-1 → groq-2 → mistral-1 → mistral-2`, timeout 20-25 s, cero reintentos internos, y **devolver qué proveedor respondió** para pintarlo en la UI. | `lib/extract/providers.ts` | matando la primera key, cae a la segunda |
| **A3** | `extract(msg, spec)` con `generateObject`. | `lib/extract/extract.ts` | el correo de Barranquilla devuelve sobres |
| **A4** | **Validador de sobres.** `declared` → evidencia substring literal **normalizando espacios y mayúsculas**; numéricos → los dígitos de `value` en la evidencia; `inferred` → `basis` en la lista blanca; si no → `missing`. | `lib/extract/validate.ts` | los 9 casos del test pasan |
| **A5** | Tests de A4. Los nueve casos ya están verificados en `tools/smoke_test_providers.py` — se portan tal cual. | `lib/extract/__tests__/` | pasan cita-con-salto-de-línea y cita-corta; se cazan 22 kW→22000, 38→380, declared-sin-evidencia, evidencia inventada, dígitos ausentes, valor pelado y payload no-dict |
| **A6** | Post-check numérico sobre la prosa del modelo + su test. | `lib/extract/post-check.ts` | un número inventado se bloquea |

---

## Pista D · UI — necesita T0.2, trabaja contra el fixture

**Arranca contra `lib/fixtures/barranquilla.ts` sin esperar a que A funcione.**

| # | Tarea | Archivos | Hecho cuando |
|---|---|---|---|
| **D1** | Layout de dos columnas: chat a la izquierda, ficha a la derecha. | `app/page.tsx` | se ve la rejilla |
| **D2** | **La ficha de tres estados.** ✅ declarado con su fragmento · ⚠️ inferido con su cita · ❌ faltante con la decisión que traba. Es el protagonista de la demo. | `components/ficha.tsx` | pinta el fixture entero |
| **D3** | Chat: burbujas, input, y el indicador de **qué proveedor respondió**. | `components/chat.tsx` | conversación fake se ve bien |
| **D4** | Vista ingeniero + toggle: brief, shortlist con rechazados, log de decisiones, *"lo que no afirmamos"*. | `components/engineer-view.tsx` | el toggle cambia de vista |
| **D5** | Generador del brief + descarga en markdown. | `lib/brief/generate.ts` | descarga un .md completo |

---

## Integración — al final, una sola persona

| # | Tarea | Archivos | Depende de |
|---|---|---|---|
| **I1** | `POST /api/turn`: orquesta espina (extract → validate → merge → gate → shortlist) → loop → post-check. | `app/api/turn/route.ts` | A, B |
| **I2** | Registrar las 4 tools en `generateText` con `maxSteps: 5`. | `app/api/turn/route.ts` | C, I1 |
| **I3** | Guardrail de fuera de alcance por keywords, **antes** de llamar al LLM. | `app/api/turn/route.ts` | I1 |
| **I4** | Conectar la UI al endpoint real y quitar el fixture. **La hace D**, no quien integra — `app/page.tsx` es de D y nadie más debe abrirlo. | `app/page.tsx` | D, I1 |

> `route.ts` es el único archivo que toca el trabajo de todos. **Que lo abra una sola
> persona.** Es el punto de integración y el sitio donde se pierden las horas.
>
> Y el reparto solo aguanta si se respeta al revés también: quien integra **no** edita
> `page.tsx` ni los componentes para "arreglar" algo rápido. Se lo dice a D.

---

## Orden de arranque

```
T0.1 scaffold ─┐
T0.2 contrato ─┴─▶ A1..A6   ┐
                   D1..D5   ├─▶ I1..I4 ─▶ demo
B1..B5 ──────────────────── │
C1..C4 ──────────────────── ┘
```

**B y C no esperan a nadie.** Si el wifi del venue está mal, esas dos pistas ya están
produciendo mientras A y D esperan.

## Si el tiempo aprieta, se cae en este orden

1. D4 (vista ingeniero) → el brief se descarga en markdown y se enseña el .md
2. C3 (`specs_modelo`) → el shortlist ya trae capacidad y voltaje de B1
3. C4 → el modelo narra los veredictos que ya vienen de B2
4. A6 (post-check) → riesgo asumido, pero **A4 no se toca jamás**

**Nunca se caen:** la ficha de tres estados (D2), el validador (A4), la compuerta con
caso negativo citado (B2) y la sección *"lo que no afirmamos"*.
