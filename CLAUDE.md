# Engineering Copilot Pfannenberg

Agente para la hackathon **AgentSprint** (EAFIT Medellín, 2026-07-25).

**Flujo: cliente → ingeniero.** El cliente **conversa** con el agente; el agente entrevista,
le enseña dónde encontrar cada dato que falta, y cuando cierra los umbrales emite un
**brief técnico listo para PSS** (Pfannenberg Sizing Software) para el ingeniero de
aplicación, con pre-selección de tecnología justificada y citada.

**PSS dimensiona en 5 minutos. Llegar al punto de poder usar PSS toma 3 días. Automatizamos los 3 días.**

**Presupuesto real de construcción: ~2 h 00 – 2 h 30.** El evento son 4 h de reloj, de las
que el organizador declara *"roughly 3 to 3:30 of real build time"*, menos 25 min de
*lock the idea* y ~35 min de demo. La cifra de "~3.5 h" que circulaba era el bloque de
reloj, no el tiempo de construcción.

| Documento | Qué es |
|---|---|
| `docs/superpowers/specs/2026-07-24-…-design.md` | **La fuente de verdad.** Diseño completo con todas las citas. Si algo aquí lo contradice, gana el spec. La §7 es el agente conversacional y manda sobre §3.1–§3.3. |
| `docs/plan-de-implementacion.md` | El reparto en tareas elegibles, con dueño de archivos por tarea. |

---

## Las tres reglas que no se rompen

**1 · El agente nunca inventa un valor numérico.**
Todo valor que sobrevive al pipeline está o citado textualmente de la entrada, o viene de un default documentado en la lista blanca. En particular: **nunca derivar la disipación térmica (W) de la potencia nominal de un motor o variador (kW).** Son magnitudes distintas. Si no está declarada, el campo es `missing`.

**2 · Las reglas de ingeniería van fuera del LLM.**
La compuerta de tecnología y el filtro de producto son TypeScript puro sobre datos curados a mano desde el catálogo, con cita de página. El LLM extrae y redacta; **no decide**.

En el chat esto se implementa como **loop de solo lectura**: las cuatro herramientas del
agente solo consultan, ninguna escribe. El modelo toca el estado exactamente una vez —el
paso `extract`, con schema fijo, invocado por código— y el validador es el guardia de esa
puerta. **El brief lo ensambla código** desde datos ya validados.

*Consecuencia aceptada:* el agente no improvisa. Fuera de sus cuatro tools, la respuesta
correcta es *"eso lo ve el ingeniero"*.

**3 · No reemplazamos PSS.**
El dimensionamiento certificado — carga solar, material, superficie efectiva, curvas de derating — es de PSS. Nosotros entregamos el brief que lo alimenta más una pre-selección. Cada salida lleva una sección explícita de *"lo que no afirmamos"*.

---

## Arquitectura — 5 componentes

| # | Componente | Naturaleza |
|---|---|---|
| 1 | Extracción estructurada | LLM con schema: texto libre → `ProjectSpec` tipado |
| 2 | **Motor de reglas** | TypeScript puro, sin LLM. Compuerta de tecnología + filtro de producto. Devuelve citas. |
| 3 | Knowledge tool sobre el corpus | **Búsqueda por keywords**, no embeddings. Ver "Stack". |
| 4 | **Guardrails** | Validador determinista de evidencia + post-check numérico sobre la prosa + detección de vacíos + bloqueo de fuera de alcance |
| 5 | Generador de artefacto | Brief PSS-ready con log de decisiones trazable |

El scoring del evento premia componentes que **demostrablemente funcionan**. Nombrar uno en un comentario no cuenta.

### Cómo puntúa el evento — y qué implica

| Dimensión | Peso | Qué la mueve |
|---|---|---|
| **Innovación** | **30%** | *"a use case, flow, or experience others wouldn't have thought of"* |
| **Progreso** | **30%** | Objetivo, 4 escalones acumulativos. **3 = demo en vivo · 4 = todo fundamentado por knowledge tools** |
| Checklist técnico | 20% | 5 componentes que demostrablemente funcionen |
| Presentación | 10% | Narrativa clara, respuestas que aguanten |
| Calidad de código | 10% | Revisión directa del repo. Mockear mucho topa la nota. |

**Dos consecuencias que hay que tener presentes:**

1. **Innovación pesa 30%, más que el checklist técnico.** El rigor del validador es
   defendible como innovación, pero solo si se **presenta** como tal. Un chat es lo que
   va a entregar todo el mundo; un chat donde ves la extracción resolverse campo por campo
   con su cita, y la compuerta disparando antes de preguntar por la carga térmica, no.
