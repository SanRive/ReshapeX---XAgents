# Demo — Engineering Copilot Pfannenberg

**AgentSprint · EAFIT Medellín · 2026-07-25**
Duración objetivo: **5 minutos** de demo + 2 de preguntas.

---

## Antes de empezar — 60 segundos de preparación

| Paso | Qué hacer |
|---|---|
| 1 | Abre la app y **deja la pestaña cargada**. Arrancar en frío delante del jurado cuesta 20 s de compilación. |
| 2 | **Un solo servidor corriendo.** Los dos servidores comparten las cuatro API keys; si hay dos, competís por la misma cuota y la latencia se dispara. |
| 3 | Que **nadie más abra la app** desde el móvil mientras presentas, por lo mismo. |
| 4 | Vista **Cliente** seleccionada, chat vacío. |
| 5 | Ten esta guía o `guion-demo.txt` abierto en otra ventana. |

**Reparto sugerido:** uno conduce el ratón, otro narra. El que narra no mira la pantalla — mira al jurado.

---

## El arco de la demo

No es un recorrido de funcionalidades. Es **una tesis en cuatro movimientos**:

> El valor de este agente no está en lo que dice. Está en lo que **se niega** a decir.

1. Sabe lo que **no** sabe → guardrail de dominio
2. Se niega a **inventar** un número → el momento de los 22 kW
3. Decide con lo que tiene, y lo **cita** → la compuerta con 3 datos
4. Entrega algo que un ingeniero **puede usar** → el brief

---

## Movimiento 0 · El encuadre (30 s)

**No toques la pantalla todavía.** Esta frase va antes que cualquier clic:

> «Pfannenberg tiene un software de dimensionamiento, PSS, que resuelve el problema en cinco minutos. El problema es que llegar al punto de poder usar PSS toma tres días: perseguir al cliente por correo para sacarle la temperatura ambiente, la disipación real, el voltaje. Nosotros no reemplazamos PSS. Automatizamos los tres días.»

Ahora sí, señala la pantalla: la barra de «3 días → 5 min» del intake ya lo dice.

---

## Movimiento 1 · Sabe lo que no sabe (30 s)

**Clic:** botón `Fuera de alcance` → `Enviar`

Responde **instantáneo**. Señala el pie del mensaje:

```
Guardrail determinista · keyword «sirena» · respondido sin llamar al modelo
```

> «Lo primero que le enseñamos es lo que **no** sabe. Y fíjense en el pie: esto no lo decidió un modelo. Es código determinista que corre **antes** de gastar una llamada. Pfannenberg fabrica sirenas, pero ese catálogo no está cargado — así que cualquier modelo o nivel sonoro sería inventado.»

**Si un juez quiere probarlo en vivo**, invítalo. Funciona con entrada libre, no con el ejemplo:

| Escribe | Responde |
|---|---|
| `necesito enfriar agua de proceso a 8 grados` | lo identifica como **chiller**, otra línea |
| `¿tienen algo para calentar el gabinete?` | **calefacción**, familia distinta |
| `hola` | se presenta, en 40 ms, sin tocar el modelo |

---

## Movimiento 2 · El momento de los 22 kW (90 s) ★

Es **el momento de la demo**. Si solo te queda tiempo para uno, es este.

**Clic:** botón `Correo de Barranquilla` → `Enviar`. Tarda 4-7 s.

Mientras carga, narra:

> «Esto es un correo real, sin ordenar. Cuatro gabinetes, una zona que se lava a presión, 38 grados de ambiente. Nadie lo ha estructurado.»

Cuando responda, **señala primero el mensaje del cliente**, no la ficha:

> «Fíjense en las frases resaltadas dentro del propio correo. Eso es lo que la extracción usó como evidencia. No es un resumen: es la frase textual que respalda cada dato.»

Ahora la ficha, y **baja el ritmo**:

> «La ficha tiene tres estados. Verde: declarado, con la frase exacta. Ámbar: inferido, con la cita del catálogo. **Rojo: falta, y dice qué decisión queda trabada.**»

**Y aquí la frase que vale la demo entera** — señala `Disipación total · FALTA`:

> «El correo dice "dos variadores de 22 kW". Un chatbot escribe 22.000 W y pierde. Los 22 kW son el tamaño del motor, **no el calor que el variador suelta dentro del gabinete**. Son magnitudes distintas. El agente no lo convirtió, y el log de decisiones lo deja por escrito.»

**Pausa.** Deja que aterrice antes de seguir.

---

## Movimiento 3 · Decide con lo que tiene, y lo cita (60 s)

Sin tocar nada, señala los veredictos de la compuerta:

> «Y fíjense en algo: **no sabe la carga térmica y ya ha descartado dos tecnologías.** Con tres datos —ambiente, ubicación, suciedad— ya puede decir que un filterfan no sirve aquí, porque el ambiente está por encima del objetivo interno y porque introduciría aire exterior rompiendo el rating de lavado.»

Señala las citas bajo cada veredicto:

> «Cada veredicto con su cita: documento, página, texto literal. Sin cita no sale a pantalla.»

---

## Movimiento 4 · El brief (90 s)

**Clic:** botón `Respuesta del cliente` → `Enviar`

> «El cliente responde con las pérdidas reales de hoja de datos.»

Cuando cargue, señala la disipación, ahora resuelta:

> «1 350 W. Y esto es una **suma** de valores que el cliente declaró, no una estimación. Sumar lo declarado es aritmética; derivar de la potencia nominal no lo es, y por eso antes se negaba.»

