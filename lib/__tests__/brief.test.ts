import { describe, expect, it } from "vitest";

import { briefFilename, generateBrief } from "../brief/generate";
import { DEMO_SCRIPT, emptySpec } from "../fixtures/conversation";
import { SPEC_TURNO_1 } from "../fixtures/barranquilla";

/**
 * El brief es el artefacto: lo que el ingeniero de aplicación se lleva a PSS.
 * Lo ensambla código sobre datos ya validados, así que lo que se comprueba es
 * que no se pierda nada por el camino — y sobre todo que no aparezca nada que
 * no venga del spec.
 */

const AT = new Date("2026-07-25T12:00:00Z");
const turnoIntake = DEMO_SCRIPT[1].result;
const turnoCierre = DEMO_SCRIPT[2].result;

describe("brief · estructura", () => {
  const md = generateBrief(turnoCierre, AT);

  it("abre declarando lo que NO es", () => {
    expect(md).toMatch(/^# Brief técnico PSS-ready/);
    expect(md).toContain("No es un dimensionamiento certificado");
  });

  it("mapea los tabs de PSS en su orden", () => {
    const enclosure = md.indexOf("## 1 · Enclosure");
    const environment = md.indexOf("## 2 · Environment");
    const heat = md.indexOf("## 3 · Heat Dissipation");
    expect(enclosure).toBeGreaterThan(-1);
    expect(environment).toBeGreaterThan(enclosure);
    expect(heat).toBeGreaterThan(environment);
  });

  it("lleva las secciones que nunca se caen", () => {
    expect(md).toContain("## Compuerta de tecnología");
    expect(md).toContain("## Shortlist · Cooling Units");
    expect(md).toContain("## Log de decisiones");
    expect(md).toContain("## Lo que no afirmamos");
  });

  it("cierra recordando quién decide y quién solo redacta", () => {
    expect(md).toContain("no decide");
  });
});

describe("brief · trazabilidad", () => {
  const md = generateBrief(turnoCierre, AT);

  it("cada campo declarado arrastra su fragmento literal", () => {
    expect(md).toContain("«hemos medido hasta 38 °C de ambiente»");
    expect(md).toContain("«2000 x 800 x 600 mm»");
    expect(md).toContain("«La alimentación en planta es 460 V trifásico»");
  });

  it("cada campo inferido arrastra documento y página", () => {
    expect(md).toContain("Thermal_Management_Catalog_12_Page-Final_2024 · p. 2");
  });

  it("marca como pendiente-PSS lo que no bloquea nada", () => {
    expect(md).toContain("pendiente-PSS");
  });

  it("con el caso cerrado ya no queda nada trabado", () => {
    // Cuando los ocho bloqueantes están, «traba:» no debe aparecer: si aparece,
    // el brief está pidiendo un dato que ya tiene.
    expect(md).not.toMatch(/traba:/);
  });

  it("pero en el turno 1 sí dice qué traba cada hueco", () => {
    const parcial = generateBrief(turnoIntake, AT);
    expect(parcial).toMatch(/traba:/);
    expect(parcial).toMatch(/traba:.*Shortlist/);
  });

  it("marca los tres estados con su símbolo", () => {
    expect(md).toContain("✅ declared");
    expect(md).toContain("⚠️ inferred");
    expect(md).toContain("· sin dato");
  });

  it("las cuatro familias salen, también las descartadas y con su cita", () => {
    for (const label of [
      "DTS Cooling Units",
      "PWS Air/Water Heat Exchangers",
      "Filterfan 4.0 + Exhaust Filters",
      "PKS Air/Air Heat Exchangers",
    ]) {
      expect(md, label).toContain(label);
    }
    expect(md).toContain("active cooling is required");
  });

  it("el shortlist lleva los rechazados con su razón", () => {
    expect(md).toContain("DTS 31X5");
    expect(md).toContain("DTT 6301");
    expect(md).toMatch(/DTT 6301.*rating/s);
  });

  it("las cifras son las del spec, no otras", () => {
    expect(md).toContain("1 350 W");
    expect(md).toContain("1 485 W");
    expect(md).toContain("5 067 Btu/h");
  });

  it("la lista de componentes va desglosada y cuadra", () => {
    expect(md).toContain("| Variador de frecuencia | 2 | 650 | 1300 |");
    expect(md).toContain("**Total** | | | **1350**");
  });

  it("el log de decisiones entra entero: es la prueba del guardrail", () => {
    expect(md).toContain("`guardrail`");
    expect(md).toMatch(/22 kW/);
  });

  it("no afirma capacidad neta ni sizing certificado", () => {
    expect(md).toMatch(/DIN 35\/35/);
    expect(md).toMatch(/PC = PD − PR/);
  });

  it("dice de frente que no hay precios", () => {
    expect(md).toMatch(/no publica lista de precios/i);
  });
});

describe("brief · estados parciales", () => {
  it("con la compuerta abierta pero sin shortlist, no inventa la sección", () => {
    const md = generateBrief(turnoIntake, AT);
    expect(md).toContain("## Compuerta de tecnología");
    expect(md).not.toContain("## Shortlist · Cooling Units");
    expect(md).toContain("## Datos pendientes del cliente");
  });

  it("las preguntas pendientes llevan su antipatrón", () => {
    const md = generateBrief(turnoIntake, AT);
    expect(md).toContain("**No sirve:**");
    expect(md).toMatch(/potencia nominal del motor/i);
  });

  it("un spec vacío produce un brief válido, no una excepción", () => {
    const md = generateBrief({
      spec: emptySpec(),
      gate: null,
      shortlist: null,
      questions: [],
      decisions: [],
      disclaimers: [],
      message: { id: "x", speaker: "agent", text: "" },
    }, AT);
    expect(md).toContain("# Brief técnico PSS-ready");
    expect(md).toContain("0 de 8 campos bloqueantes cerrados");
  });

  it("la cobertura de datos refleja el turno", () => {
    expect(generateBrief(turnoIntake, AT)).toContain("6 de 8 campos bloqueantes");
    expect(generateBrief(turnoCierre, AT)).toContain("8 de 8 campos bloqueantes");
  });
});

describe("nombre del archivo descargado", () => {
  it("sale del proyecto, sin tildes ni espacios", () => {
    expect(briefFilename(SPEC_TURNO_1, AT)).toBe(
      "brief-pss-linea-de-llenado-planta-barranquilla-2026-07-25.md",
    );
  });

  it("aguanta un spec sin nombre de proyecto", () => {
    expect(briefFilename(emptySpec(), AT)).toBe("brief-pss-proyecto-2026-07-25.md");
  });
});