2. **Sin demo clickeable te quedas en el escalón 2 de 4** de una dimensión objetiva del 30%.
   La UI vale más de lo que parece. *(Esto corrige la regla anterior de "si la UI se come
   el tiempo, el motor gana": el motor sigue siendo prioritario, pero una demo que no se
   puede enseñar cuesta un escalón entero.)*

### El validador de evidencia (componente 4) — el corazón del diseño

Cada campo extraído es un sobre:

```python
class Field(BaseModel):
    status:   Literal["declared", "inferred", "missing"]
    value:    float | str | None
    evidence: str | None   # substring LITERAL del input, solo si declared
    basis:    str | None   # cita del catálogo, solo si inferred
```

Después de cada llamada al LLM, **código determinista**:

- `declared` → `evidence` debe ser substring literal del input (normalizando espacios y mayúsculas). Si no → degradar a `missing`.
- Campos numéricos → los dígitos de `value` deben aparecer en `evidence`. Caza el `38 °C → 380`.
- `inferred` → `basis` debe coincidir con una entrada de la tabla blanca `DEFAULTS`. Si no → `missing`.
- `missing` → `value` se fuerza a `None`.

**Consecuencia: el modelo no puede meter un número sin fundamento aunque quiera.** Esto vuelve el plan independiente de la calidad del modelo, y es testeable — escribir tests de esto sube el puntaje de código.

La ficha de tres estados de la UI **es** la salida del validador. El guardrail es la pantalla principal, no plomería invisible.

---

## Hechos del dominio — ya verificados, no volver a derivar

Con cita. Todo esto salió del corpus y está en el spec con más detalle.

**Compuerta de tecnología** — `Thermal_Management_Catalog_12_Page-Final_2024`, matriz p.2:

| Condición | Familia |
|---|---|
| Ambiente fresco + limpio/poco sucio | Filterfan 4.0 + Exhaust Filters |
| Ambiente fresco + sucio | PKS Air/Air HX |
| Ambiente alto + limpio o sucio | DTS Cooling Units |
| Ambiente alto y/o muy hostil, sucio | PWS Air/Water HX |

- **Regla de cooling activo** (cat. NA p.6): *"If the ambient temperature is greater than the target internal temperature of the enclosure, active cooling is required."*
- **Regla de lazo cerrado** (cat. NA p.6): *"If a NEMA Type 12/3R/4/4x rating is required — closed loop systems can maintain the NEMA Type rating of the cabinet."* → un filterfan rompe el rating.
- **Margen obligatorio del 10%** (`DTS_2017`): *"The refrigeration capacity should exceed the dissipation loss from the installed components by approximately 10%."* → `required_w = total_dissipation_w * 1.10`
- **Base de rating DIN 35/35** (`DTS_2017`): *"Pfannenberg utilizes the DIN standard 35/35 °C when rating our cooling units. Many other companies use 50/50 °C, which provides a higher, non-usable value."* → si el punto de operación es más severo que 35/35, la capacidad útil real está **por debajo** de la nominal.
- **El rango de capacidad del quick selection chart varía por voltaje y configuración**, no por temperatura (nota del propio catálogo: *"Cooling capacity may vary between voltage and configurations"*). La dependencia con la temperatura está en las curvas de performance, que en el PDF son **imágenes** → se citan, no se leen.
- **Fórmula documentada** (`DTS_2017`): `PC = PD − PR`, con `PR = C × A × ΔT`. **No la implementamos**: requiere el coeficiente de transmisión y la superficie efectiva, que es justo lo que PSS resuelve. La citamos para explicar el límite.
- **Mapeo de rating** (PSS Tutorial): Indoor → NEMA Type 12 · Outdoor → 3R/4 · Washdown → 4/4X.
- **Series y montaje**: `DTS` = side · `DTI` = integrado/recessed · `DTT` = top. **DTT figura solo como Type 12** — no tiene variante washdown documentada. Es una regla de descarte real.

---

## Alcance

**Dentro:** thermal management · compuerta de 4 familias · shortlist detallado solo de Cooling Units · un gabinete por análisis · entrada de texto en español o inglés · salida en pantalla + markdown · **corriente en amperios por modelo**, que sí está publicada con número de artículo.

**Fuera:** estimar carga térmica no declarada *(si dan lista de componentes con W, se **suman** — suma, no estimación)* · chillers · señalización · calefacción · alarmas · persistencia y login · OCR · integración real con PSS *(no hay API; el brief es el handoff)*.

**Precios y coste de operación: fuera, verificado contra el corpus.** Tres razones, cualquiera bastaría:

