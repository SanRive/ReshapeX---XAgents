# Revisión crítica — Pfannenberg Engineering Copilot

**Evaluado como juez técnico del evento** · AgentSprint · EAFIT Medellín · 2026-07-25
**Documentos auditados:** `que-vamos-a-construir.md` · `2026-07-24-pfannenberg-engineering-copilot-design.md` · `Thermal_Management_Catalog_12_Page-Final_2024.txt` · `PSS-Tutorial.txt` · PDF del evento · sitio del evento

> Encargo: romper el plan, no validarlo. Sin rediseños — huecos y arreglos dentro de la dirección ya decidida.

---

## Resumen ejecutivo

**Lo que resiste** (y no es cortesía — es la parte que más fácil se rompe y no se rompió):

- Los números de página que el §4 dejó marcados como pendientes de verificar **están todos correctos**.
- Las 9 filas de la tabla DTS están transcritas exactas.
- Las 5 citas del tutorial de PSS son textuales.
- La aritmética del §5 da exacta: 1 350 W → 1 485 W → 5 067 Btu/h, 1,32 %, 38,1 %.

**Lo que no resiste**, en orden de gravedad:

| # | Hallazgo | Dimensión afectada |
|---|---|---|
| 1 | Las citas son literales en código, no llamadas a herramienta | **Progress 30 %** + Checklist 20 % |
| 2 | La innovación es invisible en la demo; el momento de los 22 kW no está montado | **Innovación 30 %** |
| 3 | `"avoid costly oversizing"` **no existe en el catálogo** | Integridad de la tesis + Presentación |
| 4 | El default de 35 °C está anclado a una frase sobre *eficiencia*, no sobre *máximo* | Demo entera |
| 5 | La regla de filtrado y el ejemplo del §5 se contradicen | Presentación + Q&A |
| 6 | El RAG quedó sin consumidores: fue diseñado fuera de su propio trabajo | **Checklist 20 %** |
| 7 | El candado falla en silencio con entrada en español real | Riesgo de demo en vivo |
| 8 | Filterfans: el catálogo da **CFM**, el diseño dice **m³/h** | Calidad de código |

---

# 1 · Dónde pierde puntos

## 🔴 Progress (30 %) — el nivel 4 no está ganado, y la arquitectura va en su contra

El nivel 4 exige: *"All answers grounded by knowledge tools."*

El componente 2 es, por diseño explícito, **Python puro sin LLM** con las citas escritas como literales. El `FIELD_GUIDE` es *"una tabla estática escrita a mano"*. La matriz de tecnología es un dict.

Un juez estricto lee eso así: **una cita tecleada dentro de un diccionario no es una respuesta fundamentada por una knowledge tool. Es una constante.** Es el mismo artefacto que un `print("según el catálogo p.6...")`.

La decisión de ingeniería (determinismo sobre recuperación) es correcta. La decisión de scoring es cara: pone en riesgo 30 puntos completos por una diferencia que desde adentro no se ve — ustedes transcribieron del catálogo a mano y con disciplina. Pero el rubro no premia la disciplina de transcripción; premia que el sistema esté fundamentado **en tiempo de ejecución**.

