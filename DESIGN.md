# TradeBlotter — Diseño (slice 1)

Módulo de la Suite TradeAI (tradeblotter.cl). **Columna vertebral de capital y
riesgo**: garantiza que ningún ticket reviente la línea del broker ni el
requerimiento patrimonial de la corredora (CDB). Es TradeFX/TradeRF con ADN de
control de capital CMF.

## Prioridad: blindar el capital
Lo primero que ve el dueño de la corredora boutique: **¿este ticket mata a la
CDB?** Cada simulación responde *si revienta* y *en cuánto*, y el sistema
**bloquea** la originación antes de que eso pase.

## Doble pozo
Un ticket solo se cierra si cabe en **los dos** pozos:
- **CDB (corredora):** techo patrimonial de toda la mesa. Lo consumen *todos* los
  brokers + el mercado (slider "consumo por fuera"). Si el ticket lo empuja sobre
  el techo → **MATA LA CDB** (hard-stop), aunque Coto tenga línea. Si la CDB ya
  está >80% → hard-stop igual.
- **Coto (broker):** línea autorizada propia (todos mis productos). Semáforo
  🟢<20% 🟡20–60% 🔴61–80% 🚫>80% (hard-stop). Rojo exige aprobación del Oficial
  de Riesgos.

## Motor CMF (NCG 562, Bloques 2/3)
El número que **manda** = requerimiento patrimonial; la exposición add-on va al lado.
- Add-on FX: 1,5% general · 1,0% calibrado tramo 15–90 días.
- Exposición (EAD) = MtM + Σ(add-on × nocional de pata). MtM≈0 en T0.
- APR (RWA) = EAD × 100% (ponderador corporativo).
- **Requerimiento = 3% × APR.**
- Canónico en USD; se muestra en CLP/USD con toggle (motor backend CLP por norma).

## Quick Quote
Cliente + producto (FWD Mejorado Import = Fwd venta + Compra Call, etc.) +
nocional + plazo + spread → cascada **CDB → Coto**: requerimiento antes, tras
simular, delta %, ¿cabe?, Exceso Propio / Exceso CDB, nuevo nivel y veredicto.

## Otros
- Matriz de consumo por balde temporal (0–15 / 16–30 / 31–90 / 90d+), USD/CLP.
- Grilla de clientes/líneas con **regla del hecho anterior**: línea *Cortada*
  bloquea nuevos tickets pero mantiene vivos los contratos históricos.
- Barra indicador: USD/CLP obs + real time (simulado), UF, % uso capital
  corredora y Coto.

## Arquitectura
Demo: React estático (tema suite) + `store` (BroadcastChannel + localStorage),
pozos editables, feed RT simulado. Prod: Supabase + base de riesgos cargada por
la corredora (.xlsx/.csv) + feed real.

## Verificado (demo)
Requerimiento CMF correcto (2M USD, 30d, patas → add-on 1% → EAD 40K → req 1.200
USD = $1.134.360 CLP). Cascada CDB/Coto con delta. **Escenario crítico:** CDB
llevada a exceso por "consumo por fuera" → ticket viable para Coto (4% verde)
pero **bloqueado** porque mata la CDB, con el monto exacto del exceso.

## Siguiente (fase 2, tras contratación)
Splits en cascada, utilidades, ristras y asientos contables; griegas/DV01 por
bucket, unwind, cuádruple confirmación PDF, RBAC, feed Bloomberg, Supabase.
