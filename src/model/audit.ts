// ============================================================================
// TradeBlotter — Compliance · Audit (registro normativo auditable)
// Cada cierre deja traza: operador, cliente, representante, vía, línea,
// requerimiento en regla, confirmaciones front/BO, contrato, idoneidad (suitability),
// timeline del ciclo y versiones del ticket. Vistas: por ticket / empresa / operador.
// ============================================================================

export type Tone = "ok" | "warn" | "bad" | "neutral";

export type EstConfirm = "pendiente" | "confirmado" | "con-reparos" | "no-confirmado";
export type EstContrato =
  | "no-enviado" | "enviado-cdb" | "en-proceso-firma" | "sin-respuesta"
  | "firmado-cliente-pendiente-cdb" | "firmado-ambos" | "copias-enviadas";
export type EstLinea =
  | "vigente" | "vencida-autorizada" | "excedida-riesgos"
  | "excedida-gte-mesa" | "excedida-gte-gral" | "excedida-dueno";
export type EstSuit =
  | "idoneo-firmado-cdb" | "idoneo" | "aceptado-cliente"
  | "no-para-producto" | "en-proceso" | "sin-idoneidad";
export type Via =
  | "tradechat" | "llamada-grabada" | "llamada-mail-respaldo" | "mail" | "front-rfq" | "reunion-acta";

export const LABEL = {
  confirm: {
    "pendiente": "Pendiente", "confirmado": "Confirmado",
    "con-reparos": "Con reparos", "no-confirmado": "No confirmado",
  } as Record<EstConfirm, string>,
  contrato: {
    "no-enviado": "No enviado", "enviado-cdb": "Enviado (CDB)",
    "en-proceso-firma": "En firma cliente", "sin-respuesta": "Sin respuesta",
    "firmado-cliente-pendiente-cdb": "Firmado cliente · pend. CDB",
    "firmado-ambos": "Firmado por ambos", "copias-enviadas": "Copias enviadas",
  } as Record<EstContrato, string>,
  linea: {
    "vigente": "Vigente", "vencida-autorizada": "Vencida · autorizada",
    "excedida-riesgos": "Excedida · aut. Riesgos", "excedida-gte-mesa": "Excedida · aut. Gte Mesa",
    "excedida-gte-gral": "Excedida · aut. Gte Gral", "excedida-dueno": "Excedida · aut. Dueño",
  } as Record<EstLinea, string>,
  suit: {
    "idoneo-firmado-cdb": "Idóneo · firmado CDB", "idoneo": "Idóneo",
    "aceptado-cliente": "Aceptado cliente", "no-para-producto": "No para este producto",
    "en-proceso": "En proceso", "sin-idoneidad": "Sin idoneidad",
  } as Record<EstSuit, string>,
  via: {
    "tradechat": "TradeChat", "llamada-grabada": "Llamada grabada",
    "llamada-mail-respaldo": "Llamada + respaldo mail", "mail": "Mail",
    "front-rfq": "Front (RFQ)", "reunion-acta": "Reunión + acta",
  } as Record<Via, string>,
};

export const TONE = {
  confirm: { "confirmado": "ok", "pendiente": "warn", "con-reparos": "warn", "no-confirmado": "bad" } as Record<EstConfirm, Tone>,
  contrato: {
    "firmado-ambos": "ok", "copias-enviadas": "ok", "firmado-cliente-pendiente-cdb": "warn",
    "en-proceso-firma": "warn", "enviado-cdb": "warn", "sin-respuesta": "bad", "no-enviado": "bad",
  } as Record<EstContrato, Tone>,
  linea: {
    "vigente": "ok", "vencida-autorizada": "warn", "excedida-riesgos": "warn",
    "excedida-gte-mesa": "warn", "excedida-gte-gral": "warn", "excedida-dueno": "warn",
  } as Record<EstLinea, Tone>,
  suit: {
    "idoneo-firmado-cdb": "ok", "idoneo": "ok", "aceptado-cliente": "warn",
    "no-para-producto": "warn", "en-proceso": "warn", "sin-idoneidad": "bad",
  } as Record<EstSuit, Tone>,
};

export interface AuditEvento { ts: string; actor: string; detalle: string; }
export interface VersionTicket { v: number; fecha: string; nota: string; snap: Record<string, string | number>; }

