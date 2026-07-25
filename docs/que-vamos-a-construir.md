# Qué vamos a construir

**AgentSprint — AI Hackathon** · Universidad EAFIT, Medellín · 25 de julio de 2026, 8:00 a 12:00
Marca elegida: **Pfannenberg** · Equipo de 4 · ~3.5 horas de construcción

> Este documento es la versión sin jerga, para leer y entender de qué va el proyecto.
> El diseño técnico completo está en `docs/superpowers/specs/2026-07-24-pfannenberg-engineering-copilot-design.md`.
> Las reglas de trabajo para el código están en `CLAUDE.md`.

---

## El problema

Un tablero eléctrico es un armario metálico lleno de variadores, PLCs y cosas que se calientan. Si se calienta demasiado, se quema y para la planta. Hay que enfriarlo.

Hay cuatro formas de enfriarlo: un ventilador con filtro, un intercambiador aire-aire, un aire acondicionado, o un intercambiador aire-agua. Cuál te sirve depende de la situación — sobre todo de si el aire de afuera está más caliente o más frío que lo que necesitas adentro.

Pfannenberg vende las cuatro. Y tiene un software gratis, el **PSS**, que te dice exactamente qué modelo comprar. Funciona bien. El problema es que para usarlo necesitas diez datos exactos que casi nadie tiene a mano.

Entonces lo que pasa en la vida real es esto: llega un correo del cliente con la mitad de los datos. El ingeniero contesta pidiendo el resto. Pasan dos días. Vuelve la respuesta y falta otra cosa. Otro correo, otro día. **El software que resolvía todo en cinco minutos se acaba usando al tercer día.**

Ahí está el hueco. Nadie automatizó los tres días de correos.

---

## Lo que vamos a construir

Una página web con una caja de texto grande. Pegas el correo del cliente **tal como llegó, desordenado**, y le das a un botón. El programa hace seis cosas:

### 1. Lee el correo y saca lo que hay
Y te muestra de dónde lo sacó — al lado de cada dato aparece la frase exacta del correo que lo respalda.

### 2. Te dice qué falta y qué adivinó
🟢 **Verde:** estaba en el correo.
🟡 **Amarillo:** lo asumió, y te dice con qué fundamento.
🔴 **Rojo:** falta y no se puede seguir sin eso.

### 3. Con lo poquito que ya tiene, te da un veredicto
> *"Esto va con aire acondicionado. El ventilador no sirve porque afuera hace más calor que adentro. El aire-aire tampoco, por lo mismo. El aire-agua solo si hay agua de proceso."*

Cada descarte con la página del catálogo donde está escrito. Y esto lo dice **antes** de tener todos los datos: con tres cosas ya puede.

### 4. Hace las dos o tres preguntas que faltan
Pero no como un formulario: te explica para qué necesita cada dato y **dónde encontrarlo**. Y te redacta el correo listo para mandárselo al cliente.

### 5. Te propone modelos concretos
Dos o tres referencias reales, con su capacidad y su voltaje. Y — esto es lo bueno — **te muestra también los que descartó y por qué**.

### 6. Te escribe el documento final
Ordenado, con todo lo que el PSS va a pedir, en el mismo orden en que lo pide.

---

## La regla de oro

**El programa no se inventa números. Nunca.**

Ejemplo real: el correo dice *"dos variadores de 22 kW"*. Un chatbot normal haría una cuenta, te daría un número que suena razonable, y estaría mal — porque 22 kW es el tamaño del motor, no el calor que el variador suelta dentro del armario. Son dos cosas distintas.

El nuestro dice: *"eso no me sirve, necesito el dato real, y te digo dónde buscarlo en la hoja del fabricante."*

Y eso no es una promesa que le hacemos al modelo. **Hay un pedazo de código que revisa cada número que el modelo entrega y verifica que esté copiado literalmente del correo. Si no lo encuentra, lo borra.** El modelo no puede colar un invento aunque quiera.

Ese candado es lo mejor que tiene el proyecto, porque es la falla clásica de estas herramientas y nosotros la cerramos con código, no con buenas intenciones.

---

## Lo que NO vamos a hacer

- **No reemplazamos el PSS.** Ellos hacen el cálculo certificado. Nosotros entregamos el documento que lo alimenta.
- **No calculamos ingeniería térmica.** Si no nos dan el dato, lo marcamos como faltante. Punto.
- **No es un chatbot.** No hay conversación suelta. Es una herramienta de trabajo que produce un documento.

Y para el sprint nos limitamos a **climatización de tableros** — nada de sirenas, señalización, chillers ni calefactores. Si una idea nueva no cabe en la lista de arriba, no entra hoy. El riesgo número uno de una hackathon es construir de más.

---

## Por qué esto puede ganar

Casi todos los equipos van a hacer un chatbot que contesta preguntas sobre un catálogo. Nosotros hacemos algo que un ingeniero usaría el lunes.

El concurso premia especialmente dos cosas, y las dos nos favorecen:

- Que **las respuestas estén respaldadas en documentos reales** — todo lo nuestro sale del catálogo, con página.
- Que la solución sea **original**, que es justo donde un chatbot más pierde.

Y lo que más se suele criticar de la IA en un contexto de ingeniería es que se inventa datos. Nosotros llegamos con el candado puesto y se puede demostrar en vivo.

---

## La pregunta difícil, y su respuesta

Un juez que conozca Pfannenberg nos va a preguntar: **"el PSS ya hace esa entrevista, ¿qué agregaron ustedes?"**

Hay que tenerla lista, porque de ahí depende media nota:

> El PSS es un formulario. Exige un ingeniero que ya sabe todas las respuestas, sentado frente a diez campos, mientras el cliente escribe en prosa y no sabe qué datos hacen falta.
>
> Nosotros no hicimos otro formulario. Automatizamos el camino desde el correo desordenado hasta el punto en que el PSS es utilizable — extraer, distinguir lo declarado de lo asumido de lo faltante, y explicarle a alguien que no es experto dónde conseguir lo que falta.
>
> **El PSS dimensiona en cinco minutos. Llegar al punto de poder usarlo toma tres días. Automatizamos los tres días.**

---

## Cómo se reparte

Cuatro personas, cuatro pedazos:

| | Se encarga de |
|---|---|
| **A** | Leer el correo y sacar los datos, más el candado que verifica que nada esté inventado |
| **B** | El motor de reglas: la lógica que descarta tecnologías y filtra modelos, con sus citas |
| **C** | La búsqueda en los catálogos, para los "por qué" y las preguntas de especificación |
| **D** | La interfaz y el documento final |

**B y D no necesitan internet ni claves para arrancar.** Si el wifi de EAFIT está malo a las 8 de la mañana, la mitad del equipo trabaja igual.

Lo único que hay que acordar **antes** de tocar código es la forma del objeto de datos que conecta las cuatro partes. Si A y D no coinciden en eso, se pierde media hora en el merge.

---

## El demo, en 90 segundos

1. Pegar el correo
2. Ver la ficha con los verdes, amarillos y rojos
3. Ver cómo descarta tres de las cuatro tecnologías, con su razón
4. Contestar dos preguntas
5. Sacar el documento

Eso es todo. Y cada cosa que aparece en pantalla tiene detrás su cita.
