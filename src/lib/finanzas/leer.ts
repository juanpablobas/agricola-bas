/**
 * Lectura de los Excel del administrador externo (sin dependencias, para poder probarla sola).
 * Recibe las hojas como filas de celdas y devuelve registros listos para guardar.
 * Todos los montos son CON IVA, igual que el control del administrador.
 */

export type Celda = unknown;
export type Hoja = { nombre: string; filas: Celda[][] };

export type LineaPresupuesto = {
  cecoCodigo: string;
  item: string;
  labor: string | null;
  sublabor: string | null;
  udc: string | null;
  mes: string; // aaaa-mm-01
  monto: number;
  cerrado: boolean;
};

export type LineaGasto = {
  cecoCodigo: string;
  item: string;
  sublaborPpto: string | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  fecha: string; // aaaa-mm-dd
  semana: number | null;
  detalle: string | null;
  proveedorRut: string | null;
  proveedorNombre: string | null;
  exento: number;
  neto: number;
  iva: number;
  total: number;
  sinPresupuesto: boolean;
};

export type Lectura<T> = { hoja: string; lineas: T[]; avisos: string[] };

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const norm = (v: Celda) =>
  sinTildes(String(v ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9$%]+/g, " ")
    .trim();

export function texto(v: Celda): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s === "-" ? null : s;
}

export function numero(v: Celda): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/[$\s]/g, "");
  if (s === "" || s === "-") return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const dos = (n: number) => String(n).padStart(2, "0");

/** Devuelve aaaa-mm-dd a partir de una fecha de Excel (Date, número de serie o texto dd-mm-aaaa). */
export function fechaISO(v: Celda): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = new Date(v.getTime() + 12 * 3600 * 1000); // absorbe corrimientos de zona horaria
    return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000) + 12 * 3600 * 1000);
    return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
  }
  if (typeof v === "string") {
    const s = v.trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) return `${m[3]}-${dos(+m[2])}-${dos(+m[1])}`;
  }
  return null;
}

/** Busca la fila de títulos (en las primeras 15 filas) que contiene todas las columnas pedidas. */
function encontrarTitulos(filas: Celda[][], requeridas: string[]) {
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const nombres = (filas[i] ?? []).map(norm);
    if (requeridas.every((r) => nombres.includes(r))) {
      const col = new Map<string, number>();
      nombres.forEach((n, j) => {
        if (n && !col.has(n)) col.set(n, j);
      });
      return { fila: i, col };
    }
  }
  return null;
}

export function esHojaPresupuesto(h: Hoja) {
  return !!encontrarTitulos(h.filas, ["items", "cuartel", "fecha", "sub labor", "ct total"]);
}
export function esHojaGastos(h: Hoja) {
  return !!encontrarTitulos(h.filas, ["items", "cuartel", "fecha", "proveedor", "rut", "total"]);
}

export function leerPresupuesto(h: Hoja): Lectura<LineaPresupuesto> {
  const t = encontrarTitulos(h.filas, ["items", "cuartel", "fecha", "sub labor", "ct total"]);
  if (!t) throw new Error(`La hoja "${h.nombre}" no tiene las columnas del presupuesto (Items, CUARTEL, Fecha, SUB-LABOR, CT TOTAL).`);
  const c = (n: string) => t.col.get(n);
  const iEstado = c("estado");
  const avisos: string[] = [];
  const lineas: LineaPresupuesto[] = [];
  let sinFecha = 0;

  for (const f of h.filas.slice(t.fila + 1)) {
    const item = texto(f[c("items")!]);
    const ceco = texto(f[c("cuartel")!]);
    if (!item || !ceco) continue;
    const fecha = fechaISO(f[c("fecha")!]);
    if (!fecha) {
      sinFecha++;
      continue;
    }
    lineas.push({
      cecoCodigo: ceco,
      item,
      labor: texto(f[c("labores") ?? -1]),
      sublabor: texto(f[c("sub labor")!]),
      udc: texto(f[c("udc") ?? -1]),
      mes: fecha.slice(0, 8) + "01",
      monto: numero(f[c("ct total")!]),
      cerrado: iEstado !== undefined && String(f[iEstado] ?? "").trim().toUpperCase() === "CERRADO",
    });
  }
  if (sinFecha) avisos.push(`${sinFecha} filas sin fecha válida se omitieron.`);
  return { hoja: h.nombre, lineas, avisos };
}

export function leerGastos(h: Hoja): Lectura<LineaGasto> {
  const t = encontrarTitulos(h.filas, ["items", "cuartel", "fecha", "proveedor", "rut", "total"]);
  if (!t) throw new Error(`La hoja "${h.nombre}" no tiene las columnas de gastos (Items, Cuartel, Fecha, Proveedor, Rut, Total).`);
  const c = (n: string) => t.col.get(n);
  const avisos: string[] = [];
  const lineas: LineaGasto[] = [];
  let sinFecha = 0;
  let descuadres = 0;

  for (const f of h.filas.slice(t.fila + 1)) {
    const item = texto(f[c("items")!]);
    const total = f[c("total")!];
    if (!item || total === null || total === undefined || total === "") continue;
    const fecha = fechaISO(f[c("fecha")!]);
    if (!fecha) {
      sinFecha++;
      continue;
    }
    const exento = numero(f[c("exento") ?? -1]);
    const neto = numero(f[c("neto") ?? -1]);
    const iva = numero(f[c("iva") ?? -1]);
    const tot = numero(total);
    if (Math.abs(exento + neto + iva - tot) > 2) descuadres++;
    const nDoc = f[c("n factura") ?? -1];
    const sub = texto(f[c("sublabor ppto") ?? -1]);
    lineas.push({
      cecoCodigo: texto(f[c("cuartel")!]) ?? "",
      item,
      sublaborPpto: sub,
      tipoDocumento: texto(f[c("tipo documento") ?? -1]),
      numeroDocumento: typeof nDoc === "number" ? String(Math.round(nDoc)) : texto(nDoc),
      fecha,
      semana: c("semana") !== undefined && f[c("semana")!] !== "" && f[c("semana")!] != null ? Math.round(numero(f[c("semana")!])) : null,
      detalle: texto(f[c("detalle") ?? -1]),
      proveedorRut: texto(f[c("rut") ?? -1]),
      proveedorNombre: texto(f[c("proveedor")!]),
      exento,
      neto,
      iva,
      total: tot,
      sinPresupuesto: (sub ?? "").toLowerCase() === "sin ppto",
    });
  }
  if (sinFecha) avisos.push(`${sinFecha} filas sin fecha válida se omitieron.`);
  if (descuadres) avisos.push(`${descuadres} documentos donde exento + neto + IVA no suma el total (se guardó el total tal como viene).`);
  return { hoja: h.nombre, lineas, avisos };
}

/** Temporada chilena de frutales: mayo a abril. Devuelve el nombre, p. ej. "2026-27". */
export function nombreTemporada(fechaIso: string) {
  const [y, m] = fechaIso.split("-").map(Number);
  const inicio = m >= 5 ? y : y - 1;
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, "0")}`;
}