export interface AuditTicket {
  id: string;
  fechaHora: string;
  operador: string;
  producto: string;
  lado: "compra" | "venta";
  montoUsd: number;
  plazoDias: number;
  empresa: string;
  tipoCliente: "Empresa" | "Fondo" | "Persona Natural";
  representante: string;
  cargoRep: string;
  via: Via;
  requerimientoOk: boolean;
  usoCapital: number;      // % uso Coto al operar
  linea: EstLinea;
  confirmFront: EstConfirm;
  confirmBO: EstConfirm;
  contrato: EstContrato;
  suit: EstSuit;
  estado: "Cerrado" | "Cerrado c/reparos" | "Anulado";
  eventos: AuditEvento[];
  versiones?: VersionTicket[];
}

// Idoneidad (suitability) por empresa, con versiones (resumen = última; detalle = todas)
export interface IdoneidadVersion {
  v: number; fecha: string; estado: EstSuit; firmante: string; cargo: string; poder: string;
  aprobadorExterno: string; proxRevision: string; medio: string; nota: string;
  productos: { prod: string; aceptado: boolean }[];
}
export interface IdoneidadEmpresa {
  empresa: string; tipo: "Empresa" | "Fondo" | "Persona Natural"; giro: string; rational: string;
  versiones: IdoneidadVersion[];
}

export const OPERADORES = ["Coto (operador CDB)", "M. del Campo", "P. Soto (Gte Mesa)"];

