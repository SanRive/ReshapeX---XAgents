# Engineering Copilot Pfannenberg

**PSS dimensiona en 5 minutos. Llegar al punto de poder usar PSS toma 3 días.
Automatizamos los 3 días.**

Un copiloto de thermal management para gabinetes eléctricos. El cliente conversa
en prosa desordenada; el agente extrae lo que PSS pediría, distingue lo declarado
de lo inferido de lo que falta —cada cosa con su cita—, corre la compuerta de
tecnología con el caso negativo argumentado, y emite un brief PSS-ready para el
ingeniero de aplicación.

AgentSprint · Universidad EAFIT, Medellín · 2026-07-25.

---

## 🔗 Probarlo ahora

[**https://27vv4slq-3000.use2.devtunnels.ms/**](https://engineercopilot.vercel.app/)

Instancia en vivo para el jurado del evento. Tres botones cargan casos reales:
*fuera de alcance*, *correo de Barranquilla* y *respuesta del cliente*. También
acepta entrada libre — escribe el correo que quieras.

> Es un túnel a una máquina de desarrollo levantado para la presentación: sin
> autenticación y con las claves de proveedor del equipo detrás. Se apaga al
> terminar el evento. Para uso real, desplegar y rotar las claves.

---

## Arrancar

```bash
npm install
```

```bash
npm run dev
```

Necesita `.env.local` con las claves de proveedor — ver `.env.example`. **La web
corre sin claves**: el guardrail de fuera de alcance, el motor de reglas, la
ficha, el brief y la descarga son código puro. Las claves hacen falta cuando se
conecte la extracción.

```bash
npm test
```

---

## La regla que no se rompe

**El agente nunca inventa un valor numérico.** Todo valor que sobrevive al
pipeline está citado textualmente de la entrada o viene de un default documentado
en la lista blanca. En particular: **nunca se deriva la disipación térmica (W) de
la potencia nominal de un motor o variador (kW)**. Son magnitudes distintas.

Eso no es una promesa que se le hace al modelo. Es un validador determinista que
corre después de cada llamada y degrada a `missing` cualquier campo cuya
evidencia no sea un substring literal de la entrada.

**La ficha de tres estados de la UI es la salida de ese validador.** El guardrail
es la pantalla principal, no plomería invisible.

---

## Mapa del repo

| Ruta | Qué es |
|---|---|
| `app/page.tsx` | La única ruta. Dos vistas —cliente e ingeniero— con un toggle. |
| `app/api/turn/route.ts` | El punto de integración. **Que lo abra una sola persona.** |
| `components/` | Chat, ficha de tres estados, compuerta, shortlist, vista ingeniero. |
| `lib/project-spec.ts` | **El contrato (T0.2).** Sobres, `DEFAULTS`, umbrales y derivados en Zod. |
| `lib/turn.ts` | La forma de un turno: el seam entre la UI y el backend. |
| `lib/fixtures/` | Los dos casos del contrato: Barranquilla y el fuera de alcance. |
| `lib/demo/` | Andamio de la UI: turno 2, compuerta y shortlist simulados. **Se borra** cuando aterricen A, B y C. |
| `lib/llm/` | Cadena de proveedores con rotación de claves. |
| `lib/brief/generate.ts` | El brief PSS-ready. Lo ensambla código, no el modelo. |
| `corpus_txt/` | 104 documentos extraídos a texto. Solo ~30 entran al retrieval. |
| `docs/` | Spec de diseño, reparto de tareas y **contratos de módulo**. |

**Qué falta y con qué firma exacta: `docs/contratos-de-modulo.md`.**

---

## Rotación de claves

`GROQ_API_KEYS` / `MISTRAL_API_KEYS` / `GOOGLE_API_KEYS` aceptan varias claves
separadas por coma. El pool las recorre en orden:

- **429** → la clave sale por una ventana de enfriamiento y luego vuelve.
- **401 / 402** → la clave muere para todo el proceso; esperar no lo arregla.
- **5xx, timeout, red** → no quema la clave. Es el proveedor, no la credencial.
- **400** → corta la cadena en seco. El payload es nuestro; rotar solo gasta
  claves.

Agotadas las de un proveedor, baja al siguiente escalón. **El fallback es visible,
no silencioso:** la UI muestra qué proveedor respondió y de cuáles vino cayendo.

`GET /api/turn` devuelve el estado del pool sin exponer ninguna clave.

---

## Lo que no afirmamos

No reemplazamos PSS. El dimensionamiento certificado —carga solar, material,
superficie efectiva, curvas de derating— es suyo. Nosotros entregamos el brief
que lo alimenta más una pre-selección citada. Cada salida lleva una sección
explícita de *"lo que no afirmamos"*, y no es un descargo legal: es la parte que
aguanta la pregunta difícil.
