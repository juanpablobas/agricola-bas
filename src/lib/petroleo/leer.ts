// Lectura de la planilla "Control Petróleo" del administrador (hoja Consolidado). Sin dependencias, para poder probarla sola.
import { fechaISO, norm, numero, texto, type Hoja } from "@/lib/finanzas/leer";

export type MovPetroleo = {
  fecha: string;
  tipo: "entrada" | "salida" | "saldo";
  maquina: string | null;
  marca: string | null;
  operario: string | null;
  cuartel: string | null;
  especie: string | null;
  variedad: string | null;
  labor: string | null;
  sublabor: string | null;
  litros: number;
  precio: number | null;
  horometro: number | null;
  km: number | null;
  medidor: number | null;
  hora: string | null;
  factura: string | null;
  proveedor: string | null;
};

const REQ = ["fecha", "maquinaria vehiculo", "labor", "entrada", "salida petroleo", "saldo"];

function titulos(filas: unknown[][]) {
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const nombres = (filas[i] ?? []).map(norm);
    if (REQ.every((r) => nombres.includes(r))) {
      const col = new Map<string, number>();
      nombres.forEach((n, j) => n && !col.has(n) && col.set(n, j));
      return { fila: i, col };
    }
  }
  return null;
}

export const esHojaPetroleo = (h: Hoja) => !!titulos(h.filas);

/** "0", "-" y vacíos se toman como sin dato */
const txt = (v: unknown) => {
  const t = texto(v);
  return t === null || t === "0" ? null : t;
};
const pos = (v: unknown) => {
  const n = numero(v);
  return n > 0 ? n : null;
};
const hora = (v: unknown) => {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const h = v.getUTCHours(), m = v.getUTCMinutes();
    return h === 0 && m === 0 ? null : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  if (typeof v === "number" && v > 0 && v < 1) {
    const t = Math.round(v * 24 * 60);
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }
  const s = texto(v);
  return s && s !== "00:00:00" && s !== "0" ? s.slice(0, 5) : null;
};

export function leerPetroleo(h: Hoja): { movimientos: MovPetroleo[]; avisos: string[] } {
  const t = titulos(h.filas);
  if (!t) throw new Error(`La hoja "${h.nombre}" no tiene las columnas del control de petróleo (Fecha, Maquinaria / Vehículo, Labor, Entrada, Salida Petroleo, Saldo).`);
  const c = (n: string) => t.col.get(n) ?? -1;
  const movimientos: MovPetroleo[] = [];
  let sinFecha = 0;
  for (const f of h.filas.slice(t.fila + 1)) {
    const fecha = fechaISO(f[c("fecha")]);
    const entrada = numero(f[c("entrada")]);
    const salida = numero(f[c("salida petroleo")]);
    const saldo = numero(f[c("saldo")]);
    const proveedor = txt(f[c("proveedor")]);
    if (!fecha) {
      if (entrada || salida) sinFecha++;
      continue;
    }
    const base = {
      fecha,
      maquina: txt(f[c("maquinaria vehiculo")]),
      marca: txt(f[c("marca")]),
      operario: txt(f[c("operario")]),
      cuartel: txt(f[c("cuartel")]),
      especie: txt(f[c("especie")]),
      variedad: txt(f[c("variedad")]),
      labor: txt(f[c("labor")]),
      sublabor: txt(f[c("sub labor")]),
      precio: pos(f[c("precio lt")]),
      horometro: pos(f[c("tractor hrs trabajo")]),
      km: pos(f[c("camioneta kms")]),
      medidor: pos(f[c("medidor estanque")]),
      hora: hora(f[c("hrs")]),
      factura: txt(f[c("factura")]),
      proveedor,
    };
    if (proveedor && /saldo/i.test(proveedor)) {
      movimientos.push({ ...base, tipo: "saldo", litros: Math.max(0, saldo), maquina: null });
    } else if (entrada > 0) {
      movimientos.push({ ...base, tipo: "entrada", litros: entrada, maquina: null });
    } else if (salida > 0) {
      movimientos.push({ ...base, tipo: "salida", litros: salida });
    }
  }
  const avisos: string[] = [];
  if (sinFecha) avisos.push(`${sinFecha} filas sin fecha válida se omitieron.`);
  return { movimientos, avisos };
}

export function tipoMaquina(nombre: string): "tractor" | "camioneta" | "generador" | "otro" {
  const n = norm(nombre);
  if (n.startsWith("tractor")) return "tractor";
  if (n.includes("camioneta")) return "camioneta";
  if (n.includes("generador")) return "generador";
  return "otro";
}
