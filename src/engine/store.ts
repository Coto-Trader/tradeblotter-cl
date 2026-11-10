import type { Pozo } from "./capital";
import { POZO_COTO_SEED, POZO_CDB_SEED } from "../model/seed";

export interface Ticket {
  id: string;
  ts: number;
  usuario: string;
  rut: string;
  razon: string;
  productoId: string;
  productoNombre: string;
  notionalUsd: number;
  tenorDias: number;
  modo: "patas" | "estructura";
  spreadPips: number;
  spreadPesos: number;
  exposicionUsd: number;
  requerimientoUsd: number;
  nivelCoto: string;
  estado: "cerrado" | "aprobado-riesgo";
}

export interface BlotterState {
  pozoCoto: Pozo;
  pozoCdb: Pozo;
  tickets: Ticket[];
}

const LS_KEY = "tradeblotter.v1";
const CH = "tradeblotter";

function freshState(): BlotterState {
  return {
    pozoCoto: { ...POZO_COTO_SEED },
    pozoCdb: { ...POZO_CDB_SEED },
    tickets: [],
  };
}

export class BlotterStore {
  private state: BlotterState;
  private ch: BroadcastChannel | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    this.state = this.load();
    try {
      this.ch = new BroadcastChannel(CH);
      this.ch.onmessage = (e) => {
        if (e.data?.type === "state") {
          this.state = e.data.state;
          this.emit(false);
        }
      };
    } catch {
      this.ch = null;
    }
  }

  private load(): BlotterState {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return { ...freshState(), ...JSON.parse(raw) };
    } catch {}
    return freshState();
  }

  private persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.state)); } catch {}
  }

  private emit(broadcast = true) {
    this.persist();
    if (broadcast && this.ch) {
      try { this.ch.postMessage({ type: "state", state: this.state }); } catch {}
    }
    this.listeners.forEach((l) => l());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get(): BlotterState { return this.state; }

  addTicket(t: Ticket) {
    this.state = {
      ...this.state,
      pozoCoto: { ...this.state.pozoCoto, propio: this.state.pozoCoto.propio + t.requerimientoUsd },
      pozoCdb: { ...this.state.pozoCdb, propio: this.state.pozoCdb.propio + t.requerimientoUsd },
      tickets: [t, ...this.state.tickets],
    };
    this.emit();
  }

  setPozoCoto(p: Partial<Pozo>) {
    this.state = { ...this.state, pozoCoto: { ...this.state.pozoCoto, ...p } };
    this.emit();
  }

  setPozoCdb(p: Partial<Pozo>) {
    this.state = { ...this.state, pozoCdb: { ...this.state.pozoCdb, ...p } };
    this.emit();
  }

  reset() {
    this.state = freshState();
    this.emit();
  }
}

export const store = new BlotterStore();