export const AUDIT: AuditTicket[] = [
  {
    id: "TAI-2601", fechaHora: "2026-11-10 09:14", operador: "Coto (operador CDB)",
    producto: "Forward simple", lado: "venta", montoUsd: 2_000_000, plazoDias: 90,
    empresa: "Importadora Andes SpA", tipoCliente: "Empresa", representante: "Ana Ríos", cargoRep: "CFO",
    via: "tradechat", requerimientoOk: true, usoCapital: 4.2, linea: "vigente",
    confirmFront: "confirmado", confirmBO: "confirmado", contrato: "firmado-ambos", suit: "idoneo-firmado-cdb",
    estado: "Cerrado",
    eventos: [
      { ts: "2026-11-10 09:12", actor: "Coto (operador CDB)", detalle: "Negociación iniciada por TradeChat con Ana Ríos (CFO)" },
      { ts: "2026-11-10 09:14", actor: "Coto (operador CDB)", detalle: "Condiciones ofrecidas: FWD venta USD 2M · 90d · 945,80" },
      { ts: "2026-11-10 09:15", actor: "Ana Ríos (CFO)", detalle: "Cliente aceptó las condiciones" },
      { ts: "2026-11-10 09:15", actor: "Sistema Riesgos", detalle: "Requerimiento de capital en regla · uso Coto 4,2% (Verde)" },
      { ts: "2026-11-10 09:16", actor: "Front", detalle: "Confirmación generada y enviada al cliente (mail)" },
      { ts: "2026-11-10 09:23", actor: "Ana Ríos (CFO)", detalle: "Cliente aceptó la confirmación" },
      { ts: "2026-11-10 09:41", actor: "Back Office", detalle: "BO recibió confirmación de cliente y de CDB · clearing iniciado" },
      { ts: "2026-11-10 17:30", actor: "Back Office", detalle: "Eventos contables generados (ristra R0)" },
    ],
  },
  {
    id: "TAI-2602", fechaHora: "2026-11-10 10:02", operador: "M. del Campo",
    producto: "FWD Mejorado Import", lado: "venta", montoUsd: 1_000_000, plazoDias: 180,
    empresa: "Agrosur Export Ltda.", tipoCliente: "Empresa", representante: "Luis Vera", cargoRep: "Tesorero",
    via: "llamada-grabada", requerimientoOk: true, usoCapital: 4.5, linea: "vigente",
    confirmFront: "confirmado", confirmBO: "pendiente", contrato: "en-proceso-firma", suit: "aceptado-cliente",
    estado: "Cerrado",
    eventos: [
      { ts: "2026-11-10 10:00", actor: "M. del Campo", detalle: "Negociación por llamada grabada (ref. grab. 2026-11-10-1000)" },
      { ts: "2026-11-10 10:02", actor: "M. del Campo", detalle: "Condiciones: FWD Mejorado Import 1M · 180d · strike 952" },
      { ts: "2026-11-10 10:05", actor: "Luis Vera (Tesorero)", detalle: "Cliente aceptó (modificó plazo de 150 a 180d)" },
      { ts: "2026-11-10 10:06", actor: "Sistema Riesgos", detalle: "Requerimiento en regla · uso Coto 4,5%" },
      { ts: "2026-11-10 10:08", actor: "Front", detalle: "Confirmación enviada al cliente" },
      { ts: "2026-11-10 10:20", actor: "Back Office", detalle: "Cliente aún no confirma la confirmación (pendiente)" },
    ],
    versiones: [
      { v: 1, fecha: "2026-11-10 10:02", nota: "Ingreso original", snap: { Monto: "USD 1.000.000", Plazo: "150d", Strike: 950.0, Lado: "venta" } },
      { v: 2, fecha: "2026-11-10 10:04", nota: "Ajuste de plazo pedido por cliente", snap: { Monto: "USD 1.000.000", Plazo: "180d", Strike: 950.0, Lado: "venta" } },
      { v: 3, fecha: "2026-11-10 10:05", nota: "Reprice por plazo", snap: { Monto: "USD 1.000.000", Plazo: "180d", Strike: 952.0, Lado: "venta" } },
      { v: 4, fecha: "2026-11-10 10:06", nota: "Monto ampliado", snap: { Monto: "USD 1.000.000", Plazo: "180d", Strike: 952.0, Lado: "venta" } },
      { v: 5, fecha: "2026-11-10 10:07", nota: "Confirmación de condiciones", snap: { Monto: "USD 1.000.000", Plazo: "180d", Strike: 952.0, Lado: "venta" } },
      { v: 6, fecha: "2026-11-10 10:08", nota: "Versión confirmada enviada", snap: { Monto: "USD 1.000.000", Plazo: "180d", Strike: 952.5, Lado: "venta" } },
    ],
  },
  {
    id: "TAI-2603", fechaHora: "2026-11-10 11:20", operador: "P. Soto (Gte Mesa)",
    producto: "Opción Call (compra)", lado: "compra", montoUsd: 3_000_000, plazoDias: 120,
    empresa: "Minera Tocopilla S.A.", tipoCliente: "Empresa", representante: "M. Fuentes", cargoRep: "Gte Finanzas",
    via: "reunion-acta", requerimientoOk: true, usoCapital: 6.1, linea: "excedida-riesgos",
    confirmFront: "confirmado", confirmBO: "confirmado", contrato: "firmado-cliente-pendiente-cdb", suit: "idoneo",
    estado: "Cerrado",
    eventos: [
      { ts: "2026-11-10 11:00", actor: "P. Soto (Gte Mesa)", detalle: "Reunión presencial · acta firmada adjunta" },
      { ts: "2026-11-10 11:20", actor: "P. Soto (Gte Mesa)", detalle: "Condiciones: compra Call USD 3M · 120d" },
      { ts: "2026-11-10 11:22", actor: "Oficial de Riesgos", detalle: "Línea del cliente excedida · autorizado por Riesgos (ticket #RA-331)" },
      { ts: "2026-11-10 11:25", actor: "M. Fuentes (Gte Finanzas)", detalle: "Cliente aceptó condiciones" },
      { ts: "2026-11-10 11:40", actor: "Front", detalle: "Confirmación enviada y aceptada" },
      { ts: "2026-11-10 12:10", actor: "Back Office", detalle: "Contrato firmado por cliente · pendiente firma CDB" },
    ],
  },
  {
    id: "TAI-2604", fechaHora: "2026-11-10 12:05", operador: "Coto (operador CDB)",
    producto: "Forward simple", lado: "compra", montoUsd: 5_000_000, plazoDias: 360,
    empresa: "Fondo Austral FI", tipoCliente: "Fondo", representante: "G. Mella", cargoRep: "Portfolio Manager",
    via: "front-rfq", requerimientoOk: true, usoCapital: 7.4, linea: "vencida-autorizada",
    confirmFront: "confirmado", confirmBO: "con-reparos", contrato: "enviado-cdb", suit: "en-proceso",
    estado: "Cerrado c/reparos",
    eventos: [
      { ts: "2026-11-10 12:05", actor: "G. Mella (PM)", detalle: "RFQ ingresado por el front del fondo" },
      { ts: "2026-11-10 12:06", actor: "Coto (operador CDB)", detalle: "Cotización enviada · FWD compra USD 5M · 360d" },
      { ts: "2026-11-10 12:07", actor: "Oficial de Riesgos", detalle: "Línea vencida · renovación autorizada vigente al cierre" },
      { ts: "2026-11-10 12:09", actor: "G. Mella (PM)", detalle: "Aceptó (idoneidad del fondo en proceso de actualización)" },
      { ts: "2026-11-10 12:30", actor: "Back Office", detalle: "Confirmación con reparos: falta mandato actualizado del fondo" },
    ],
  },
  {
    id: "TAI-2605", fechaHora: "2026-11-10 12:48", operador: "M. del Campo",
    producto: "Depósito Mejorado c/Opción", lado: "venta", montoUsd: 800_000, plazoDias: 90,
    empresa: "Juan Pérez (persona natural)", tipoCliente: "Persona Natural", representante: "Juan Pérez", cargoRep: "Titular",
    via: "mail", requerimientoOk: true, usoCapital: 4.3, linea: "vigente",
    confirmFront: "pendiente", confirmBO: "no-confirmado", contrato: "no-enviado", suit: "sin-idoneidad",
    estado: "Cerrado c/reparos",
    eventos: [
      { ts: "2026-11-10 12:48", actor: "M. del Campo", detalle: "Negociación por mail (hilo adjunto)" },
      { ts: "2026-11-10 12:50", actor: "Sistema Compliance", detalle: "ALERTA: cliente sin idoneidad vigente · requiere declaración antes de confirmar" },
      { ts: "2026-11-10 12:52", actor: "Juan Pérez (Titular)", detalle: "Aceptó condiciones por mail" },
      { ts: "2026-11-10 12:55", actor: "Front", detalle: "Confirmación pendiente de envío hasta resolver idoneidad" },
    ],
  },
  {
    id: "TAI-2606", fechaHora: "2026-11-10 13:30", operador: "P. Soto (Gte Mesa)",
    producto: "FWD Mejorado Export", lado: "compra", montoUsd: 2_500_000, plazoDias: 180,
    empresa: "Retail Pacífico SpA", tipoCliente: "Empresa", representante: "C. Díaz", cargoRep: "Gerente",
    via: "llamada-mail-respaldo", requerimientoOk: true, usoCapital: 5.6, linea: "excedida-gte-mesa",
    confirmFront: "confirmado", confirmBO: "confirmado", contrato: "firmado-ambos", suit: "no-para-producto",
    estado: "Cerrado c/reparos",
    eventos: [
      { ts: "2026-11-10 13:28", actor: "P. Soto (Gte Mesa)", detalle: "Llamada no grabada · respaldo por mail adjunto (obligatorio)" },
      { ts: "2026-11-10 13:30", actor: "P. Soto (Gte Mesa)", detalle: "Condiciones: FWD Mejorado Export 2,5M · 180d" },
      { ts: "2026-11-10 13:31", actor: "Gte Mesa", detalle: "Línea excedida · autorizada por Gte de Mesa" },
      { ts: "2026-11-10 13:33", actor: "Compliance", detalle: "Idoneidad vigente pero NO cubre este producto · reparo registrado" },
      { ts: "2026-11-10 13:34", actor: "C. Díaz (Gerente)", detalle: "Cliente aceptó, declara entender el producto" },
      { ts: "2026-11-10 14:10", actor: "Back Office", detalle: "Contrato firmado por ambos · copias pendientes" },
    ],
  },
  {
    id: "TAI-2607", fechaHora: "2026-11-10 14:15", operador: "Coto (operador CDB)",
    producto: "Opción Put (compra)", lado: "compra", montoUsd: 1_200_000, plazoDias: 90,
    empresa: "Importadora Andes SpA", tipoCliente: "Empresa", representante: "Ana Ríos", cargoRep: "CFO",
    via: "tradechat", requerimientoOk: true, usoCapital: 4.6, linea: "excedida-dueno",
    confirmFront: "confirmado", confirmBO: "confirmado", contrato: "copias-enviadas", suit: "idoneo-firmado-cdb",
    estado: "Cerrado",
    eventos: [
      { ts: "2026-11-10 14:13", actor: "Coto (operador CDB)", detalle: "Negociación por TradeChat con Ana Ríos (CFO)" },
      { ts: "2026-11-10 14:15", actor: "Coto (operador CDB)", detalle: "Condiciones: compra Put USD 1,2M · 90d" },
      { ts: "2026-11-10 14:16", actor: "Dueño (poder de autorización)", detalle: "Línea excedida · autorizada por el dueño con poder" },
      { ts: "2026-11-10 14:18", actor: "Ana Ríos (CFO)", detalle: "Cliente aceptó y confirmó" },
      { ts: "2026-11-10 14:40", actor: "Back Office", detalle: "Firmado por ambos · copias enviadas" },
    ],
  },
];