**Clic:** toggle `Ingeniero` arriba a la derecha.

Deja la vista quieta dos segundos antes de hablar. Luego, de arriba abajo:

1. **La banda de lectura rápida** — «las cuatro cifras que un ingeniero busca antes de leer nada: cuánto calor hay que sacar, cuánta capacidad hace falta, qué rating exige el entorno, qué familia aplica.»
2. **El disclaimer** — «y esto va arriba, no en letra pequeña: no es un dimensionamiento certificado.»
3. **Los tabs** — «mapeado tab por tab al formato de PSS. El ingeniero no traduce nada.»
4. **El log de decisiones** — «y aquí está la prueba en papel de que el guardrail actuó.»
5. **Lo que no afirmamos** — «la sección que separa una pre-selección honesta de una recomendación con confianza falsa.»

**Cierre:**

> «PSS dimensiona en cinco minutos. Llegar a poder usar PSS toma tres días. Automatizamos los tres días.»

---

## Si algo se tuerce — no lo escondas

| Qué pasa | Qué haces |
|---|---|
| **Aparece el aviso del post-check** | **Enséñalo.** «El modelo intentó dar una cifra que no podía respaldar y el guardrail la sustituyó. Acaban de ver el sistema defendiéndose solo.» Vale más que cualquier explicación. |
| **El badge muestra fallback** (groq → mistral) | «El proveedor primario falló y cayó al secundario. El fallback es visible, no silencioso.» |
| **Va lento** (>15 s) | Rate limit por cuota compartida. Sigue narrando; no repitas el envío, que empeora. |
| **No responde nada** | «Fíjense en que la ficha **no se ha movido**. Ante un fallo no inventamos un turno: se dice la verdad y el estado queda intacto.» |
| **Se cae la red entera** | El guardrail de fuera de alcance y la vista ingeniero de un caso ya cargado siguen funcionando: son código puro. |

---

## Preguntas que van a caer

**«PSS ya hace esa entrevista, ¿qué agregaron?»**
> PSS es un formulario que exige un ingeniero que **ya tiene** las respuestas. Aquí el cliente escribe en prosa y el agente le enseña qué dato falta, dónde buscarlo y qué error no cometer. El valor no es el formulario: es el camino desde el desorden hasta un brief que PSS pueda tragar.

**«¿Cómo sé que no está inventando?»**
> Cada valor tiene o la frase literal del cliente, o una cita de catálogo. Lo que no tiene ninguna de las dos no sale: se marca en rojo. Y hay **dos** guardrails: uno sobre los datos y otro sobre la prosa del chat.

**«¿Está mockeado?»**
> 181 tests, sin mocks del LLM. Llama a proveedores reales con fallback verificado. Pueden escribir cualquier correo ahora mismo.

**«¿Y el precio?»**
> No lo damos, y es deliberado. Pfannenberg no publica lista de precios, y el coste de operación depende de una tarifa eléctrica local que no conocemos — la del catálogo es de Estados Unidos. Lo que sí damos es la corriente de cada modelo, citada.

**«¿Por qué no usaron un framework de agentes?»**
> Porque las reglas de ingeniería no pueden estar dentro del LLM. La compuerta y el filtro de producto son TypeScript puro sobre datos transcritos del catálogo con cita de página. El modelo extrae y redacta; **no decide**.

**«¿Qué le falta?»**
> Un camino corto para preguntas comparativas de catálogo, y verificar una a una las páginas de todas las citas. Y hay una decisión que tomamos y no escondemos: el agente no improvisa. Fuera de sus cuatro herramientas, la respuesta correcta es «eso lo ve el ingeniero de aplicación».

---

## Los tres textos, para copiar

### Fuera de alcance
```
Buenos días,

Necesitamos sirenas y balizas para señalización de emergencia en una subestación eléctrica. ¿Qué modelos manejan y qué nivel sonoro alcanzan?

Gracias.
```

### Correo de Barranquilla
```
Buenas tardes,

Estamos montando una línea de llenado nueva en nuestra planta de Barranquilla y necesitamos climatizar los tableros de control. Son 4 gabinetes iguales de 2000 x 800 x 600 mm, montados contra pared en la zona de proceso. La zona se lava a presión al final de cada turno.

Cada gabinete lleva dos variadores de 22 kW y un PLC. La planta trabaja 24/7 y la temperatura ambiente en esa zona llega a 38 °C en temporada seca.

¿Qué nos recomiendan?
```

### Respuesta del cliente — versión que cierra el shortlist
```
Revisé las hojas de datos: los 2 variadores declaran 650 W de pérdidas cada uno y 1 PLC 50 W. La alimentación en planta es 460 V trifásico y, por el lavado, los gabinetes son en acero inoxidable.
```

> **Variante avanzada, si sobra tiempo.** El texto original dice *«cada variador»* sin decir cuántos. Con ese, el agente **se niega a sumar** y pregunta — porque «es uno» y «no sé cuántos» no pueden ser lo mismo. Enseñar las dos seguidas es más fuerte que cualquiera por separado: primero el guardrail, después el resultado.

---

## Presupuesto de tiempo

| | Movimiento | Tiempo |
|---|---|---|
| 0 | Encuadre, sin tocar la pantalla | 0:30 |
| 1 | Sabe lo que no sabe | 0:30 |
| 2 | **El momento de los 22 kW** ★ | 1:30 |
| 3 | La compuerta con 3 datos | 1:00 |
| 4 | El brief y el cierre | 1:30 |
| | **Total** | **5:00** |

Si vas justo, **recorta el movimiento 3**, no el 2.
