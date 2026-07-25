# Engineering Copilot Pfannenberg — diseño

**Evento:** AgentSprint — AI Hackathon · Universidad EAFIT, Medellín · 2026-07-25, 08:00–12:00
**Estado:** secciones 1–5 aprobadas. Sección 7 (agente conversacional) aprobada 2026-07-25.
**Fecha del documento:** 2026-07-24 · **revisado 2026-07-25**

> **Cambio de dirección del 2026-07-25.** El flujo pasa de *pipeline de un disparo* a
> **conversación con el cliente → brief para el ingeniero**. Eso revierte la decisión §3.1
> (la entrevista deja de ser fallback y pasa a ser la apertura) y jubila el flag
> `expertise` de §3.2. **La sección 7 manda sobre §3.1, §3.2 y §3.3.** Todo lo demás
> —contrato de datos, umbrales, reglas del catálogo, ejemplo end-to-end— sigue vigente
> tal cual y es lo que alimenta la conversación.

---

## 1. Contexto del evento

- Equipos de 3–4 personas
- **Presupuesto real de construcción: ~2 h 00 – 2 h 30.** El evento son 4 h de reloj;
  el material del organizador declara *"roughly 3 to 3:30 of real build time"*, menos
  25 min de *lock the idea, together* al principio y ~35 min de demo al final.
  *(La cifra de "~3.5 h de build" que aparecía antes aquí y en CLAUDE.md era el bloque
  de reloj, no el tiempo de construcción.)*
- Premios: 2.000.000 / 1.000.000 / 500.000 COP
- Tema: agentes de IA para OEMs (industrial y más allá)
- Marca elegida: **Pfannenberg** (corpus documental ya descargado en este directorio)
- Restricción del evento: no usar información confidencial de las empresas donde uno trabaja. Todo el corpus aquí usado es material público del Download Centre de Pfannenberg.

### Scoring (define las prioridades de diseño)

| Dimensión | Peso | Detalle |
|---|---|---|
| Innovación | 30% | 1–10, promedio de 5 jueces. Premia el caso de uso o flujo que otros no habrían pensado. |
| Progreso | 30% | 1–4 objetivo. Nivel 4 = **todas las respuestas fundamentadas por knowledge tools**. |
| Checklist técnico | 20% | 0–5. Hasta 5 componentes de arquitectura que **demostrablemente funcionen**. Nombrarlos en un comentario no cuenta. |
| Presentación | 10% | 1–10. Narrativa clara y respuestas que aguanten preguntas. |
| Calidad de código | 10% | 0–5, revisión directa del repo. Mockear mucho topa la nota. Piden secrets management e historial de commits trazable. |

---

## 2. Problema y encuadre

PSS (Pfannenberg Sizing Software) ya existe y hace el dimensionamiento certificado. **No lo reemplazamos ni lo replicamos.**

PSS es un wizard de 5 pasos que exige un ingeniero que ya tiene todas las respuestas, frente a un formulario estructurado, mientras el cliente escribe en prosa y no sabe qué datos hacen falta.

**Pitch:** *PSS dimensiona en 5 minutos. Llegar al punto de poder usar PSS toma 3 días. Automatizamos los 3 días.*

Lo que el agente hace y PSS no:
1. **Extrae** de entrada desestructurada (correo, RFQ, lista de componentes) lo que PSS pediría, tipado y validado.
2. **Infiere** lo inferible con defaults documentados y **marca como faltante** lo que no. Nunca inventa.
3. **Pre-califica la tecnología y argumenta el caso negativo** con cita — PSS solo muestra qué es viable al final, sin explicar por qué no lo demás.
4. **Acompaña al no experto**: le enseña dónde conseguir cada dato que falta.

### Riesgo principal identificado

Un juez que lea el tutorial de PSS preguntará: *"PSS ya hace esa entrevista, ¿qué agregaron?"* Toda la narrativa tiene que responder eso de frente. La respuesta es el punto 1 + 3 + 4: el valor no está en el formulario, está en el camino desde la realidad desordenada hasta un brief PSS-ready.

---

## 3. Decisiones cerradas

### 3.1 Dirección
**RFQ → brief PSS-ready.** Entrada desestructurada real → extracción + inferencia + detección de vacíos → compuerta de 4 familias con caso negativo argumentado y citado → shortlist detallado solo de Cooling Units → brief técnico.

La entrevista guiada **no** es la fase de apertura. Es el *fallback* para lo que genuinamente falta.

### 3.2 Usuario — Config 3

> ⛔ **SUPERADA POR §7.** El flag `expertise` se elimina: el flujo ya tiene dos roles
> reales, cliente e ingeniero, con una vista cada uno. Lo que **sí sigue vigente de esta
> sección** es la capa *"cómo consigo este dato"* (`FIELD_GUIDE`, §3.7) y el disclaimer
> como elemento central de pantalla — el cliente que conversa es, por definición, el que
> no puede validar la recomendación.