1. **No hay precios de lista** en los 104 documentos. Pfannenberg cotiza por distribución.
2. **La tarifa eléctrica es local.** El catálogo NA trae coste operativo a `$0.12/kWh`, tarifa de EE. UU. Aplicarla a una planta colombiana es meter un número de otro país y presentarlo como del cliente — el mismo error que derivar watts de kW, y peor, porque parece una cuenta legítima.
3. **Tampoco hay consumo por modelo.** Para cooling units el catálogo publica **corriente en A**, no potencia; convertir A→kW exige el factor de potencia, que no está publicado.

En la demo se dice de frente: *"precios de lista no se publican, y el coste de operación depende de una tarifa local que no conocemos; lo que damos es la corriente de cada modelo, citada."* Aguanta mejor una pregunta que una cuenta con una tarifa prestada.

Si una idea nueva no cabe en esta lista, **no entra hoy.** El riesgo número uno de la hackathon es construir de más.

---

## Datos y rutas

| Ruta | Qué es |
|---|---|
| `corpus_txt/` | Corpus completo extraído a texto. 104 documentos, ~1.48 M tokens. Espeja la estructura original. |
| `corpus_txt/MANIFEST.md` | Tabla de los 104 archivos con páginas, caracteres y estado. Ningún PDF es solo-imagen: no hace falta OCR. |
| `docs/superpowers/specs/…-design.md` | El spec. Fuente de verdad. |
| `docs/plan-de-implementacion.md` | El reparto en tareas elegibles, con dueño de archivos. |
| `tools/smoke_test_providers.py` | Verificación de proveedores LLM, incluido el test de abstención. **Ignorado por git** mientras tenga las keys en claro — ver "Convenciones". |

**Solo indexar el subconjunto en alcance** (~30 archivos, ~496 k tokens): thermal management, cooling units, filterfans, heat exchangers, PSS tutorial, compact catalogue. Indexar los 1.48 M completos mete señalización y chillers en el retrieval y **arruina la precisión** — un juez puede provocar ese fallo con una sola pregunta.

**Fuente de las reglas: solo ~11 k tokens** — `Thermal_Management_Catalog_12_Page-Final_2024.txt` (38 k chars) + `PSS Tutorial/PSS-Tutorial.txt` (6.8 k chars). Caben enteros en contexto. De ahí se transcriben a mano los datos curados del componente 2.

---

## Stack — decidido

**Next.js + TypeScript, todo en un solo proceso.** La app entera vive en el proyecto Next: UI, extracción, motor de reglas y retrieval. Sin backend Python separado.

| Capa | Elección |
|---|---|
| UI | Next.js App Router, **una sola ruta**, sin routing. Dos vistas —cliente e ingeniero— con un toggle. |
| Componentes | **shadcn/ui** — no escribir CSS a mano, es el mayor ahorro de tiempo disponible |
| Extracción | **Vercel AI SDK** con `generateObject` + esquemas **Zod** |
| Loop del agente | `generateText` con tools + `maxSteps: 5`. Cuatro tools, **todas de solo lectura**. |
| Motor de reglas | TypeScript puro, sin dependencias |
| Retrieval | **Búsqueda por keywords** sobre los ~30 archivos en alcance *(ver abajo)* |
| Tooling | `tools/` sigue siendo Python — es preparación, no la app |

**Por qué todo en TypeScript:** un backend Python separado añade dos procesos, CORS y un contrato entre ambos. Ese impuesto de integración se paga *encima* del costo de construir la UI en React. Con 3.5 horas, un solo lenguaje y un solo proceso.

**Zod encaja perfecto con nuestro sobre por campo.** `generateObject` fuerza el esquema en la llamada y devuelve el objeto ya validado — es exactamente el contrato que necesita el componente 1, y el validador de evidencia corre después, sobre el objeto ya tipado.

**Retrieval sin embeddings y sin base de datos.** La fuente de las reglas son ~11 k tokens y cabe entera en contexto; el subconjunto en alcance son ~30 archivos. Búsqueda por keywords con ranking sobre esos archivos: cero infraestructura, cero llamadas de embedding, funciona sin red, y **sigue siendo un knowledge tool de verdad** — que es lo que puntúa. El índice vectorial compraba muy poco por lo que costaba.

**Riesgo asumido conscientemente:** la UI en React cuesta bastante más que en Streamlit, y ese tiempo sale de los componentes que puntúan. Mitigación: shadcn/ui, **una sola ruta**, y la persona D arranca contra un fixture fijo de `ProjectSpec` sin esperar a nadie. Si a mitad del sprint la UI se está comiendo el tiempo del motor de reglas, **el motor gana en profundidad — pero la demo tiene que existir**: sin algo clickeable te quedas en el escalón 2 de 4 de Progreso, que es un 30% objetivo. El corte correcto es simplificar la UI, no dejarla sin terminar.

