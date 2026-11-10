// ============================================================================
// TradeBlotter — Motor de capital (CMF NCG 562, Bloques 2/3)
// Doble pozo: CDB (corredora) y Coto (broker). El número que MANDA (deja o no
// deja operar) es el REQUERIMIENTO PATRIMONIAL; la exposición add-on va al lado.
// Canónico en USD; se muestra en CLP/USD con un toggle (×/÷ paridad).
// ============================================================================

export type Nivel = "verde" | "amarillo" | "rojo" | "negro";
export type Moneda = "USD" | "CLP";

/** Parámetros regulatorios (editables en UI). */
export interface ParamsCMF {
  capReqPct: number;      // 3% del APR  (requerimiento patrimonial)
  weightCorp: number;     // 100% ponderador corporativo
  addonDefaultPct: number;// 1.5% add-on FX general
  addonTramoPct: number;  // 1.0% add-on calibrado tramo 15–90 días
  tramoMinDias: number;   // 15
  tramoMaxDias: number;   // 90
}

export const PARAMS_CMF: ParamsCMF = {
  capReqPct: 0.03,
  weightCorp: 1.0,
  addonDefaultPct: 0.015,
  addonTramoPct: 0.010,
  tramoMinDias: 15,
  tramoMaxDias: 90,
};

/** Umbrales del semáforo sobre % de uso de la línea autorizada. */
export const SEMAFORO = { amarillo: 20, rojo: 60, negro: 80 } as const; // < = verde; >80 = hard stop

// ---------------------------------------------------------------------------
// Producto y patas
// ---------------------------------------------------------------------------
export type TipoPata = "fwd" | "call" | "put" | "spot";

export interface Pata {
  tipo: TipoPata;
  lado: "compra" | "venta";
  notionalUsd: number;   // nocional de la pata
}

export interface Producto {
  id: string;
  nombre: string;        // p.ej. "FWD Mejorado Import"
  desc: string;          // "Fwd venta + Compra Call"
  // factor de nocional por pata relativo al nocional de la estructura
  patas: { tipo: TipoPata; lado: "compra" | "venta"; factor: number }[];
}

/** add-on % según tramo de plazo (calibración 15–90 días). */
export function addonPct(tenorDias: number, p: ParamsCMF = PARAMS_CMF): number {
  return tenorDias >= p.tramoMinDias && tenorDias <= p.tramoMaxDias
    ? p.addonTramoPct
    : p.addonDefaultPct;
}

// ---------------------------------------------------------------------------
// Cálculo por ticket (T=0)
// ---------------------------------------------------------------------------
export interface CalculoTicket {
  notionalUsd: number;
  tenorDias: number;
  addon: number;          // add-on % aplicado
  exposicionUsd: number;  // EAD = MtM + Σ(add-on × nocional pata)  (MtM≈0 en T0)
  aprUsd: number;         // APR = exposición × ponderador
  requerimientoUsd: number; // requerimiento patrimonial = capReq% × APR  (manda)
  porPata: { tipo: TipoPata; lado: string; notionalUsd: number; addonUsd: number }[];
}

export function calcularTicket(
  producto: Producto,
  notionalUsd: number,
  tenorDias: number,
  modo: "patas" | "estructura" = "patas",
  p: ParamsCMF = PARAMS_CMF,
  mtmUsd = 0
): CalculoTicket {
  const a = addonPct(tenorDias, p);
  let exposicion = mtmUsd;
  const porPata: CalculoTicket["porPata"] = [];
  if (modo === "patas") {
    for (const pt of producto.patas) {
      const notP = notionalUsd * pt.factor;
      const addonUsd = notP * a;
      exposicion += addonUsd;
      porPata.push({ tipo: pt.tipo, lado: pt.lado, notionalUsd: notP, addonUsd });
    }
  } else {
    const addonUsd = notionalUsd * a;
    exposicion += addonUsd;
    porPata.push({ tipo: "fwd", lado: "venta", notionalUsd, addonUsd });
  }
  const apr = exposicion * p.weightCorp;
  const requerimiento = apr * p.capReqPct;
  return {
    notionalUsd,
    tenorDias,
    addon: a,
    exposicionUsd: exposicion,
    aprUsd: apr,
    requerimientoUsd: requerimiento,
    porPata,
  };
}

// ---------------------------------------------------------------------------
// Pozos de capital (en USD canónico)
// ---------------------------------------------------------------------------
/**
 * Un pozo = capacidad autorizada de REQUERIMIENTO patrimonial.
 *  - autorizado : techo autorizado
 *  - aperturaDia: consumo inicio de día (cartera vigente)
 *  - externo    : consumo por fuera (otros brokers + mercado). Solo CDB.
 *  - propio     : consumo por tickets cerrados en este sistema
 */
export interface Pozo {
  autorizado: number;
  aperturaDia: number;
  externo: number;
  propio: number;
}

export interface EstadoPozo {
  autorizado: number;
  consumo: number;     // apertura + externo + propio
  libre: number;       // autorizado - consumo  (puede ser negativo)
  pct: number;         // consumo / autorizado * 100
  exceso: number;      // max(0, consumo - autorizado)
  nivel: Nivel;
}