Motor único con flag `expertise: experto | novato`.

| Modo | Usuario | Qué resuelve |
|---|---|---|
| experto | Ingeniero de aplicación de Pfannenberg / del distribuidor | Mitiga el round-trip |
| **novato** ← el de la demo | Integrador, tablerista, mantenimiento de planta | Elimina el round-trip en el origen |

El modo novato activa la capa *"cómo consigo este dato"*. Es una **tabla estática escrita a mano** (`FIELD_GUIDE`), no improvisación del modelo — así sigue siendo determinista y citable.

**Consecuencia:** en modo novato el usuario no puede validar la recomendación. El disclaimer de "esto no es un dimensionamiento certificado, el paso siguiente es PSS con un ingeniero" pasa de nota al pie a elemento central de la pantalla.

### 3.3 Flujo — una sola pantalla que evoluciona en 4 fases

**Fase 0 · Intake.** Se pega el correo/RFQ. Tres ejemplos pre-cargados para la demo: uno completo, uno con vacíos, uno fuera de alcance.

**Fase 1 · Lectura — la ficha de proyecto.** Cada campo con uno de tres estados:
- ✅ **Declarado** — con el fragmento textual exacto que lo respalda
- ⚠️ **Inferido** — con el default aplicado y su cita de catálogo
- ❌ **Faltante bloqueante** — con la decisión que queda trabada

**Fase 2 · Compuerta temprana + cierre de vacíos.** La compuerta de tecnología corre en cuanto hay 3 datos (ver umbrales, §3.5), **antes** de pedir la carga térmica. Luego máximo 3 preguntas bloqueantes, cada una con su razón, y el texto redactado listo para reenviar al cliente.

**Fase 3 · Decisión.** Compuerta de 4 familias con veredicto + cita por familia. Shortlist de Cooling Units: 2–3 modelos con capacidad, voltaje, montaje y NEMA type. Opciones rechazadas visibles con su razón.

**Fase 4 · Artefacto.** Brief técnico mapeado tab por tab al formato de PSS + log de decisiones con citas + sección explícita **"lo que no afirmamos"**.

### 3.4 Alcance

**Dentro:**
- Entrada en español o inglés · texto pegado
- Compuerta de 4 familias · shortlist detallado solo de Cooling Units
- Un gabinete por análisis
- Salida: brief en pantalla + markdown descargable

**Fuera — y vale tanto como lo de dentro:**
- ❌ **Estimar carga térmica cuando no la declaran.** Se marca como faltante. Única excepción: si dan lista de componentes con W, se suman. Suma, no estimación.
- ❌ Chillers, señalización, calefacción, alarmas
- ❌ Persistencia, usuarios, login
- ❌ OCR de fotos o PDFs adjuntos *(agujero de tiempo)*
- ❌ Integración real con PSS — no hay API; el brief **es** el handoff
- ❌ **Precios, cotización y coste de operación.** Confirmado 2026-07-25 tras buscarlo en
  el corpus. Tres razones acumuladas, cualquiera bastaría:
  1. **No hay precios de lista.** Cero en los 104 documentos. Pfannenberg vende por
     distribución y cotiza; no publica lista.
  2. **La tarifa eléctrica es local.** El catálogo NA trae una tabla de coste operativo
     a `$0.12/kWh`, tarifa de Estados Unidos. Usarla para una planta colombiana es meter
     un número de otro país y presentarlo como del cliente — el mismo error que derivar
     watts de kW, y más difícil de detectar porque parece una cuenta legítima.
  3. **Tampoco tenemos el consumo por modelo.** Para cooling units el catálogo publica
     **corriente en amperios**, no potencia. Convertir A→kW exige el factor de potencia,
     que no está publicado. Y los `28 kW vs 22 kW` de la tabla de TCO son una comparación
     ilustrativa de sistema, no un dato colgable de un modelo concreto.

  **Lo que sí entra:** la **corriente en amperios por modelo**, que sí está publicada con
  número de artículo (`Compact_catalogue`, `Flyer_X_Series_PSA`). Es una spec legítima,
  citable, y es la que dimensiona la protección y el cableado de la unidad. Va como campo
  del brief, nunca como calculadora.

  **Respuesta a la exigencia de *"specs and price"* del evento:** decirlo de frente en la
  demo — *"precios de lista no se publican, y el coste de operación depende de una tarifa
  local que no conocemos; lo que damos es la corriente de cada modelo, citada"*. Aguanta
  mejor una pregunta que una cuenta con una tarifa prestada.
- ❌ El cálculo por temperatura registrada: se **detecta** que el camino aplica y se deriva a PSS; no se implementa

**Máximo impacto por menos trabajo:** la ficha de tres estados y el caso negativo argumentado. Si solo alcanzara para dos cosas, esas dos.

