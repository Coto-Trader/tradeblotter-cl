import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  calcularTicket, veredicto, estadoPozo, addonPct,
  fmtMoney, fmtPct, CSS_NIVEL, PARAMS_CMF,
  type Moneda, type Nivel, type Producto,
} from "./engine/capital";
import { store, type Ticket } from "./engine/store";
import {
  PRODUCTOS, productoPorId, CLIENTES, clientePorRut,
  USDCLP_OBS, UF_DIA,
} from "./model/seed";

const uid = () => Math.random().toString(36).slice(2, 9);
const nivelLabel: Record<Nivel, string> = { verde: "Verde", amarillo: "Amarillo", rojo: "Rojo", negro: "Hard stop" };
const dot: Record<Nivel, string> = { verde: "#34d399", amarillo: "#fbbf24", rojo: "#f2574c", negro: "#b4232a" };

function useStore() {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.get(),
  );
}

// Dólar RT simulado (tickea alrededor del observado)
function useLiveRate(base: number) {
  const [r, setR] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      setR((prev) => {
        const drift = (Math.random() - 0.5) * 0.9;
        const next = prev + drift;
        return Math.max(base - 6, Math.min(base + 6, next));
      });
    }, 1500);
    return () => clearInterval(id);
  }, [base]);
  return r;
}