---

## Convenciones de código

- **Secretos:** `.env.local` para Next (y `.env` para las tools de Python), ambos ya en `.gitignore`. `.env.example` con los nombres sin valores. Ninguna key en el código de la app ni en un mensaje de commit. Si una key entra al historial de git, **hay que rotarla** — borrar el archivo no la saca del historial, que es justo lo que los jueces leen.

  **Excepción temporal, consciente y acotada:** `tools/smoke_test_providers.py` tiene hoy un bloque `DEV_KEYS` con las keys en claro, para poder correrlo sin `.env`. **Por eso ese archivo está en `.gitignore`.** Al pasar a `.env` hay que borrar el bloque, quitar la línea del `.gitignore` y versionarlo — es la herramienta que demuestra el test de abstención y suma en la revisión de código. **La app nunca lleva keys en el código.**
- **Las keys nunca llegan al cliente.** Toda llamada al LLM pasa por un route handler del servidor. Nada de `NEXT_PUBLIC_` para una API key. Esto es parte del *"proper secrets management"* que puntúa.
- **Proveedores LLM — verificados en vivo el 2026-07-25** con `tools/smoke_test_providers.py`. Los cuatro pasan los 4 tests, incluido el de abstención, y los cuatro soportan `json_schema`, que es lo que emite `generateObject`.

  | Orden de fallback | Modelo | Latencia |
  |---|---|---|
  | groq-1 → groq-2 | `openai/gpt-oss-120b` | ~1.8 s |
  | mistral-1 → mistral-2 | `mistral-medium-3.5` | ~3.3 s |

  **`openai/gpt-oss-120b` es el único modelo de Groq que acepta `json_schema`.** `llama-3.3-70b` y `llama-3.1-8b` solo hacen `json_object`; `qwen/qwen3.6-27b` no hace ninguno de los dos — razona dentro de la salida y rompe el JSON. **No cambiar ese modelo sin volver a correr el smoke test.**

  **Sin LangChain ni frameworks de agentes** — la guía del evento avisa que un framework que hay que aprender durante la hackathon cuesta más tiempo del que ahorra.
- **El fallback es visible, no silencioso:** la UI muestra qué proveedor respondió.
- **Timeout duro por proveedor (~20-25 s) y tope de reintentos.** Una demo colgada es peor que una demo degradada.
- **Citas:** toda salida del motor de reglas lleva `{documento, página, texto_citado}`. Sin cita no sale a la UI.
- **Commits:** pequeños y descriptivos. Los jueces leen el historial (10% de la nota). El material de preparación previo al evento va en commits claramente etiquetados como tal.
- Ejecutar los tests del motor de reglas antes de cada commit que lo toque. Es el componente que más pesa y el más fácil de romper en silencio.

---

## Reparto del equipo (4 personas)

**El reparto en tareas elegibles está en `docs/plan-de-implementacion.md`.** Aquí solo las pistas y lo que bloquea a quién.

| | Pista | Bloqueado por |
|---|---|---|
| A | Extracción + validador + post-check + fallback (1, 4) | el contrato · API key |
| B | **Motor de reglas + datos curados (2)** | **nada** — TypeScript puro, arranca sin red |
| C | Knowledge tools sobre el corpus (3) | **nada** — sin key, ya no hay embeddings |
| D | Chat + ficha viva + vista ingeniero + brief (5) | el contrato — luego trabaja contra un fixture |

B y C no dependen de red ni de claves: si el wifi del venue está mal a las 8 AM, la mitad del equipo ya está produciendo.

**Regla que evita los merges:** cada tarea declara **qué archivos posee**. Si dos personas nunca abren el mismo fichero, no hay conflicto. `app/api/turn/route.ts` es el único punto de integración — **que lo abra una sola persona**, y quien integra no toca `page.tsx` ni los componentes ni para arreglar algo rápido.

**Lo primero que hay que acordar, antes de escribir código:** `ProjectSpec` y su fixture. Es el contrato entre los cuatro. **Se escribe en Zod**, y los tipos TS salen de `z.infer<>` — si se escribe como `interface` y luego A lo reescribe en Zod para `generateObject`, hay dos definiciones que se desincronizan solas. Quien lo escriba, lo commitea y avisa por voz.

**Quien vaya a hacer la UI: mirar shadcn/ui esta noche.** Es donde está el ahorro de tiempo, y no se improvisa a las 8 AM.

---

## Antes de dar algo por terminado

No afirmar que algo funciona sin haberlo corrido. El scoring castiga el mockeo: *"does what was built actually work, or is it mocked? Heavy mocking caps the score."* Un componente que solo existe en un comentario no puntúa.