### 3.5 Contrato de datos — `ProjectSpec`

**Principio:** el schema **es** el set de entradas de PSS, campo por campo, y el vocabulario de los enums copia el del catálogo para que las citas mapeen 1:1.

**A · Identificación** — no bloquea nada
`project_name` · `customer` · `enclosure_count = 1`

**B · Gabinete** *(tab Enclosure de PSS)*

| Campo | Default | Bloquea |
|---|---|---|
| `height_mm` `width_mm` `depth_mm` | — | shortlist (verificación mecánica) |
| `internal_temp_max_c` | **35.0** — cat. NA p.2 | compuerta |
| `internal_temp_min_c` | — | nada · pendiente-PSS |
| `housing_material` `{painted_steel, stainless_steel}` | painted_steel | shortlist **solo si washdown** |
| `housing_color` | RAL 7035 | nada · solo relevante outdoor |
| `supply_voltage` `{115V, 230V, 400_460V_3ph}` | **sin default** | shortlist |

**C · Entorno** *(tab Environment de PSS)*

| Campo | Default | Bloquea |
|---|---|---|
| `location` `{indoor, outdoor, washdown}` | inferible del texto | compuerta + NEMA |
| `ambient_temp_max_c` | **sin default** | compuerta |
| `ambient_temp_min_c` | — | nada · pendiente-PSS |
| `solar_load` `wind_exposure` | False · solo outdoor | nada |
| `installation` `{free_standing, wall_mounted, recessed_in_line}` | inferible | caras de montaje disponibles |
| `air_quality` `{clean_or_slightly_dirty, dirty, very_harsh}` | inferible | compuerta |

**D · Carga térmica** *(tab Heat Dissipation de PSS)* — los tres caminos que PSS reconoce

| Campo | Tratamiento |
|---|---|
| `total_dissipation_w` | **Bloqueante duro del shortlist. Nunca se estima.** |
| `component_list[{name, w, qty}]` | Camino alterno: se **suma**. |
| `measured_temps{inside_c, outside_c}` | Se detecta y se deriva a PSS. No se implementa el cálculo. |

**Derivados** — conversión de unidades, no ingeniería
`required_capacity_btuh = total_dissipation_w × 3.412` · `nema_required` ← `location` · `available_mounting_faces` ← `installation`

### 3.6 Los dos umbrales de información mínima

**Umbral 1 · correr la compuerta de 4 familias → 3 datos reales**
`ambient_temp_max_c` · `location` · `air_quality`
*(`internal_temp_max_c` ya tiene default citado)*

Con eso el agente ya entrega valor: *"necesitas aire acondicionado de lazo cerrado, no un ventilador, y esta es la razón física"* — sin conocer la carga térmica.

**Umbral 2 · shortlist de modelos → los 3 anteriores + 4**
`total_dissipation_w` · `supply_voltage` · dimensiones · `housing_material` si washdown

**Ocho campos en total.** Todo lo demás es pendiente-para-PSS.

**Implicación de UX:** la compuerta corre antes y con menos datos que el shortlist. Para un usuario novato ese orden es la diferencia entre sentir que aprendió algo y sentir que llenó un formulario.

### 3.7 `FIELD_GUIDE` — la capa del modo novato

Ocho filas, una por campo bloqueante. Estática, escrita a mano, versionada.

```
field → por_qué_lo_necesito · dónde_buscarlo · camino_alterno · cita · antipatrón
```

El campo `antipatrón` evita el error clásico. Para `total_dissipation_w`: *"no usar la potencia nominal del motor (kW) como sustituto de la pérdida del variador (W)"*.

### 3.8 Los 5 componentes de arquitectura (Checklist técnico, 20%)

Tienen que **funcionar**, no estar nombrados.

| # | Componente | Qué es |
|---|---|---|
| 1 | Extracción estructurada | LLM con schema: texto libre → `ProjectSpec` tipado |
| 2 | Motor de reglas determinista | Python puro, sin LLM: compuerta de tecnología + filtro de producto, devuelve citas |
| 3 | Knowledge tool sobre el corpus | Fundamenta los "por qué" y las preguntas de especificación. **Búsqueda por keywords, no embeddings** — ver §7.7. |
| 4 | Guardrails / detección de vacíos | Se niega a inventar carga térmica, bloquea fuera de alcance, valida el schema antes de recomendar. **Más el post-check numérico sobre la prosa del chat** — ver §7.2. |
| 5 | Generador de artefacto | Brief técnico PSS-ready con log de decisiones trazable |

---

## 4. Hallazgos del corpus — la fuente de las reglas deterministas

**El motor de reglas no hay que inventarlo: hay que transcribirlo del catálogo con cita.**

> ⚠️ Los números de página del catálogo NA de 12 páginas fueron derivados de los marcadores de pie de página del texto extraído. **Verificar la numeración exacta antes de citarla frente a un juez.**