export function App() {
  const st = useStore();
  const rt = useLiveRate(USDCLP_OBS);
  const [moneda, setMoneda] = useState<Moneda>("CLP");
  const par = USDCLP_OBS; // conversiones de montos con el observado (estable)

  // ---- estados de pozos ----
  const eCoto = estadoPozo(st.pozoCoto);
  const eCdb = estadoPozo(st.pozoCdb);

  // ---- quick quote ----
  const [rut, setRut] = useState(CLIENTES[0].rut);
  const [prodId, setProdId] = useState(PRODUCTOS[0].id);
  const [notional, setNotional] = useState(2_000_000);
  const [tenor, setTenor] = useState(30);
  const [modo, setModo] = useState<"patas" | "estructura">("patas");
  const [spreadPips, setSpreadPips] = useState(120);
  const [aprob, setAprob] = useState(false);

  const cliente = clientePorRut(rut);
  const producto = productoPorId(prodId);
  const cortada = cliente?.estado === "Cortada";

  const calc = useMemo(
    () => calcularTicket(producto, notional, tenor, modo),
    [producto, notional, tenor, modo]
  );
  const ver = useMemo(
    () => veredicto(st.pozoCoto, st.pozoCdb, calc),
    [st.pozoCoto, st.pozoCdb, calc]
  );

  const spreadPesos = useMemo(() => (spreadPips / 100), [spreadPips]);
  const utilidadUsd = useMemo(() => notional * (spreadPips / 10000), [notional, spreadPips]);

  function cerrar() {
    if (cortada) return;
    if (ver.bloqueado) return;
    if (ver.requiereAprobacion && !aprob) return;
    const t: Ticket = {
      id: uid(), ts: Date.now(), usuario: "Coto",
      rut: cliente!.rut, razon: cliente!.razon,
      productoId: producto.id, productoNombre: producto.nombre,
      notionalUsd: notional, tenorDias: tenor, modo,
      spreadPips, spreadPesos,
      exposicionUsd: calc.exposicionUsd, requerimientoUsd: calc.requerimientoUsd,
      nivelCoto: ver.coto.nivel,
      estado: ver.requiereAprobacion ? "aprobado-riesgo" : "cerrado",
    };
    store.addTicket(t);
    setAprob(false);
  }

  const M = (usd: number) => fmtMoney(usd, moneda, par);
  const pctCDBrt = eCdb.pct;
  const pctCotoRt = eCoto.pct;

  return (
    <div>
      {/* Ribbon suite */}
      <div className="ribbon">
        <a href="https://tradeai.cl">Suite TradeAI</a><span className="sep">/</span>
        <a href="https://tradefx.cl">TradeFX</a><span className="sep">·</span>
        <a href="https://traderf.cl">TradeRF</a><span className="sep">·</span>
        <span className="here">TradeBlotter</span>
        <span className="spacer" />
        <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>Capital & Riesgo · CMF NCG 562</span>
      </div>

      {/* Tape / indicador */}
      <div className="tape">
        <div className="cell"><span className="k">USD/CLP Obs.</span><span className="v">{USDCLP_OBS.toFixed(1)}</span></div>
        <div className="cell"><span className="k">USD/CLP Real Time</span><span className={"v " + (rt >= USDCLP_OBS ? "up" : "down")}>{rt.toFixed(2)} {rt >= USDCLP_OBS ? "▲" : "▼"}</span></div>
        <div className="cell"><span className="k">UF del día</span><span className="v">{UF_DIA.toLocaleString("es-CL")}</span></div>
        <div className="cell gauge"><span className="k">% Uso Capital Corredora</span><span className={"v " + CSS_NIVEL[eCdb.nivel]}>{fmtPct(pctCDBrt)}</span></div>
        <div className="cell gauge"><span className="k">% Uso Capital Coto</span><span className={"v " + CSS_NIVEL[eCoto.nivel]}>{fmtPct(pctCotoRt)}</span></div>
        <span className="spacer" />
        <div className="cell" style={{ justifyContent: "center" }}>
          <span className="k">Ver en</span>
          <div className="seg" style={{ marginTop: 2 }}>
            <button className={moneda === "CLP" ? "on" : ""} onClick={() => setMoneda("CLP")}>CLP</button>
            <button className={moneda === "USD" ? "on" : ""} onClick={() => setMoneda("USD")}>USD</button>
          </div>
        </div>
      </div>

      <div className="header">
        <h1>Trade<span className="accent">Blotter</span> · Control de Consumo de Capital</h1>
        <div className="sub">Doble pozo CDB / Coto · requerimiento CMF manda, exposición add-on al lado · hard-stop si revienta la CDB o la línea</div>
      </div>

      <div className="main">
        {/* ===== POZOS ===== */}
        <div className="cols">
          <PoolCard
            tipo="cdb" nombre="CDB · Corredora" sub="Techo patrimonial de toda la mesa"
            e={eCdb} M={M}
            extra={
              <label className="field" style={{ marginTop: 10 }}>
                <span className="lbl">Consumo por fuera (otros brokers + mercado)</span>
                <div className="row-inline">
                  <input type="range" className="slider" min={0} max={Math.round(st.pozoCdb.autorizado - st.pozoCdb.aperturaDia + 400000)} step={10000}
                    value={st.pozoCdb.externo}
                    onChange={(e) => store.setPozoCdb({ externo: Number(e.target.value) })} />
                  <span className="mono" style={{ minWidth: 92, textAlign: "right", color: "var(--text)" }}>{M(st.pozoCdb.externo)}</span>
                </div>
              </label>
            }
          />
          <PoolCard
            tipo="coto" nombre="Coto · Broker" sub="Mi línea autorizada (todos mis productos)"
            e={eCoto} M={M}
            extra={
              <div className="grid c3" style={{ marginTop: 10 }}>
                <label className="field"><span className="lbl">Autorizado</span>
                  <input type="number" value={st.pozoCoto.autorizado} onChange={(e) => store.setPozoCoto({ autorizado: Number(e.target.value) })} /></label>
                <label className="field"><span className="lbl">Apertura día</span>
                  <input type="number" value={st.pozoCoto.aperturaDia} onChange={(e) => store.setPozoCoto({ aperturaDia: Number(e.target.value) })} /></label>
                <label className="field"><span className="lbl">Tickets hoy</span>
                  <input type="number" value={Math.round(st.pozoCoto.propio)} readOnly /></label>
              </div>
            }
          />
        </div>

        {/* ===== GRILLA REGULATORIA (la que manda) ===== */}
        <GrillaRegulatoria par={par} />

        {/* ===== QUICK QUOTE ===== */}
        <div className="panel">
          <div className="panel-head">
            <h2>Quick Quote · Análisis de Requerimiento</h2>
            <span className="spacer" />
            <span className="hint">¿Cabe el ticket? ¿Mata la CDB? ¿En cuánto reviento?</span>
          </div>
          <div className="panel-body">
            <div className="cols">
              {/* Inputs */}
              <div>
                <div className="grid c2">
                  <label className="field"><span className="lbl">Cliente</span>
                    <select value={rut} onChange={(e) => setRut(e.target.value)}>
                      {CLIENTES.map((c) => (
                        <option key={c.rut} value={c.rut}>{c.razon}{c.estado === "Cortada" ? " — CORTADA" : ""}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field"><span className="lbl">Producto</span>
                    <select value={prodId} onChange={(e) => setProdId(e.target.value)}>
                      {PRODUCTOS.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </label>
                </div>
                <div className="resolved" style={{ margin: "6px 2px 10px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
                  {producto.desc} · add-on {fmtPct(addonPct(tenor) * 100, 1)} ({tenor >= PARAMS_CMF.tramoMinDias && tenor <= PARAMS_CMF.tramoMaxDias ? "tramo 15–90d" : "general"})
                </div>
                <div className="grid c2">
                  <label className="field"><span className="lbl">Nocional USD</span>
                    <input type="number" value={notional} step={100000} onChange={(e) => setNotional(Number(e.target.value))} /></label>
                  <label className="field"><span className="lbl">Plazo (días)</span>
                    <input type="number" value={tenor} step={1} onChange={(e) => setTenor(Number(e.target.value))} /></label>
                </div>
                <div className="grid c2" style={{ marginTop: 10 }}>
                  <label className="field"><span className="lbl">Spread (pips)</span>
                    <input type="number" value={spreadPips} step={5} onChange={(e) => setSpreadPips(Number(e.target.value))} /></label>
                  <label className="field"><span className="lbl">Spread (pesos)</span>
                    <input type="number" value={spreadPesos.toFixed(2)} readOnly /></label>
                </div>
                <div className="field" style={{ marginTop: 10 }}>
                  <span className="lbl">Add-on por</span>
                  <div className="seg">
                    <button className={modo === "patas" ? "on" : ""} onClick={() => setModo("patas")}>Patas</button>
                    <button className={modo === "estructura" ? "on" : ""} onClick={() => setModo("estructura")}>Estructura</button>
                  </div>
                </div>

                {/* desglose por patas */}
                <table className="tbl" style={{ marginTop: 12 }}>
                  <thead><tr><th>Pata</th><th className="num">Nocional</th><th className="num">Add-on</th></tr></thead>
                  <tbody>
                    {calc.porPata.map((pt, i) => (
                      <tr key={i}>
                        <td>{pt.tipo.toUpperCase()} {pt.lado}</td>
                        <td className="num dim">{M(pt.notionalUsd)}</td>
                        <td className="num">{M(pt.addonUsd)}</td>
                      </tr>
                    ))}
                    <tr className="sumrow">
                      <td>Exposición (EAD)</td>
                      <td className="num dim">APR {M(calc.aprUsd)}</td>
                      <td className="num">{M(calc.exposicionUsd)}</td>
                    </tr>
                    <tr className="sumrow">
                      <td className="mono" style={{ color: "var(--signal)" }}>Requerimiento CMF</td>
                      <td className="num muted">3% × APR</td>
                      <td className="num" style={{ color: "var(--signal)" }}>{M(calc.requerimientoUsd)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="notice" style={{ marginTop: 10 }}>
                  Utilidad estimada del spread: <b style={{ color: "var(--up)" }}>{M(utilidadUsd)}</b> · el requerimiento es el capital que inmoviliza el ticket.
                </div>
              </div>

              {/* Cascada + veredicto */}
              <div>
                <CascadaPozo titulo="CDB · Corredora" tipo="cdb"
                  antes={ver.cdbAntes} desp={ver.cdb} delta={ver.deltaCdbPct}
                  exceso={ver.excesoCdb} mata={ver.mataCdb} M={M} />
                <CascadaPozo titulo="Coto · Mi línea" tipo="coto"
                  antes={ver.cotoAntes} desp={ver.coto} delta={ver.deltaCotoPct}
                  exceso={ver.excesoCoto} mata={ver.coto.nivel === "negro"} M={M} />

                {/* Veredicto */}
                <div className={"verdict " + (ver.bloqueado ? "block" : ver.decision === "rojo" ? "warn" : ver.decision === "amarillo" ? "warn" : "ok")}>
                  <div className="vh">
                    <span className="tag-dot" style={{ background: ver.mataCdb ? "#b4232a" : dot[ver.coto.nivel] }} />
                    {ver.titulo}
                  </div>
                  <div className="vsub">
                    ¿Mata la CDB? {ver.mataCdb
                      ? <span className="kill">SÍ — reviento por {M(ver.excesoCdb)}</span>
                      : ver.decision === "cdb_stop"
                      ? <span className="kill">CDB en zona hard-stop ({fmtPct(ver.cdb.pct)}) — no se puede originar</span>
                      : <span className="safe">NO — queda {M(ver.cdb.libre)} libre en la CDB</span>}
                  </div>
                  <div className="vsub">
                    Mi línea: {ver.coto.nivel === "negro" || ver.excesoCoto > 0
                      ? <span className="kill">reviento por {M(ver.excesoCoto)}</span>
                      : <>cabe, quedarían <b>{M(ver.coto.libre)}</b> libres · nuevo uso <b>{fmtPct(ver.coto.pct)}</b> (<span style={{ color: dot[ver.coto.nivel] }}>{nivelLabel[ver.coto.nivel]}</span>)</>}
                  </div>
                  {cortada && <div className="vsub kill">Línea del cliente CORTADA — originación bloqueada (los contratos históricos siguen vivos y valorizados).</div>}
                  {ver.requiereAprobacion && !cortada && (
                    <label className="row-inline" style={{ marginTop: 8, fontSize: 12 }}>
                      <input type="checkbox" style={{ width: "auto" }} checked={aprob} onChange={(e) => setAprob(e.target.checked)} />
                      <span>Aprobado por Oficial de Riesgos (requerido en Rojo)</span>
                    </label>
                  )}
                  <button
                    className={"btn block " + (ver.bloqueado || cortada ? "danger" : "primary")}
                    style={{ marginTop: 10 }}
                    disabled={cortada || ver.bloqueado || (ver.requiereAprobacion && !aprob)}
                    onClick={cerrar}
                  >
                    {cortada ? "Cliente cortado — no se puede originar"
                      : ver.bloqueado ? "Bloqueado — protege el capital"
                      : ver.requiereAprobacion ? "Cerrar con aprobación de Riesgos"
                      : "Cerrar ticket"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== MATRIZ + CLIENTES ===== */}
        <div className="cols">
          <MatrizConsumo tickets={st.tickets} M={M} />
          <ClientesGrid M={M} />
        </div>

        {/* ===== BLOTTER ===== */}
        <div className="panel">
          <div className="panel-head">
            <h2>Blotter · Estructuras madre cerradas</h2>
            <span className="spacer" />
            <span className="hint">{st.tickets.length} ticket(s) · consumo propio {M(st.pozoCoto.propio)}</span>
            <button className="btn ghost" style={{ marginLeft: 8 }} onClick={() => store.reset()}>Reset</button>
          </div>
          <div className="panel-body">
            {st.tickets.length === 0 ? (
              <div className="empty">Sin tickets cerrados. Simulá y cerrá uno arriba.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Hora</th><th>Cliente</th><th>Producto</th><th className="num">Nocional</th>
                    <th className="num">Plazo</th><th className="num">Exposición</th><th className="num">Req. CMF</th><th>Nivel</th>
                  </tr>
                </thead>
                <tbody>
                  {st.tickets.map((t) => (
                    <tr key={t.id}>
                      <td className="dim">{new Date(t.ts).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td>{t.razon}</td>
                      <td className="dim">{t.productoNombre}</td>
                      <td className="num">{M(t.notionalUsd)}</td>
                      <td className="num dim">{t.tenorDias}d</td>
                      <td className="num dim">{M(t.exposicionUsd)}</td>
                      <td className="num" style={{ color: "var(--signal)" }}>{M(t.requerimientoUsd)}</td>
                      <td><span className="tag-dot" style={{ background: dot[t.nivelCoto as Nivel] ?? "#56616f", marginRight: 6 }} />{t.nivelCoto}{t.estado === "aprobado-riesgo" ? " ·aprob" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="notice" style={{ marginBottom: 24 }}>
          <b>Fase 1 (hoy):</b> consumo de capital, doble pozo y hard-stop. <b>Fase 2 (tras contratación):</b> splits en cascada, utilidades, ristras y asientos contables. ·
          Demo: pozos editables + feed RT simulado; el motor CMF corre en USD y convierte a CLP con el observado.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------
function PoolCard(props: {
  tipo: "cdb" | "coto"; nombre: string; sub: string;
  e: ReturnType<typeof estadoPozo>; M: (u: number) => string; extra?: ReactNode;
}) {
  const { e, M } = props;
  const w = Math.min(100, Math.max(0, e.pct));
  return (
    <div className="pool">
      <div className="top">
        <span className={"badge " + props.tipo}>{props.tipo === "cdb" ? "CDB" : "COTO"}</span>
        <span className="nm">{props.nombre}</span>
        <span className="spacer" />
        <span className={"lvl-tag " + CSS_NIVEL[e.nivel]}>{nivelLabel[e.nivel]}</span>
      </div>
      <div className="row-inline" style={{ alignItems: "flex-end", gap: 14 }}>
        <span className={"pct " + CSS_NIVEL[e.nivel]}>{fmtPct(e.pct)}</span>
        <span className="muted mono" style={{ fontSize: 11, marginBottom: 4 }}>{props.sub}</span>
      </div>
      <div className="bar"><div className={"fill " + CSS_NIVEL[e.nivel]} style={{ width: w + "%" }} /><div className="marker" style={{ left: "80%" }} /></div>
      <div className="rows">
        <div className="r"><span className="k">Autorizado</span><span className="vv">{M(e.autorizado)}</span></div>
        <div className="r"><span className="k">Consumo (apertura + RT)</span><span className="vv">{M(e.consumo)}</span></div>
        <div className="r libre"><span className="k">Libre</span><span className="vv">{M(e.libre)}</span></div>
        {e.exceso > 0 && <div className="r exceso"><span className="k">Exceso</span><span className="vv">{M(e.exceso)}</span></div>}
      </div>
      {props.extra}
    </div>
  );
}

function CascadaPozo(props: {
  titulo: string; tipo: "cdb" | "coto";
  antes: ReturnType<typeof estadoPozo>; desp: ReturnType<typeof estadoPozo>;
  delta: number; exceso: number; mata: boolean; M: (u: number) => string;
}) {
  const { antes, desp, M } = props;
  return (
    <div style={{ border: "1px solid var(--border-strong)", borderRadius: 8, background: "var(--panel-2)", padding: "10px 12px", marginBottom: 10 }}>
      <div className="row-inline" style={{ justifyContent: "space-between" }}>
        <span className="mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: props.tipo === "cdb" ? "var(--indigo)" : "var(--signal)" }}>{props.titulo}</span>
        <span className={"lvl-tag " + CSS_NIVEL[desp.nivel]}>{fmtPct(desp.pct)}</span>
      </div>
      <table className="tbl" style={{ marginTop: 6 }}>
        <tbody>
          <tr><td className="muted">Requerimiento RT (antes)</td><td className="num dim">{M(antes.consumo)}</td><td className="num muted">{fmtPct(antes.pct)}</td></tr>
          <tr><td className="muted">Tras simular el ticket</td><td className="num" style={{ color: "var(--signal-bright)" }}>{M(desp.consumo)}</td><td className="num" style={{ color: props.mata ? "var(--crit)" : "var(--text)" }}>{fmtPct(desp.pct)} <span className="muted">({props.delta >= 0 ? "+" : ""}{props.delta.toFixed(1)})</span></td></tr>
          <tr className="sumrow">
            <td>{props.mata ? <span className="kill">Reviento por</span> : <span className="safe">Queda libre</span>}</td>
            <td className="num" style={{ color: props.mata ? "var(--crit)" : "var(--up)" }}>{props.mata ? M(props.exceso) : M(desp.libre)}</td>
            <td className="num muted">{props.mata ? "EXCESO" : "OK"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Grilla de consumo por producto y plazo (PFE + capital), método lineal o SA-CCR.
const sumFactor = (p: Producto) => p.patas.reduce((s, x) => s + x.factor, 0);
const TENORS_COL = [30, 90, 180, 360, 720];
type Metodo = "lineal" | "saccr";
type Metrica = "pfe_pct" | "req_pct" | "pfe_mon" | "req_mon";

function GrillaRegulatoria(props: { par: number }) {
  const { par } = props;
  const [metodo, setMetodo] = useState<Metodo>("saccr");
  const [metrica, setMetrica] = useState<Metrica>("pfe_pct");
  const [cur, setCur] = useState<"USD" | "CLP">("USD");
  const [notional, setNotional] = useState(1_000_000);
  const [capReq, setCapReq] = useState(3);     // % del APR
  const [addGen, setAddGen] = useState(1.5);   // % add-on lineal general
  const [addTramo, setAddTramo] = useState(1.0); // % add-on lineal tramo 15–90d
  const [sf, setSf] = useState(4.0);           // % factor supervisor SA-CCR (FX)
  const [mtm, setMtm] = useState(0);           // % del nocional (posición viva)
  const weight = 100;                           // ponderador corporativo

  // add-on % del nocional por pata, según método y plazo
  const addonFactor = (tenor: number) => {
    if (metodo === "saccr") {
      const mf = Math.sqrt(Math.min(tenor, 360) / 360); // maturity factor, tope 1 año
      return sf * mf;
    }
    return tenor >= 15 && tenor <= 90 ? addTramo : addGen;
  };
  const pfePct = (p: Producto, tenor: number) => sumFactor(p) * addonFactor(tenor); // exposición add-on (antes de MtM)
  const reqPct = (p: Producto, tenor: number) =>
    (capReq / 100) * ((pfePct(p, tenor) + mtm) * (weight / 100)); // % de nocional

  const esMonto = metrica === "pfe_mon" || metrica === "req_mon";
  const cell = (p: Producto, tenor: number) => {
    const pfe = pfePct(p, tenor), req = reqPct(p, tenor);
    if (metrica === "pfe_pct") return fmtPct(pfe, 2);
    if (metrica === "req_pct") return fmtPct(req, 3);
    const pct = metrica === "pfe_mon" ? pfe : req;
    return fmtMoney((pct / 100) * notional, cur, par);
  };
  const colAp = (tenor: number) => fmtPct(addonFactor(tenor), metodo === "saccr" ? 2 : 1);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Consumo por producto y plazo <span className="muted" style={{ fontWeight: 400 }}>(PFE + capital · la que manda)</span></h2>
        <span className="spacer" />
        <span className="hint">operar esto consume esto · CMF NCG 562 / SA-CCR</span>
      </div>
      <div className="panel-body">
        <div className="notice" style={{ marginBottom: 12 }}>
          <b>PFE (exposición add-on)</b> = Σ patas × add-on%(plazo) — lo que ocupás. <b>Capital</b> = capReq% × (PFE + MtM) × ponderador — mucho menor.
          {metodo === "saccr"
            ? <> SA-CCR: add-on = factor supervisor × √(plazo/1año) — escala con el plazo (real y más ácido).</>
            : <> Lineal: add-on plano por tramo (simple).</>}
        </div>
        <div className="row-inline" style={{ marginBottom: 10, gap: 14 }}>
          <div>
            <span className="lbl" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Método add-on</span>
            <div className="seg">
              <button className={metodo === "saccr" ? "on" : ""} onClick={() => setMetodo("saccr")}>SA-CCR</button>
              <button className={metodo === "lineal" ? "on" : ""} onClick={() => setMetodo("lineal")}>Lineal</button>
            </div>
          </div>
          <div>
            <span className="lbl" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Métrica</span>
            <div className="seg">
              <button className={metrica === "pfe_pct" ? "on" : ""} onClick={() => setMetrica("pfe_pct")}>PFE %</button>
              <button className={metrica === "pfe_mon" ? "on" : ""} onClick={() => setMetrica("pfe_mon")}>PFE $</button>
              <button className={metrica === "req_pct" ? "on" : ""} onClick={() => setMetrica("req_pct")}>Cap %</button>
              <button className={metrica === "req_mon" ? "on" : ""} onClick={() => setMetrica("req_mon")}>Cap $</button>
            </div>
          </div>
          {esMonto && (
            <>
              <div>
                <span className="lbl" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Moneda</span>
                <div className="seg"><button className={cur === "USD" ? "on" : ""} onClick={() => setCur("USD")}>USD</button><button className={cur === "CLP" ? "on" : ""} onClick={() => setCur("CLP")}>CLP</button></div>
              </div>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <span className="lbl">Nocional</span>
                <input type="number" style={{ width: 140 }} step={100000} value={notional} onChange={(e) => setNotional(Number(e.target.value))} />
              </label>
            </>
          )}
        </div>

        {/* parámetros editables (auditoría / escenario ácido) */}
        <div className="grid c4" style={{ marginBottom: 12 }}>
          <label className="field"><span className="lbl">capReq % (APR)</span>
            <input type="number" step={0.5} value={capReq} onChange={(e) => setCapReq(Number(e.target.value))} /></label>
          {metodo === "saccr" ? (
            <label className="field"><span className="lbl">Factor superv. SA-CCR %</span>
              <input type="number" step={0.5} value={sf} onChange={(e) => setSf(Number(e.target.value))} /></label>
          ) : (
            <label className="field"><span className="lbl">Add-on general %</span>
              <input type="number" step={0.1} value={addGen} onChange={(e) => setAddGen(Number(e.target.value))} /></label>
          )}
          {metodo === "saccr" ? (
            <label className="field"><span className="lbl">ponderador %</span>
              <input type="number" value={weight} readOnly /></label>
          ) : (
            <label className="field"><span className="lbl">Add-on 15–90d %</span>
              <input type="number" step={0.1} value={addTramo} onChange={(e) => setAddTramo(Number(e.target.value))} /></label>
          )}
          <label className="field"><span className="lbl">MtM % (posición viva)</span>
            <input type="number" step={0.1} value={mtm} onChange={(e) => setMtm(Number(e.target.value))} /></label>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Producto</th><th className="num">Patas</th>
                {TENORS_COL.map((t) => (
                  <th key={t} className="num">{t}d <span className="muted">({colAp(t)})</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PRODUCTOS.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}<div className="muted mono" style={{ fontSize: 10 }}>{p.desc}</div></td>
                  <td className="num dim">Σ{sumFactor(p).toFixed(1)}</td>
                  {TENORS_COL.map((t) => (
                    <td key={t} className="num" style={{ color: "var(--signal)" }}>{cell(p, t)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="notice" style={{ marginTop: 10 }}>
          Lectura: cada celda es el <b>{metrica.startsWith("pfe") ? "PFE (exposición)" : "capital requerido"}</b> de operar ese producto a ese plazo
          {esMonto ? <> para <b>{fmtMoney(notional, cur, par)}</b> de nocional</> : <> como % del nocional</>}.
          {metodo === "saccr" && <> Ej: Forward simple a 360d → PFE {fmtPct(addonFactor(360), 1)} (vs {fmtPct(addTramo, 1)} del lineal a corto): el plazo largo es mucho más ácido.</>}
          {" "}La métrica <b>PFE</b> es la que vos ves; el <b>capital</b> es la fracción que inmoviliza la CMF.
        </div>
      </div>
    </div>
  );
}

const BUCKETS = [
  { k: "0–15d", min: 0, max: 15 },
  { k: "16–30d", min: 16, max: 30 },
  { k: "31–90d", min: 31, max: 90 },
  { k: "90d+", min: 91, max: 100000 },
];

function MatrizConsumo(props: { tickets: Ticket[]; M: (u: number) => string }) {
  const { tickets, M } = props;
  const rows = BUCKETS.map((b) => {
    const ts = tickets.filter((t) => t.tenorDias >= b.min && t.tenorDias <= b.max);
    return {
      k: b.k,
      n: ts.length,
      notional: ts.reduce((s, t) => s + t.notionalUsd, 0),
      exp: ts.reduce((s, t) => s + t.exposicionUsd, 0),
      req: ts.reduce((s, t) => s + t.requerimientoUsd, 0),
    };
  });
  const maxReq = Math.max(1, ...rows.map((r) => r.req));
  const tot = rows.reduce((a, r) => ({ n: a.n + r.n, notional: a.notional + r.notional, exp: a.exp + r.exp, req: a.req + r.req }), { n: 0, notional: 0, exp: 0, req: 0 });
  return (
    <div className="panel">
      <div className="panel-head"><h2>Matriz de consumo por balde temporal</h2><span className="spacer" /><span className="hint">USD/CLP · PFE y requerimiento</span></div>
      <div className="panel-body">
        <table className="tbl">
          <thead><tr><th>Balde</th><th className="num">Tickets</th><th className="num">Nocional</th><th className="num">Exposición</th><th className="num">Req. CMF</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}>
                <td>{r.k}</td>
                <td className="num dim">{r.n}</td>
                <td className="num dim">{M(r.notional)}</td>
                <td className="num">{M(r.exp)}</td>
                <td className="num" style={{ color: "var(--signal)" }}>{M(r.req)}</td>
                <td style={{ width: 80 }}><span className="cellbar" style={{ width: (r.req / maxReq) * 70 + "px" }} /></td>
              </tr>
            ))}
            <tr className="sumrow">
              <td>Total mesa Coto</td><td className="num">{tot.n}</td><td className="num dim">{M(tot.notional)}</td>
              <td className="num">{M(tot.exp)}</td><td className="num" style={{ color: "var(--signal)" }}>{M(tot.req)}</td><td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientesGrid(props: { M: (u: number) => string }) {
  const { M } = props;
  return (
    <div className="panel">
      <div className="panel-head"><h2>Clientes · consumo de línea</h2><span className="spacer" /><span className="hint">base de riesgos de la corredora</span></div>
      <div className="panel-body">
        <table className="tbl">
          <thead><tr><th>Cliente</th><th>Acuerdo</th><th className="num">Línea</th><th className="num">Uso</th><th>Estado</th></tr></thead>
          <tbody>
            {CLIENTES.map((c) => {
              const pct = c.lineaMaxUsd > 0 ? (c.lineaUsadaUsd / c.lineaMaxUsd) * 100 : 0;
              const col = pct > 95 ? "var(--crit)" : pct > 80 ? "var(--warn)" : "var(--up)";
              return (
                <tr key={c.rut}>
                  <td>{c.razon}<div className="muted mono" style={{ fontSize: 10 }}>{c.rut}</div></td>
                  <td className="dim">{c.tipo}</td>
                  <td className="num dim">{M(c.lineaMaxUsd)}</td>
                  <td className="num"><span style={{ color: col }}>{fmtPct(pct, 0)}</span></td>
                  <td>{c.estado === "Cortada"
                    ? <span className="kill">Cortada</span>
                    : <span className="pos">Activa</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="notice" style={{ marginTop: 10 }}>
          <b>Regla del hecho anterior:</b> una línea <span className="kill">Cortada</span> bloquea nuevos tickets del cliente, pero mantiene vivos y valorizados los contratos históricos.
        </div>
      </div>
    </div>
  );
}
