import type { Producto, Pozo } from "../engine/capital";

// ---------------------------------------------------------------------------
// Productos base (estructuras madre)
// ---------------------------------------------------------------------------
export const PRODUCTOS: Producto[] = [
  {
    id: "spot",
    nombre: "Spot USD/CLP",
    desc: "Contado T+0/T+1/T+2 (riesgo de liquidación)",
    patas: [{ tipo: "spot", lado: "venta", factor: 0.0 }],
  },
  {
    id: "fwd_simple",
    nombre: "Forward simple",
    desc: "Fwd USD/CLP",
    patas: [{ tipo: "fwd", lado: "venta", factor: 1.0 }],
  },
  {
    id: "call",
    nombre: "Opción Call (compra)",
    desc: "Compra de call USD/CLP",
    patas: [{ tipo: "call", lado: "compra", factor: 1.0 }],
  },
  {
    id: "put",
    nombre: "Opción Put (compra)",
    desc: "Compra de put USD/CLP",
    patas: [{ tipo: "put", lado: "compra", factor: 1.0 }],
  },
  {
    id: "fwd_mej_import",
    nombre: "FWD Mejorado Import",
    desc: "Fwd venta USD + Compra Call",
    patas: [
      { tipo: "fwd", lado: "venta", factor: 1.0 },
      { tipo: "call", lado: "compra", factor: 1.0 },
    ],
  },
  {
    id: "fwd_mej_export",
    nombre: "FWD Mejorado Export",
    desc: "Fwd compra USD + Compra Put",
    patas: [
      { tipo: "fwd", lado: "compra", factor: 1.0 },
      { tipo: "put", lado: "compra", factor: 1.0 },
    ],
  },
  {
    id: "dep_mej_opcion",
    nombre: "Depósito Mejorado c/Opción",
    desc: "Depósito + venta de opción (prima)",
    patas: [
      { tipo: "call", lado: "venta", factor: 1.0 },
    ],
  },
];

export const productoPorId = (id: string) => PRODUCTOS.find((p) => p.id === id) ?? PRODUCTOS[0];

// ---------------------------------------------------------------------------
// Cartera de clientes y líneas (base de riesgos de la corredora)
// ---------------------------------------------------------------------------
export type TipoAcuerdo = "Margin Call" | "Unsecured" | "Mix";
export type EstadoLinea = "Activa" | "Cortada";

export interface Cliente {
  rut: string;
  razon: string;
  lineaMaxUsd: number;   // línea máxima autorizada por la corredora (USD)
  lineaUsadaUsd: number; // línea usada (USD)
  tipo: TipoAcuerdo;
  estado: EstadoLinea;
}

export const CLIENTES: Cliente[] = [
  { rut: "76.124.980-3", razon: "Importadora Andes SpA",      lineaMaxUsd: 3_000_000, lineaUsadaUsd: 1_240_000, tipo: "Unsecured",   estado: "Activa" },
  { rut: "77.345.112-K", razon: "Agrosur Export Ltda.",       lineaMaxUsd: 5_000_000, lineaUsadaUsd: 2_900_000, tipo: "Mix",         estado: "Activa" },
  { rut: "76.998.004-1", razon: "Minera Tocopilla S.A.",      lineaMaxUsd: 8_000_000, lineaUsadaUsd: 6_650_000, tipo: "Margin Call", estado: "Activa" },
  { rut: "77.010.556-7", razon: "Retail Pacífico SpA",        lineaMaxUsd: 2_000_000, lineaUsadaUsd: 1_980_000, tipo: "Unsecured",   estado: "Activa" },
  { rut: "76.450.223-9", razon: "Constructora Maipo Ltda.",   lineaMaxUsd: 1_500_000, lineaUsadaUsd:   900_000, tipo: "Mix",         estado: "Cortada" },
];

export const clientePorRut = (rut: string) => CLIENTES.find((c) => c.rut === rut) ?? null;

// ---------------------------------------------------------------------------
// Pozos de capital (requerimiento patrimonial CMF, en USD) — ejemplo editable.
// Coto: autorizado 500K, apertura 20K, libre 480K (ejemplo del usuario).
// CDB : hot al 95% por el libro de toda la mesa; el ticket de Coto puede matarla.
// ---------------------------------------------------------------------------
export const POZO_COTO_SEED: Pozo = {
  autorizado: 500_000,
  aperturaDia: 20_000,
  externo: 0,
  propio: 0,
};

export const POZO_CDB_SEED: Pozo = {
  autorizado: 3_000_000,
  aperturaDia: 1_500_000, // libro de Coto + resto de la mesa al abrir (50% usado)
  externo: 0,             // consumo nuevo por fuera (otros brokers + mercado) — slider
  propio: 0,              // tickets cerrados en este sistema
};

// Paridad USD/CLP (observado y tiempo real base; el RT tickea en runtime)
export const USDCLP_OBS = 969.8;  // fallback (real al 2026-11-10); en runtime se reemplaza por mindicador
export const UF_DIA = 41_302;     // fallback; en runtime se reemplaza por mindicador