### 4.1 Matriz de tecnología — `Thermal_Management_Catalog_12_Page-Final_2024.pdf`, p.2

| Condición | Tecnología |
|---|---|
| Cool Ambient, Clean or Slightly Dirty Conditions | Filterfan 4.0 + Exhaust Filters |
| Cool Ambient, Dirty Conditions | PKS Air/Air Heat Exchangers |
| High Ambient & Clean or Dirty Conditions | DTS Cooling Units |
| High Ambient and/or Very Harsh, Dirty Conditions | PWS Air/Water Heat Exchangers |

### 4.2 Reglas textuales citables

| Fuente | Cita |
|---|---|
| Cat. NA p.2 | *"Electronics are typically most efficient in low humidity with a temperature around 95°"* → default `internal_temp_max_c = 35 °C` |
| Cat. NA p.4 | *"If the ambient temperature is always lower than the required temperature in the electrical enclosure, then this method is an economical solution."* (exhaust filters / convección natural) |
| Cat. NA p.6 | *"If the ambient temperature is greater than the target internal temperature of the enclosure, active cooling is required."* |
| Cat. NA p.6 | *"If a NEMA Type 12/3R/4/4x rating is required — closed loop systems can maintain the NEMA Type rating of the cabinet."* |
| Cat. NA p.6 | *"Best suited for clean or dirty environments where the ambient temperature is greater than the target internal temperature of enclosure."* (encabezado COOLING UNITS) |
| Cat. NA p.7 | DTS: *"Also available in Outdoor (Type 3R/4) and Washdown (Type 4/4x)."* |
| Cat. NA p.7 | *"DTT Series Top Mount **Type 12** Cooling Units"* → **DTT no tiene variante washdown documentada. Regla de descarte por rating.** |
| Cat. NA | *"avoid costly oversizing or dangerous undersizing"* → regla de sobredimensionamiento |
| PSS Tutorial · Results | *"filter fan and air/air heat exchanger are not possible, this is because the ambient temperature selected (100 °F) is higher than the maximum allowable temperature inside the enclosure (95 °F)"* → **la compuerta lógica, confirmada por el propio PSS** |
| PSS Tutorial · Environment | *"Indoor (NEMA Type 12), Outdoor (NEMA Type 3R/4), or Washdown (NEMA Type 4/4X)"* → mapeo `location` → `nema_required` |
| PSS Tutorial · Enclosure | *"Supply Voltage … Please note this can change which units show in the final solution page."* → justifica que `supply_voltage` sea bloqueante |
| PSS Tutorial · Heat Dissipation | *"It is recommended to still verify heat loss of each individual component as these values might be higher than the actual components that are being used."* |
| PSS Tutorial · Heat Dissipation | *"Calculate Dissipation based on Recorded Temperature … typically for existing enclosures in the field"* → el tercer camino |

### 4.2.b Hallazgos de `DTS_2017.pdf` — añadidos tras revisar los datasheets

Cuatro citas que mejoran sustancialmente el motor de reglas:

| Cita | Uso |
|---|---|
| *"The refrigeration capacity should exceed the dissipation loss from the installed components by approximately 10%."* | **Regla de margen documentada.** `required_w = total_dissipation_w × 1.10`. Determinista y citable. |
| *"Pfannenberg utilizes the DIN standard 35/35 °C when rating our cooling units. Many other companies use 50/50 °C, which provides a higher, non-usable value. Customers should use their own application temperatures to determine the proper cooling capacity of the system."* | **Base de rating.** Si el punto de operación es más severo que 35/35, la capacidad útil real está **por debajo** de la nominal. Justifica el margen con fundamento, no por intuición. |
| *"Note: Cooling capacity may vary between voltage and configurations."* | **Corrige una suposición previa:** el rango del quick selection chart varía por **voltaje y configuración**, no por temperatura. Eso vuelve a `supply_voltage` un dato aún más crítico: no solo filtra disponibilidad, determina la capacidad dentro del rango. |
| `PC = PD − PR` con `PR = C × A × ΔT`, donde `PC` = capacidad de refrigeración, `PD` = disipación de componentes, `PR` = transmisión por paredes, `C` = coeficiente de transmisión [W/m²°C], `A` = superficie [m²] | **La fórmula de dimensionamiento, documentada.** **NO la implementamos:** requiere `C` (según material) y `A` (superficie efectiva según instalación), que es exactamente lo que resuelven los dropdowns de material e installation characteristics de PSS. La citamos para explicar dónde está nuestro límite — la fórmula pasa de ser una tentación a ser la justificación de la frontera. |

**Las curvas de performance (capacidad vs. temperatura ambiente, 25–55 °C) existen en el datasheet pero son imágenes.** El eje se extrae, la curva no. Se citan como referencia; no se leen.