Es lo más grave del plan y es reparable sin tocar la dirección. Ver [La única cosa que cambiaría](#la-única-cosa-que-cambiaría).

## 🔴 Innovación (30 %) — existe, pero es invisible en pantalla

El valor está en lo que el sistema **se niega** a hacer. La negativa es espacio negativo: no se ve.

El guion actual (`que-vamos-a-construir` líneas 122-130):

> pegar correo → ficha de colores → descarta tres tecnologías → contestar dos preguntas → sacar documento

Con 1-10 y promedio de 5 jueces, lo que se ve es: *pegar texto → se llena un formulario → sale una tabla → sale un documento*. **Visualmente indistinguible de un chatbot que lee un PDF** — justo la cosa contra la que se diferencian.

Y el momento de los 22 kW — el mejor activo del proyecto, el que el §5 llama *"el momento exacto en que un chatbot alucina y pierde"* — **no aparece en ninguno de los cinco pasos de la demo.** Está en prosa. No está montado.

Costo de arreglarlo: **cero minutos de código.** Es reordenar el guion. Pero si llegan a las 11:55 sin haberlo hecho, dejaron 30 % sobre la mesa por puesta en escena.

## 🟠 Checklist técnico (20 %)

Ver [pregunta 3](#3--el-componente-más-débil-el-3-el-rag).

## 🟠 Calidad de código (10 %) — el límite de alcance parece mock

*"Heavy mocking caps the score regardless of code style."*

El repo va a tener, por diseño consciente, caminos no implementados: cálculo por temperatura registrada, chillers, señalización, la fórmula `PC = PD − PR`. Desde adentro es una frontera defendida con argumentos. **Desde afuera, en una revisión de repo de diez minutos, un `NotImplementedError` es un `NotImplementedError`.**

La distinción vive en la narrativa, y el juez técnico revisa el repo, no la narrativa.

**Arreglos baratos:**
- Cada camino no implementado **devuelve un objeto real y testeado** — `{status: "requires_pss", reason: ..., cita: ...}` — en vez de estar ausente o lanzar excepción.
- README que declare la frontera como **decisión**, no como pendiente.
- **Commits:** lo piden explícitamente ("traceable commit history"). Cuatro personas en 3,5 h producen, sin acuerdo previo, tres commits y uno llamado "final". Acuerden ahora: **un commit por componente terminado, con el nombre del componente.**

## ⚪ Presentación (10 %) — bien cubierto

Tienen la pregunta difícil anticipada y respondida. Es más de lo que va a llevar la mayoría.

---

# 2 · La pregunta que no pueden responder

Cuatro, en orden de daño.

### 🥇 *"Muéstrame la llamada a herramienta que produjo esa cita."*

Si la respuesta honesta es *"está en un diccionario"*, esa única pregunta baja **Progress** (no es grounded por tool), **Checklist** (¿el RAG demuestra que hace su trabajo?) y **Calidad de código** (huele a hardcode).

Una pregunta, tres dimensiones, **60 % del puntaje tocado**. Y no se puede esquivar: el juez técnico abre el repo.

### 🥈 *"El default de 35 °C sale de una frase que dice que la electrónica es más* eficiente *cerca de 95°. Eficiente no es máximo. ¿Cuál es su máximo real, y qué le pasa a su compuerta si el cliente tolera 40 °C?"*

La que más duele, porque **desarma la demo con la cita de ustedes**.

Texto literal del catálogo (línea 44):

> *"Electronics are typically most efficient in low humidity with a temperature around 95°"*

Es una afirmación sobre **óptimo**, no sobre **máximo admisible**. Y `internal_temp_max_c = 35.0` gobierna toda la compuerta.

**Hagan la cuenta de qué pasa si el juez empuja:** el caso demo tiene ambiente a 38 °C. Si el máximo interno real fuera 40 °C en vez de 35, **el ambiente pasa a ser menor que el objetivo interno, y Filterfans y PKS dejan de estar descartados.** El momento estrella — *"descarta tres de las cuatro tecnologías"* — se invierte completo.

Su veredicto entero cuelga de 3 °C de margen inferidos de una frase sobre eficiencia.

**Detalle adicional:** el catálogo dice **"95°" sin unidad**. Que sea °F se infiere de que es el catálogo norteamericano y de que el tutorial de PSS usa 95 °F como *"maximum allowable temperature inside the enclosure"*.

**Arreglo, 5 minutos:**
1. Re-anclar el default al **tutorial de PSS** (ahí sí dice *maximum allowable*), no al catálogo p.2.
2. Hacer `internal_temp_max_c` **visible y editable en pantalla**, marcado 🟡 con su cita.

Convierte la vulnerabilidad en demostración de la ficha de tres estados.

### 🥉 *"Su regla dice filtrar modelos cuyo extremo bajo del rango supere lo requerido. 5 000 es menor que 5 067. ¿Por qué el DTS 31X5 es su recomendado?"*

**El §4.2.b y el §5 se contradicen.**

- La regla escrita (paso 3): *"filtrar modelos cuyo extremo bajo del rango supere `required`"* → **excluye** el DTS 31X5 (piso 5 000 < 5 067).
- El ejemplo del §5: lo **recomienda** como ⚠️ *"con verificación"*.
- Y rechaza el DTS 31X1 SL *"porque el techo del rango queda por debajo"* — usando **el mismo número 5 000 en el sentido contrario**.

El matiz que quieren (*"está en el límite, verificar"*) es bueno y es lo que escribiría un ingeniero de verdad. Pero la regla como está escrita no lo produce.

**Arreglo — tres estados, no dos:**

```python
if piso > requerido:            # ✅ OK
elif piso <= requerido <= techo: # ⚠️ VERIFICAR
else:                            # ❌ NO (techo < requerido)
```

Tres líneas. Hace que la regla y el ejemplo digan lo mismo.

### 4ᵃ *"¿Y el DTI 6301 C? 5 000–6 000 Btu/h, 230/400-460 V. Cubre sus 5 067 y no aparece en su lista."*

El §5 muestra descartes de DTS y uno de DTT. **Nunca menciona la serie DTI**, que tiene un modelo justo en rango.

La regla aplicada está bien pero escrita demasiado angosta: *"DTT figura solo como Type 12"*. Lo cierto en este catálogo es más general:

> **El pie de página con variantes Outdoor/Washdown solo lo tienen DTS (línea 355) y PKS (línea 477). Ni DTI ni DTT lo tienen.**

Generalizar la regla a *"la serie no documenta variante 4/4X en esta fuente"* y el DTI cae por la misma puerta que el DTT. Si no, el panel de "descartados y por qué" tiene un hueco visible.

---

# 3 · El componente más débil: el 3, el RAG

No está en duda, y no es por dificultad técnica. **El propio diseño le quitó el trabajo.**

El RAG existe para *"fundamentar los porqués y las preguntas de especificación"*. Pero:

- los **porqués** ya son citas literales dentro del motor de reglas (componente 2);
- las **preguntas de especificación** ya son el `FIELD_GUIDE`, que el §3.7 define como *"estática, escrita a mano... no improvisación del modelo"*.

**Sus dos consumidores fueron implementados estáticamente en otra parte.** Queda un índice de 104 documentos que nadie consulta.

Y la guía del evento lo advierte en la página 9:

> *"skip this group entirely if your idea does not truly depend on specific documents. RAG is the single easiest thing to over-build in a short sprint."*

Sumen que la persona C necesita internet, embeddings y 104 documentos indexados: **el mayor costo de setup y la menor superficie de demo del equipo.**

**Pronóstico realista:** al minuto 150 el RAG es un Chroma que nadie llama, o se abandona. 4/5 en un 20 %.

## Segundo más débil: el candado (componente 4)

Descrito así: *"verifica que esté copiado literalmente del correo. Si no lo encuentra, lo borra."*

Prueben contra la entrada desordenada real que es su razón de existir:

| El correo dice | El modelo extrae | ¿Substring? |
|---|---|---|
| `1.350 W` | `1350` | ❌ se borra |
| `treinta y ocho grados` | `38` | ❌ se borra |
| `38 °C` | `38.0` | ❌ según normalización |
| `2000x800x600` | `2000` | ✅ |

**Falsos positivos altos justo en el tipo de texto para el que se construyó, y falla en silencio.**

Si un juez pide pegar su propio correo — y *"judges react to what they can click"* — los campos desaparecen sin explicación y la herramienta parece rota en el peor momento posible.

**Dos cambios en el mismo bloque de código:**

1. **Normalizar ambos lados antes de comparar:** separadores de miles, coma vs punto decimal, y las diez palabras-número frecuentes.
2. **No borrar en silencio.** Degradar a ❌ con la razón: *"extraje 1350 W pero no pude verificarlo literalmente contra el texto"*.

Eso no es una falla — **es el candado funcionando en pantalla.** Convierte el mayor riesgo de demo en la mejor prueba.

---

# 4 · ¿Cabe en 3,5 horas con 4 personas?

**Sí, a aproximadamente el 70 % del alcance escrito. Como está, no.**

La guía dice ~35 min para demo y *"roughly 3 to 3:30 of real build"*. Contra eso, el alcance escrito tiene **doce** entregables:

1. Schema de ~20 campos con enums y defaults
2. Extracción LLM con spans de evidencia por campo
3. Candado de verificación literal
4. Guardrail de fuera-de-alcance
5. Compuerta de 4 familias con veredicto + cita
6. Filtro de producto sobre tres tablas (capacidad, voltaje, NEMA, encaje mecánico)
7. `FIELD_GUIDE`: 8 filas × 5 columnas = **40 celdas escritas a mano**
8. RAG sobre 104 documentos
9. UI de 4 fases con badges tri-estado y tooltips de evidencia
10. Generador de brief
11. 3 correos precargados
12. Redactor de correo al cliente

## Lo que sobra, en orden

**1. El flag `expertise: experto | novato` (§3.2)** — *(−25 min)*
Duplica estados de UI y superficie de prueba. **La demo solo usa novato.** Ahí mismo lo dicen. Envíen novato y ya.

**2. El correo redactado para reenviar al cliente (fase 2)** — *(−25 min, recuperable como stretch)*
Segunda ruta de generación con su prompt y su modo de falla, en el paso 4 de 5, cuando el juez ya está convencido. Las preguntas con su razón cargan el valor solas.

**3. UI para `housing_color`, `solar_load`, `wind_exposure`, `ambient_temp_min_c`** — *(−15 min)*
No bloquean nada y el caso demo es washdown interior. Déjenlos en el schema como pass-through; no les construyan fila.

## Lo que NO recortar

**El tercer caso demo (las sirenas).** Es el guardrail más barato que existe — un clasificador de dominio sobre una entrada — y es la evidencia directa del componente 4. Cuesta 10 minutos y vale 20 %.

## El riesgo de calendario que no está en el documento

El §"Cómo se reparte" dice que hay que acordar la forma del objeto antes de tocar código. Instinto correcto, ejecución insuficiente: **acordar no desbloquea a nadie.**

A (extracción con spans) es la pieza más lenta, y B, C y D consumen su salida. Si esperan al `ProjectSpec` real, hay tres personas ociosas hasta el minuto 90.

> **Minuto 0-10, antes de cualquier otra cosa:** una persona escribe `schema.py` **y un `EXAMPLE_SPEC` fijo con el caso de Barranquilla ya resuelto a mano**, y lo commitea. Los otros tres construyen contra ese fixture toda la mañana. A conecta lo real cuando esté.

Diez minutos que compran una hora.

*(Nota: dicen que "B y D no necesitan internet". Cierto — pero sí necesitan el objeto. El fixture es lo que hace verdadera esa frase.)*

**La integración no está asignada a nadie.** En un build de 4 personas son 30-40 minutos y siempre cae en quien termine primero, que suele ser nadie.

> **B termina primero** (Python puro, sin I/O). Asígnenle la integración desde el minuto ~150 **desde ya**.

---

# 5 · Auditoría de citas

## Método

Los marcadores de pie del texto extraído caen en las líneas **19, 71, 139, 224, 256, 329, 405, 481, 556, 602 y 656** → páginas 1 a 11, y el marcador va **al final** de su página. Con eso la numeración es verificable, no inferida. Esto cierra el pendiente del §4.

## ✅ Verificado correcto

| Cita | Veredicto |
|---|---|
| Matriz de 4 tecnologías → **p.2** | ✅ líneas 29-33 |
| *"Electronics are typically most efficient..."* → **p.2** | ✅ línea 44 *(pero ver 🟠 abajo)* |
| *"If the ambient temperature is always lower..."* → **p.4** | ✅ líneas 198-208 |
| *"If the ambient temperature is greater... active cooling is required"* → **p.6** | ✅ líneas 322-324 |
| *"If a NEMA Type 12/3R/4/4x rating is required..."* → **p.6** | ✅ líneas 325-326 |
| Encabezado COOLING UNITS → **p.6** | ✅ líneas 257-259 |
| DTS *"Also available in Outdoor... and Washdown"* → **p.7** | ✅ línea 355 |
| *"DTT Series Top Mount **Type 12***"* → **p.7** | ✅ línea 390 |
| **Las 9 filas de la tabla DTS** (capacidad, voltajes, dimensiones) | ✅ las nueve, exactas |
| **Las 5 citas del tutorial de PSS** | ✅ las cinco, textuales |
| Aritmética del §5 | ✅ 1 350 · 1 485 · 5 067 · 1,32 % · 38,1 % |

## 🔴 `"avoid costly oversizing or dangerous undersizing"` — **no está en el catálogo**

Grep sobre el archivo completo:

- `oversizing` → **cero**
- `undersizing` → **cero**
- `dangerous` → **cero**
- Lo único con "costly" es la línea 52: *"Minimizes the chance of failure or costly downtime"* — otra frase, otro sentido.

El §4.2 la atribuye a *"Cat. NA"* y el §5 la usa en un veredicto: *"el catálogo advierte contra costly oversizing"*.

> **Un proyecto cuya tesis entera es "no inventamos nada" lleva una cita inventada en su motor de reglas.**

Si un juez abre el PDF y hace Ctrl-F, no es un error de detalle: es el argumento del equipo derrumbándose en vivo, y es el tipo de momento que los cinco jueces recuerdan al puntuar.

Puede venir de otro documento del corpus — el Compact catalogue, la web de PSS. **Ubíquenla o bórrenla. No hay opción intermedia.**

## 🔴 Filterfans: el catálogo da **CFM**, no m³/h

Línea 146: `CFM2 (Type 12)`. Los valores son 17, 38, 65, 169, 297, 462, 560 **CFM**.

El §4.3 dice *"series PF / PFA con caudal en m³/h"*. **Factor 1,699 de error.** PF 11000 son 17 CFM = 29 m³/h, no 17 m³/h.

No toca la demo (el shortlist es solo Cooling Units) pero está en el documento del que alguien va a transcribir la tabla, y quedaría en el repo.

*De paso:*
- Los voltajes omiten **115 V**, presente en toda la serie.
- El recorte máximo es **300×300** (PTF 1200), no 292×292.

## 🟠 `"Type 4X exige lazo cerrado"` — la pata es falsa

En la compuerta del §5, Cooling Units gana con dos argumentos: ambiente > objetivo interno ✅, y *"Type 4X exige lazo cerrado"*.

**El segundo no discrimina nada:**

- **PKS también es lazo cerrado** — línea 422: *"Isolates internal air from external air"*
- **PKS tiene variante 4/4X** — línea 477
- **PKS Mini es washdown-only** — línea 476
- **PWS también es lazo cerrado**

El requisito 4X elimina Filterfans y nada más. La pata buena es la de temperatura, y esa la tienen.

**Quiten la segunda antes de que un juez la use para mostrar que el motor razona de más.**

## 🟠 El 35 °C está anclado a la frase equivocada

Ver [pregunta 2](#-el-default-de-35-c-sale-de-una-frase-que-dice-que-la-electrónica-es-más-eficiente-cerca-de-95-eficiente-no-es-máximo-cuál-es-su-máximo-real-y-qué-le-pasa-a-su-compuerta-si-el-cliente-tolera-40-c). Re-anclar al tutorial de PSS.

## 🟠 Contradicción regla ↔ ejemplo en el DTS 31X5

Ver [pregunta 2](#-su-regla-dice-filtrar-modelos-cuyo-extremo-bajo-del-rango-supere-lo-requerido-5000-es-menor-que-5067-por-qué-el-dts-31x5-es-su-recomendado). Tres estados.

## 🟡 Menores

- **DTT 6801 (12 000–14 000 Btu/h) falta** en la transcripción del §4.3.
- **`enclosure_count = 1`** en el schema vs. **4 gabinetes** en el caso estrella del §5. O la extracción descarta un dato declarado — rompiendo la promesa de "mostramos lo que extrajimos" — o la UI muestra algo que el schema no sostiene.
- **El washdown del DTS 31X5:** su propia cita dice que la capacidad *"varía por voltaje y configuración"*. Washdown **es** una configuración. El ⚠️ está bien puesto pero la razón debería incluir las dos variables, no solo el voltaje. Los fortalece.

## ⚪ No verificable con los archivos entregados

**Las cuatro citas del §4.2.b vienen de `DTS_2017.pdf`, que no está entre los archivos que me pasaron.** Incluye **la regla del 10 %** — y esa regla produce el 5 067 del que cuelga todo el shortlist de la demo.

> Apliquen el mismo grep que apliqué yo. Si la cita del catálogo se cayó, esa hipótesis merece una prueba, no confianza.

---

# La única cosa que cambiaría

## Que la cita sea una llamada a herramienta, no un literal en el código

Hoy el motor de reglas devuelve `"cat. NA p.6"` como string. Que devuelva `cite("rule_ambient_gt_internal")`, y que esa función **consulte el corpus indexado y traiga el fragmento textual y su ubicación, recuperados en ejecución**.

Un cambio, cinco problemas:

1. **Progress → nivel 4 defendible.** Cada afirmación en pantalla queda literalmente respaldada por una llamada a knowledge tool, con traza que se puede mostrar. Es el 30 % que hoy está en el aire.
2. **Checklist → el RAG pasa de decorativo a ser el componente más ejercitado de la app.** Misma persona, mismo trabajo, ahora en la ruta crítica y demostrable. Recupera el punto más probable de perder del 20 %.
3. **"No inventamos" se vuelve mecánicamente cierto en runtime**, no una afirmación sobre su disciplina al transcribir.
4. **Habría atrapado el `"costly oversizing"` solo.** Una búsqueda de un span que no existe en el corpus falla ruidosamente. Es precisamente lo que su producto le promete al usuario — aplicado a ustedes mismos.
5. **Mata la pregunta del juez.** *"Muéstrame la llamada"* pasa de ser el peor momento de la ronda al mejor.

**Costo:** ~40 minutos de la persona C.
**De dónde salen:** del flag experto/novato y del correo redactado. Los dos recortes de la pregunta 4 pagan esto exacto, con margen.

**Versión mínima si el tiempo aprieta:** una sola función `cite(rule_id)` que hace lookup contra el corpus indexado y devuelve el verbatim. No hace falta que sea semántica ni vectorial. Tiene que ser **una llamada real contra un documento real**, y tienen que poder **abrir la traza delante del juez**.

---

# Checklist de acción

## Antes de escribir código (minutos 0-15)

- [ ] `schema.py` + `EXAMPLE_SPEC` con el caso Barranquilla resuelto a mano, commiteado. **Los otros tres construyen contra el fixture.**
- [ ] Grep del corpus por `oversizing` / `undersizing`. **Ubicar o borrar la cita.**
- [ ] Grep del corpus por las 4 citas de `DTS_2017` — especialmente la regla del 10 %.
- [ ] Recortar: flag experto/novato, correo redactado, UI de los 4 campos no bloqueantes.
- [ ] Asignar la integración a B desde el minuto ~150.
- [ ] Acordar: un commit por componente terminado.

## Correcciones de contenido (30 min repartidos)

- [ ] Re-anclar `internal_temp_max_c = 35` al **tutorial de PSS**, no al catálogo p.2. Hacerlo editable en pantalla, marcado 🟡.
- [ ] Filtro de producto a **tres estados** (OK / VERIFICAR / NO). Alinea regla y ejemplo.
- [ ] Generalizar la regla de rating: *"la serie no documenta variante 4/4X en esta fuente"* → cubre DTI **y** DTT.
- [ ] Quitar *"Type 4X exige lazo cerrado"* como argumento a favor de Cooling Units.
- [ ] Filterfans: **CFM**, no m³/h. Añadir 115 V. Añadir DTT 6801.
- [ ] Resolver `enclosure_count`: o soporta N, o el correo demo dice un gabinete.

## Candado (20 min)

- [ ] Normalizar ambos lados: separadores de miles, coma/punto decimal, palabras-número.
- [ ] **No borrar en silencio** — degradar a ❌ con la razón visible.

## Demo (los últimos 35 min, no negociables)

- [ ] **Reordenar el guion para abrir con el rechazo de los 22 kW.** Es el activo más fuerte y hoy no está en los cinco pasos.
- [ ] Ensayar dos veces en voz alta.
- [ ] Tener la traza de `cite()` lista para abrirla si preguntan.
- [ ] Respuesta de 15 segundos a *"PSS ya hace esa entrevista"* — ya la tienen escrita, memorizarla.

---

*Auditoría hecha contra los archivos entregados. Las citas de `DTS_2017.pdf` no pudieron verificarse porque el archivo no estaba incluido.*