export const IDONEIDADES: IdoneidadEmpresa[] = [
  {
    empresa: "Importadora Andes SpA", tipo: "Empresa",
    giro: "Importación de maquinaria agrícola", rational: "Cobertura de pagos de importación en USD",
    versiones: [
      {
        v: 1, fecha: "2024-10-12", estado: "aceptado-cliente", firmante: "Ana Ríos", cargo: "CFO", poder: "Poder amplio (esc. 2023)",
        aprobadorExterno: "Gte General CDB", proxRevision: "2026-10-12", medio: "Reunión + catálogo por mail",
        nota: "Primera declaración · aceptó entender Forward y Call",
        productos: [{ prod: "Forward", aceptado: true }, { prod: "Call", aceptado: true }, { prod: "Depósito c/Opción", aceptado: false }],
      },
      {
        v: 2, fecha: "2025-11-03", estado: "idoneo", firmante: "Ana Ríos", cargo: "CFO", poder: "Poder amplio (esc. 2023)",
        aprobadorExterno: "Gte de Mesa", proxRevision: "2027-11-03", medio: "Mail · consentimiento firmado",
        nota: "Actualización anual · incorpora Put",
        productos: [{ prod: "Forward", aceptado: true }, { prod: "Call", aceptado: true }, { prod: "Put", aceptado: true }, { prod: "Depósito c/Opción", aceptado: false }],
      },
      {
        v: 3, fecha: "2026-11-01", estado: "idoneo-firmado-cdb", firmante: "Ana Ríos", cargo: "CFO", poder: "Poder amplio (esc. 2023)",
        aprobadorExterno: "Gte General CDB", proxRevision: "2027-11-01", medio: "Reunión + acta · firmado CDB",
        nota: "Vigente · firmada por CDB",
        productos: [{ prod: "Forward", aceptado: true }, { prod: "Call", aceptado: true }, { prod: "Put", aceptado: true }, { prod: "FWD Mejorado", aceptado: true }, { prod: "Depósito c/Opción", aceptado: false }],
      },
    ],
  },
  {
    empresa: "Agrosur Export Ltda.", tipo: "Empresa",
    giro: "Exportación de fruta", rational: "Cobertura de flujos de exportación en USD",
    versiones: [
      {
        v: 1, fecha: "2026-09-20", estado: "aceptado-cliente", firmante: "Luis Vera", cargo: "Tesorero", poder: "Poder clase B",
        aprobadorExterno: "Gte de Mesa", proxRevision: "2027-09-20", medio: "Mail · catálogo enviado",
        nota: "Aceptó entender FWD Mejorado · firma CDB pendiente",
        productos: [{ prod: "Forward", aceptado: true }, { prod: "FWD Mejorado", aceptado: true }],
      },
    ],
  },
  {
    empresa: "Fondo Austral FI", tipo: "Fondo",
    giro: "Fondo de inversión", rational: "Cobertura cambiaria de cartera internacional",
    versiones: [
      {
        v: 1, fecha: "2026-11-02", estado: "en-proceso", firmante: "G. Mella", cargo: "Portfolio Manager", poder: "Mandato del fondo",
        aprobadorExterno: "—", proxRevision: "—", medio: "En proceso · falta mandato actualizado",
        nota: "Idoneidad en proceso de actualización",
        productos: [{ prod: "Forward", aceptado: true }],
      },
    ],
  },
  {
    empresa: "Juan Pérez (persona natural)", tipo: "Persona Natural",
    giro: "Persona natural", rational: "—",
    versiones: [],
  },
];

export const toneColor: Record<Tone, string> = {
  ok: "#34d399", warn: "#fbbf24", bad: "#f2574c", neutral: "#9fb0bf",
};