**Consecuencia de diseño:** el "presupuesto térmico" queda en tres pasos, todos documentados y sin coeficientes inventados:
1. `PD` = disipación total, declarada o sumada de la lista de componentes. Nunca estimada.
2. `required_w = PD × 1.10` — regla de margen citada.
3. Filtrar modelos cuyo **extremo bajo del rango** supere `required`, y advertir cuando el punto de operación es más severo que la base DIN 35/35.

### 4.3 Tablas de producto parseables

`Thermal_Management_Catalog_12_Page-Final_2024.pdf` trae **QUICK SELECTION CHARTs** con `MODEL / COOLING CAPACITY (Btu/h) / AVAILABLE VOLTAGES / DIMENSIONS (H×W×D)`. El tipo de montaje está codificado en la serie: **DTS = side · DTI = integrado/recessed · DTT = top**.

**Cooling units, side mount (DTS):**

| Modelo | Btu/h | Voltajes | Dimensiones mm |
|---|---|---|---|
| DTS 3021 | 900 – 1 300 | 115 / 230 V | 393 × 177 × 191 |
| DTS 30X1 | 2 000 – 3 000 | 115 / 230 / 460 V | 512 × 254 × 274 |
| DTS 31X1 | 3 000 – 4 000 | 115 / 230 / 400-460 V | 748 × 395 × 237 |
| DTS 31X1 SL | 3 000 – 5 000 | 115 / 230 / 400-460 V | 914 × 305 × 304 |
| DTS 31X5 | 5 000 – 7 000 | 115 / 230 / 400-460 V | 914 × 305 × 304 |
| DTS 32X1 | 7 000 – 8 500 | 115 / 230 / 400-460 V | 1 209 × 395 × 269 |
| DTS 32X5 | 9 000 – 12 000 | 115 / 230 / 400-460 V | 1 347 × 406 × 301 |
| DTS 34X1C | 15 000 – 20 000 | 230 / 400-460 V | 1 452 × 400 × 400 |
| DTS 36X1C | 20 000 – 24 000 | 230 / 400-460 V | 1 452 × 400 × 400 |

Toda la serie DTS: Type 12 indoor, con variantes Outdoor 3R/4 y Washdown 4/4X. Acabados RAL 7035, ANSI 61, inoxidable.

**Integrated/recessed (DTI) y top mount (DTT):** DTI 6201C 3 000–4 000 · DTI 6301C 5 000–6 000 · DTI 6201/6301/6401/6501/6801 Green Series 3 000–16 000 · DTT 6101 1 200–2 000 · DTT 6201 2 500–4 000 · DTT 6301 4 000–5 500 · DTT 6401 5 500–7 000 · DTT 6601 7 000–10 000. **DTT figura solo como Type 12.**

**Filterfans y exhaust filters:** series PF / PFA con caudal en m³/h, voltajes 230 V AC / 24 V DC / 400-460 V 3~, y dimensiones de recorte (92×92 … 292×292 mm).

**Otras fuentes útiles:**
- `Pfannenberg_Compact_catalogue_30_en.pdf` — capacidades en **W** (no Btu/h) y **números de artículo reales** por modelo y voltaje. Útil para dar referencia comercial exacta en el brief.
- `Pfannenberg_Cut-out_compatibility_list_thermal_management_side_mounted_units.pdf` — restricción mecánica real. No está en el alcance del MVP, pero es el mejor candidato a ampliación si sobra tiempo.

### 4.4 Reproducir la extracción

```bash
pdftotext -layout "<archivo>.pdf" salida.txt
```

`poppler-utils` ya está instalado en la máquina. Los PDFs clave son el catálogo NA de 12 páginas (reglas + tablas limpias) y `PSS Tutorial/PSS-Tutorial.pdf` (el set de entradas de PSS).

---

## 5. Ejemplo end-to-end validado

Escenario: planta de envasado en Barranquilla, línea de llenado, 4 gabinetes 2000×800×600 mm contra pared, zona de lavado a presión, 2 variadores de 22 kW + PLC por gabinete, ambiente 38 °C, operación 24/7.

**Extracción:** 6 campos declarados con fragmento de respaldo · 3 inferidos con cita (`washdown → Type 4/4X`, `indoor sin carga solar`, `internal_temp_max = 35 °C`) · 3 bloqueantes (`total_dissipation_w`, `supply_voltage`, `housing_material`).

**Lo que NO hizo:** convertir 22 kW nominales en watts disipados. Ese es el momento exacto en que un chatbot alucina y pierde.

**Tras la respuesta del cliente** (650 W por variador + 50 W PLC · 460 V 3~ · inoxidable):

`PD = 2 × 650 + 50 = 1 350 W` → `required = 1 350 × 1.10 = 1 485 W` = **5 067 Btu/h**
*(margen del 10% citado de `DTS_2017`)*

**Compuerta:**