export function nivelDe(pct: number): Nivel {
  if (pct > SEMAFORO.negro) return "negro";
  if (pct > SEMAFORO.rojo) return "rojo";
  if (pct >= SEMAFORO.amarillo) return "amarillo";
  return "verde";
}

export function estadoPozo(z: Pozo): EstadoPozo {
  const consumo = z.aperturaDia + z.externo + z.propio;
  const libre = z.autorizado - consumo;
  const pct = z.autorizado > 0 ? (consumo / z.autorizado) * 100 : 0;
  return {
    autorizado: z.autorizado,
    consumo,
    libre,
    pct,
    exceso: Math.max(0, consumo - z.autorizado),
    nivel: nivelDe(pct),
  };
}

/** Pozo tras sumar el requerimiento de un ticket simulado. */
export function simularPozo(z: Pozo, reqTicket: number): EstadoPozo {
  return estadoPozo({ ...z, propio: z.propio + reqTicket });
}

// ---------------------------------------------------------------------------
// Veredicto de un ticket: ¿cabe? ¿mata la CDB? ¿en cuánto reviento?
// ---------------------------------------------------------------------------
export type Decision = "verde" | "amarillo" | "rojo" | "negro" | "cdb_stop";

export interface Veredicto {
  reqTicket: number;         // requerimiento USD del ticket
  coto: EstadoPozo;          // Coto tras simular
  cotoAntes: EstadoPozo;
  cdb: EstadoPozo;           // CDB tras simular
  cdbAntes: EstadoPozo;
  deltaCotoPct: number;
  deltaCdbPct: number;
  cabeCoto: boolean;         // no supera hard-stop de Coto (>80%)
  cabeCdb: boolean;          // no deja la CDB sobre su techo
  mataCdb: boolean;          // el ticket empuja la CDB sobre el techo
  excesoCdb: number;         // cuánto reviento la CDB (USD)
  excesoCoto: number;        // cuánto reviento mi línea (USD)
  decision: Decision;
  bloqueado: boolean;        // hard stop: no se puede cerrar
  requiereAprobacion: boolean; // rojo: aprobación manual del Oficial de Riesgos
  titulo: string;
}

export function veredicto(pCoto: Pozo, pCdb: Pozo, calc: CalculoTicket): Veredicto {
  const req = calc.requerimientoUsd;
  const cotoAntes = estadoPozo(pCoto);
  const cdbAntes = estadoPozo(pCdb);
  const coto = simularPozo(pCoto, req);
  const cdb = simularPozo(pCdb, req);

  const cabeCdb = cdb.consumo <= pCdb.autorizado;
  const mataCdb = !cabeCdb;
  const excesoCdb = Math.max(0, cdb.consumo - pCdb.autorizado);
  const excesoCoto = Math.max(0, coto.consumo - pCoto.autorizado);
  const cabeCoto = coto.pct <= SEMAFORO.negro; // hard-stop de Coto a >80%

  let decision: Decision;
  let bloqueado = false;
  let requiereAprobacion = false;
  let titulo = "";

  if (mataCdb) {
    decision = "cdb_stop";
    bloqueado = true;
    titulo = "MATA LA CDB — bloqueado";
  } else if (cdb.nivel === "negro") {
    decision = "cdb_stop";
    bloqueado = true;
    titulo = "CDB en hard-stop (>80%) — bloqueado";
  } else if (coto.nivel === "negro") {
    decision = "negro";
    bloqueado = true;
    titulo = "HARD STOP — línea sobre 80%";
  } else if (coto.nivel === "rojo") {
    decision = "rojo";
    requiereAprobacion = true;
    titulo = "Crítico — requiere aprobación de Riesgos";
  } else if (coto.nivel === "amarillo") {
    decision = "amarillo";
    titulo = "Consumo optimizado — evaluar colateral";
  } else {
    decision = "verde";
    titulo = "Operación viable — un click";
  }

  return {
    reqTicket: req,
    coto, cotoAntes, cdb, cdbAntes,
    deltaCotoPct: coto.pct - cotoAntes.pct,
    deltaCdbPct: cdb.pct - cdbAntes.pct,
    cabeCoto, cabeCdb, mataCdb, excesoCdb, excesoCoto,
    decision, bloqueado, requiereAprobacion, titulo,
  };
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------
export function fmtMoney(usd: number, moneda: Moneda, paridad: number): string {
  const v = moneda === "CLP" ? usd * paridad : usd;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (moneda === "CLP") {
    return sign + "$" + Math.round(abs).toLocaleString("es-CL");
  }
  // USD con separador; decimales solo si el monto chico no es entero
  const small = Math.round(abs * 100) / 100;
  return sign + "US$" + (abs >= 1000
    ? Math.round(abs).toLocaleString("en-US")
    : (Number.isInteger(small) ? small.toLocaleString("en-US") : small.toFixed(2)));
}

export function fmtPct(x: number, dec = 1): string {
  return x.toFixed(dec) + "%";
}

export const CSS_NIVEL: Record<Nivel, string> = {
  verde: "g-green", amarillo: "g-yellow", rojo: "g-red", negro: "g-black",
};
