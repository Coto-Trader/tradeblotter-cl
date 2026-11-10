// ============================================================================
// TradeBlotter — Contabilidad: ristras pasivas + asientos por hito
// Indexado por ID_Estructura_Madre. Doble partida (Debe = Haber) en cada evento
// → no duplica ni deja cosas fuera. R2 reversa las cuentas de orden y el activo.
// ============================================================================

export interface LineaAsiento {
  cuenta: string;
  nombre: string;
  glosa: string;
  debe: number;
  haber: number;
}

export interface EventoContable {
  idMadre: string;
  seq: number;
  hitoCod: string;
  hito: string;
  fecha: string;
  moneda: string;
  lineas: LineaAsiento[];
}

// Plan de cuentas (ejemplo; contabilidad mapea a su maestro real por glosa/código)
const C = {
  cajaClp: ["1102", "Caja/Banco CLP"],
  activo: ["1301", "Activo por instrumentos derivados"],
  comPorPagar: ["2401", "Comisiones por pagar (brokers/socios)"],
  ingreso: ["4101", "Ingresos por intermediación"],
  gastoCom: ["6101", "Gasto comisiones distribuidas"],
  resultVal: ["5101", "Resultado por valorización (MtM)"],
  ordenD: ["7001", "Cuentas de orden — nocional derivados (D)"],
  ordenH: ["7002", "Cuentas de orden — nocional derivados (H)"],
} as const;

export interface RistraInput {
  idMadre: string;
  nocional: number;   // en moneda contable
  utilidad: number;   // spread reconocido
  comision: number;   // split a brokers/mesas
  mtmVal: number;     // MtM a la fecha de valorización
  fecha0: string;
  fechaVal: string;
  fechaVto: string;
  moneda: string;
}

const L = (c: readonly [string, string], glosa: string, debe: number, haber: number): LineaAsiento =>
  ({ cuenta: c[0], nombre: c[1], glosa, debe, haber });

export function generarEventos(i: RistraInput): EventoContable[] {
  // R0 — Apertura del producto base (T0)
  const r0: EventoContable = {
    idMadre: i.idMadre, seq: 0, hitoCod: "APERTURA", hito: "Apertura del producto base (T0)",
    fecha: i.fecha0, moneda: i.moneda,
    lineas: [
      L(C.ordenD, "Nocional en cuentas de orden", i.nocional, 0),
      L(C.ordenH, "Nocional en cuentas de orden", 0, i.nocional),
      L(C.activo, "Reconoce posición derivada (spread embebido)", i.utilidad, 0),
      L(C.ingreso, "Ingreso por intermediación (spread)", 0, i.utilidad),
      L(C.gastoCom, "Distribución a brokers/mesas (split)", i.comision, 0),
      L(C.comPorPagar, "Comisiones por pagar (split)", 0, i.comision),
    ],
  };

  // R1 — Valorización / ajuste MtM (de 'utilidad' reconocida a 'mtmVal')
  const delta = i.mtmVal - i.utilidad;
  const r1: EventoContable = {
    idMadre: i.idMadre, seq: 1, hitoCod: "VALORIZACION", hito: "Valorización / ajuste MtM",
    fecha: i.fechaVal, moneda: i.moneda,
    lineas: delta >= 0
      ? [L(C.activo, "Ajuste MtM (+)", delta, 0), L(C.resultVal, "Resultado por valorización", 0, delta)]
      : [L(C.resultVal, "Resultado por valorización", -delta, 0), L(C.activo, "Ajuste MtM (−)", 0, -delta)],
  };

  // R2 — Liquidación y cierre (reversa de orden + realización contra caja)
  const r2: EventoContable = {
    idMadre: i.idMadre, seq: 2, hitoCod: "LIQUIDACION", hito: "Liquidación y cierre al vencimiento",
    fecha: i.fechaVto, moneda: i.moneda,
    lineas: [
      L(C.ordenH, "Reversa nocional cuentas de orden", i.nocional, 0),
      L(C.ordenD, "Reversa nocional cuentas de orden", 0, i.nocional),
      L(C.cajaClp, "Cobro resultado calce NDF / entrega física", i.mtmVal, 0),
      L(C.activo, "Reversa activo por derivado", 0, i.mtmVal),
    ],
  };

  return [r0, r1, r2];
}

export function cuadra(e: EventoContable): { debe: number; haber: number; ok: boolean } {
  const debe = e.lineas.reduce((s, l) => s + l.debe, 0);
  const haber = e.lineas.reduce((s, l) => s + l.haber, 0);
  return { debe, haber, ok: Math.abs(debe - haber) < 0.5 };
}

// Ristra plana: ID|SEQ|HITO|FECHA|LINEA|CUENTA|GLOSA|DEBE|HABER|MONEDA
export function ristraPipe(e: EventoContable): string {
  return e.lineas
    .map((l, idx) =>
      [e.idMadre, e.seq, e.hitoCod, e.fecha, idx + 1, l.cuenta, l.glosa, Math.round(l.debe), Math.round(l.haber), e.moneda].join("|")
    )
    .join("\n");
}

export function ristraJSON(e: EventoContable): string {
  return JSON.stringify(
    {
      id_madre: e.idMadre, seq: e.seq, hito: e.hitoCod, fecha: e.fecha, moneda: e.moneda,
      asiento: e.lineas.map((l) => ({ cuenta: l.cuenta, glosa: l.glosa, debe: Math.round(l.debe), haber: Math.round(l.haber) })),
    },
    null, 2
  );
}