| Familia | Veredicto | Razón |
|---|---|---|
| Filterfan 4.0 / PFA | ❌ | Ambiente 38 °C > objetivo interno 35 °C (cat. p.4). Además rompe el Type 4X: introduce aire exterior. |
| PKS Air/Air HX | ❌ | Un intercambiador aire/aire no puede llevar el interior por debajo del ambiente. La matriz de p.2 lo ubica en *"Cool Ambient"*. |
| PWS Air/Water HX | ⚠️ | La matriz lo recomienda para *"High Ambient and/or Very Harsh, Dirty"* — encaja con washdown. Requiere agua de proceso, no declarada. Se reporta como alternativa. |
| Cooling Units | ✅ | Cat. p.6: ambiente > objetivo interno → cooling activo. Y Type 4X exige lazo cerrado. |

**Shortlist (requerido = 5 067 Btu/h):**

| Modelo | Capacidad | Veredicto |
|---|---|---|
| **DTS 31X5** Washdown | 5 000 – 7 000 Btu/h · 460 V · side mount | ⚠️ **Recomendado con verificación.** El extremo bajo del rango (5 000) queda 1.3% por debajo de lo requerido. Como el rango varía **por voltaje y configuración**, hay que confirmar el valor específico a 460 V. Disponible en 4/4X e inoxidable. |
| DTS 32X1 | 7 000 – 8 500 | ⚠️ Alternativa con margen, sin necesidad de verificar. 38% sobre lo requerido en el extremo bajo — aceptable, pero el catálogo advierte contra *"costly oversizing"*. |
| DTS 31X1 SL | 3 000 – 5 000 | ❌ El techo del rango queda por debajo de lo requerido |
| DTS 31X1 | 3 000 – 4 000 | ❌ Insuficiente |
| DTT 6301 | 4 000 – 5 500 | ❌ La serie DTT figura solo como Type 12. Descartado por rating, independientemente de la capacidad. |

Verificación mecánica: contra pared → 3 caras disponibles; DTS 31X5 mide 914 mm contra 2 000 mm de gabinete. Cabe. **Total 4 unidades.**

**La nota que separa a un ingeniero de un generador de texto:**

> La capacidad publicada está referida a la **base DIN 35/35 °C** (`DTS_2017`). El punto de operación es 38 °C de ambiente contra 35 °C internos — **más severo que la condición de referencia**, así que la capacidad útil real es menor que la nominal. El derating exacto está en las curvas de performance del datasheet y en PSS. Por eso la pre-selección exige margen, y por eso el DTS 31X5 queda marcado como "verificar" y no como "listo".

Ese desenlace es mejor que un veredicto limpio: el agente dice *"está en el límite, hay que confirmar el valor a 460 V"* en vez de elegir con falsa confianza. Es lo que escribiría un buen ingeniero de aplicación y aguanta la pregunta de un juez.

**Dónde cerrar ese "verificar":** `Pfannenberg_Compact_catalogue_30_en` trae capacidades en **W** y números de artículo por modelo **y voltaje**. Es la fuente para convertirlo en un dato duro, si alcanza el tiempo.

**Lo que no afirmamos:** la capacidad neta a 38/35 °C · el punto exacto dentro del rango · el sizing certificado · falta `ambient_temp_min_c` y la utilización real de los variadores.

**Los otros dos casos de la demo:** uno completo que va de intake a brief sin preguntas, y uno fuera de alcance (*"necesito sirenas para una subestación"*) donde el guardrail responde que está fuera del dominio de thermal management y no improvisa.

---

## 7. El agente conversacional — cliente → ingeniero

*Aprobado 2026-07-25. Manda sobre §3.1, §3.2 y §3.3.*

### 7.1 El flujo

El cliente **conversa** con el agente. El agente entrevista, enseña dónde encontrar cada
dato que falta, y cuando cierra los umbrales de §3.6 emite el brief para el ingeniero de
aplicación. Una sola app con dos vistas y un toggle.

**Vista cliente** — chat a la izquierda, **ficha de tres estados viva a la derecha**, que
se actualiza en cada turno. El cliente ve su frase convertirse en campo tipado con la cita
que lo respalda, y ve qué sigue trabado.

**Vista ingeniero** — brief PSS-ready, shortlist con los rechazados y su razón, log de
decisiones citado, sección *"lo que no afirmamos"*, y descarga en markdown.

**Por qué la ficha va viva y no solo dentro del brief:** el componente hay que construirlo
igual; el coste marginal es una columna y re-renderizar. A cambio, el guardrail deja de ser
plomería invisible y pasa a ser lo que el juez **ve funcionar** — que es literalmente el
criterio del checklist técnico (*"naming a component in a comment doesn't count"*).

### 7.2 Arquitectura — tres capas

Un proceso Next.js. Un endpoint `POST /api/turn`. Una ruta, dos vistas.

**Capa 1 · Espina determinista.** Corre entera en cada turno, en orden fijo. El modelo no
decide nada de esto.

```
extract(msg, spec)    → sobres           [LLM + Zod]
validate(sobres, msg) → sobres limpios   [código puro]  ← aquí muere la invención
merge(spec, limpios)  → ProjectSpec
gate(spec)            → veredictos+cita  [código puro]
shortlist(spec)       → modelos+cita     [código puro]
brief(...)            → artefacto        [código puro]
```

**Capa 2 · Loop conversacional de solo lectura.** Arranca después de la espina, con el spec
ya validado y los veredictos ya resueltos en contexto. `generateText` + `maxSteps: 5` y
cuatro herramientas que **solo leen**:

| Tool | Devuelve |
|---|---|
| `buscar_catalogo(query)` | fragmentos del corpus con cita |
| `explicar_veredicto(familia)` | la razón citada de la compuerta |
| `guia_de_campo(campo)` | fila del `FIELD_GUIDE` (§3.7) |
| `specs_modelo(modelo)` | capacidad, voltajes, dimensiones, **corriente (A)**, artículo |

**Capa 3 · Post-check numérico.** Código puro sobre la prosa del modelo: todo número que
aparezca tiene que existir en el spec validado o en un resultado de tool de ese turno. Si
no, el mensaje se sustituye por la narración plantilla de los veredictos y se marca.

### 7.3 Por qué solo lectura

En el pipeline original la regla 1 se sostenía porque **todo** pasaba por el validador de
sobres. En un chat el modelo produce **prosa**, y la prosa no pasa por ese validador. El
fallo concreto que habilita: *"un variador de 22 kW típicamente disipa un 3%, así que unos
660 W"* — fluido, plausible, y exactamente lo que el diseño existe para impedir.

Los cuatro proveedores probados el 2026-07-25 se abstuvieron correctamente **en modo
structured output**. Eso no dice nada de lo que harían en prosa libre.

La respuesta es quitarle al modelo la capacidad de escribir. El modelo toca el estado
**exactamente una vez** —el paso `extract`, con schema fijo, invocado por código, no
elegido por él— y el paso `validate` es el guardia de esa puerta. Ninguna de las cuatro
tools escribe. **El brief lo ensambla código** a partir de datos ya validados.

**Consecuencia aceptada:** el agente no improvisa. Fuera de las cuatro tools y del spec, la
respuesta correcta es *"eso lo ve el ingeniero"*. Se ve rígido al lado de un chatbot suelto,
y es justo lo que lo hace aguantar el intento de un juez de tumbarlo.

### 7.4 Manejo de errores

| Situación | Comportamiento |
|---|---|
| Fallo de proveedor | Fallback `groq-1 → groq-2 → mistral-1 → mistral-2`. Timeout 20-25 s, **cero reintentos dentro del mismo proveedor**. La UI muestra quién respondió. |
| Fallan los cuatro | El `ProjectSpec` acumulado **no se toca**, la ficha no se mueve, el chat pide reformular. El estado vive en servidor entre turnos. |
| Campo degradado | No es error, es el sistema. **Se registra en el log**: *"propuso 380, la evidencia no contenía esos dígitos → missing"*. Ese log entra en el brief: es la prueba de que el guardrail actuó. |
| Post-check falla | Se sustituye por la narración plantilla y se marca. Feo pero determinista; regenerar añade latencia y azar en vivo. |
| Tool vacía o caída | El loop sigue. Instrucción explícita: decir que no está en el catálogo, nunca rellenar. |
| Fuera de alcance | Guardrail determinista **antes** de llamar al LLM: keywords (sirenas, chillers, calefacción, señalización) → respuesta fija citada, sin gastar llamada. |
| Loop desbocado | `maxSteps: 5` duro. Al tope, se corta y se responde con lo que haya. |
| Caída de red en demo | Reglas, validador y brief son código puro: con un spec ya cargado la vista ingeniero funciona entera sin red. |

### 7.5 Testing

En orden de peso. Sin mocks del LLM: *"heavy mocking caps the score"*.

1. **Motor de reglas.** Tabla de casos sobre la matriz §4.1: cada `(ambient vs internal, air_quality, location)` → familia esperada **y** cita presente. Más los descartes: DTT sin washdown, filterfan rompe Type 4X, ambiente > interno exige cooling activo.
2. **Validador de sobres.** Los nueve casos ya verificados el 2026-07-25 contra el smoke test: *pasan* cita con salto de línea y cita corta; *se cazan* 22 kW→22000, 38→380, `declared` sin evidencia, evidencia inventada, dígitos ausentes, valor pelado y payload no-dict.
3. **Post-check numérico.** Número presente en un tool result → pasa. Número inventado → bloqueado.
4. **Shortlist — regresión gratis.** El caso de §5 ya está resuelto a mano: `PD 1350 → required 1485 W → 5067 Btu/h` debe dar DTS 31X5 ⚠, DTS 32X1 ⚠ y tres rechazados con razón.

No se testea la UI ni la calidad de respuesta del LLM. Para lo segundo está
`tools/smoke_test_providers.py`, que ya corre y ya pasa con los cuatro proveedores.

### 7.6 Reparto

| | Trabajo | Bloqueado por |
|---|---|---|
| **B** | Motor de reglas + datos curados del catálogo | nada — TS puro, sin red |
| **C** | Las 4 tools sobre los ~30 archivos en alcance | nada |
| **A** | Extracción + validador + post-check + fallback | contrato `ProjectSpec` |
| **D** | Chat + ficha viva + vista ingeniero + brief | contrato `ProjectSpec` |

### 7.7 Cortes confirmados

- **RAG con embeddings → búsqueda por keywords.** El corpus de reglas son ~11 k tokens y
  caben en contexto. `buscar_catalogo` por keywords sobre los ~30 archivos en alcance sigue
  siendo un knowledge tool real y citable. El índice vectorial compra poco por su coste.
- **Modo `experto` (§3.2) → fuera.** El flujo ya tiene dos roles reales; el flag sobra.
- **Tres ejemplos precargados → dos:** el completo y el fuera de alcance.
- **La quinta tool de coste operativo → no existe.** Ver §3.4.

### 7.8 Guion de demo (~5 min)

1. **Fuera de alcance primero** (15 s). *"Necesito sirenas para una subestación"* → el guardrail responde. Abres demostrando que el agente sabe lo que **no** sabe.
2. **Barranquilla.** Se pega el correo. La ficha se llena en vivo: 38 °C declarado con su fragmento, washdown inferido con cita, disipación ❌. **Decir en voz alta: no convirtió los 22 kW en watts.**
3. **La compuerta dispara con 3 datos**, antes de preguntar por la carga térmica. Cuatro veredictos con su página.
4. **El cliente responde** 650 W + 460 V + inox → shortlist con DTS 31X5 ⚠ y la nota de la base DIN 35/35.
5. **Toggle a vista ingeniero:** brief, log de decisiones, *"lo que no afirmamos"*.
6. **Cierre:** *PSS dimensiona en 5 minutos. Llegar a poder usar PSS toma 3 días.*

---

## 6. Pendiente — retomar aquí

- [ ] Verificar la numeración de página real del catálogo NA de 12 páginas.
- [ ] Decidir si el `Cut-out compatibility list` entra como ampliación. **Se volvió barato:** el texto extraído son solo 8.3 k caracteres, así que estructurarlo es trivial.
- [ ] Cerrar la capacidad por voltaje desde `Pfannenberg_Compact_catalogue_30_en` (capacidades en W + artículo por voltaje), para convertir el "verificar" del DTS 31X5 en dato duro.
- [ ] Revisar `Pfannenberg-Support-Center.txt` (65 k chars, diez veces el tutorial de PSS) — puede traer FAQ y troubleshooting aprovechable.

### Hecho

- [x] Corpus completo extraído a `corpus_txt/` — 104 documentos, 0 fallos, **0 escaneados** (no hace falta OCR). Manifiesto en `corpus_txt/MANIFEST.md`.
- [x] Datasheets `DTS_2017` y `DTT_2015eng` revisados → §4.2.b: regla del 10%, base DIN 35/35, fórmula `PC = PD − PR`, y la corrección sobre el significado del rango de capacidad.
- [x] `tools/smoke_test_providers.py` — verificación de proveedores con test de abstención.
- [x] `CLAUDE.md`, `.env.example`, `.gitignore`.
- [x] **Stack cerrado (2026-07-25): Next.js + React.** Vercel AI SDK con `generateObject`
      y Zod para la extracción, `generateText` con tools para el loop. Motor de reglas en
      TypeScript puro. Sin backend Python separado, sin LangChain.
- [x] **Proveedores verificados en vivo (2026-07-25)** con `smoke_test_providers.py`:
      los cuatro pasan los 4 tests, incluido el de abstención, y los cuatro soportan
      `json_schema` — que es lo que emite `generateObject`.

      | Proveedor | Modelo | Modo | Latencia |
      |---|---|---|---|
      | groq-1 / groq-2 | `openai/gpt-oss-120b` | `json_schema` | ~1.8 s |
      | mistral-1 / mistral-2 | `mistral-medium-3.5` | `json_schema` | ~3.3 s |

      **Orden de fallback:** groq-1 → groq-2 → mistral-1 → mistral-2.
      **`openai/gpt-oss-120b` es el único modelo de Groq que acepta `json_schema`**;
      `llama-3.3-70b` y `llama-3.1-8b` solo hacen `json_object`, y `qwen/qwen3.6-27b`
      no hace ninguno de los dos (razona dentro de la salida y rompe el JSON).
      No cambiar ese modelo sin volver a correr el smoke test.
- [x] **Sección 7** — el agente conversacional cliente → ingeniero.
