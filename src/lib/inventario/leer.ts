/** Lectura del archivo "Inventario" del administrador (hojas Ingresos y Salidas). Sin dependencias. */
import { fechaISO, norm, numero, texto, type Celda, type Hoja } from "../finanzas/leer";

export type Clasificacion = "Pesticida" | "Herbicida" | "Fertilizante" | "Insumos";

export type Ingreso = {
  fecha: string;
  clasificacion: Clasificacion;
  proveedor: string | null;
  factura: string | null;
  producto: string;
  cantidad: number;
  valorTotal: number;
};

export type Salida = {
  fecha: string;
  clasificacion: Clasificacion;
  producto: string;
  factura: string | null;
  cantidad: number;
  valorUnitario: number;
  valorTotal: number;
  destino: string; // C221, Distribuir, Desuso…
};

export const claveProducto = (nombre: string) => nombre.trim().replace(/\s+/g, " ").toLowerCase();
export const limpiarNombre = (nombre: string) => nombre.trim().replace(/\s+/g, " ");

const CLASIF: Record<string, Clasificacion> = {
  pesticida: "Pesticida",
  herbicida: "Herbicida",
  fertilizante: "Fertilizante",
  insumos: "Insumos",
  insumo: "Insumos",
};

function titulos(filas: Celda[][], requeridas: string[]) {
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const nombres = (filas[i] ?? []).map(norm);
    if (requeridas.every((r) => nombres.includes(r))) {
      const col = new Map<string, number>();
      nombres.forEach((n, j) => n && !col.has(n) && col.set(n, j));
      return { fila: i, col };
    }
  }
  return null;
}

const REQ_ING = ["fecha", "clasificacion", "proveedor", "factura", "descripcion", "cantidad", "valor"];
const REQ_SAL = ["fecha", "clasificacion", "descripcion", "cantidad", "cuartel salida"];

// La hoja "Inventario" (por lote) trae además Stock Real: se descarta; los ingresos se leen de la hoja Ingresos.
export const esHojaIngresos = (h: Hoja) => !!titulos(h.filas, REQ_ING) && !titulos(h.filas, REQ_SAL) && !titulos(h.filas, ["stock real"]);
export const esHojaSalidas = (h: Hoja) => !!titulos(h.filas, REQ_SAL);

function numDoc(v: Celda) {
  return typeof v === "number" ? String(Math.round(v)) : texto(v);
}

export function leerIngresos(h: Hoja) {
  const t = titulos(h.filas, REQ_ING);
  if (!t) throw new Error(`La hoja "${h.nombre}" no tiene las columnas de ingresos.`);
  const c = (n: string) => t.col.get(n)!;
  const avisos: string[] = [];
  const lineas: Ingreso[] = [];
  let omitidas = 0;
  const sinCantidad: string[] = [];
  for (const f of h.filas.slice(t.fila + 1)) {
    const prod = texto(f[c("descripcion")]);
    const clase = CLASIF[norm(f[c("clasificacion")])];
    const fecha = fechaISO(f[c("fecha")]);
    const cant = numero(f[c("cantidad")]);
    if (!prod) continue;
    if (!clase || !fecha || cant <= 0) {
      if (clase && fecha && cant <= 0) sinCantidad.push(`${limpiarNombre(prod)} (factura ${numDoc(f[c("factura")]) ?? "s/n"}, $${Math.round(numero(f[c("valor")])).toLocaleString("es-CL")})`);
      else omitidas++;
      continue;
    }
    lineas.push({
      fecha,
      clasificacion: clase,
      proveedor: texto(f[c("proveedor")]),
      factura: numDoc(f[c("factura")]),
      producto: limpiarNombre(prod),
      cantidad: cant,
      valorTotal: numero(f[c("valor")]),
    });
  }
  if (omitidas) avisos.push(`${omitidas} filas de ingresos sin fecha o clasificación válida se omitieron.`);
  if (sinCantidad.length) avisos.push(`Ingresos con cantidad 0 en el Excel (no entran al stock; conviene corregirlos con el administrador): ${sinCantidad.join("; ")}.`);
  return { lineas, avisos };
}

export function leerSalidas(h: Hoja) {
  const t = titulos(h.filas, REQ_SAL);
  if (!t) throw new Error(`La hoja "${h.nombre}" no tiene las columnas de salidas.`);
  const c = (n: string) => t.col.get(n)!;
  const avisos: string[] = [];
  const lineas: Salida[] = [];
  let omitidas = 0;
  for (const f of h.filas.slice(t.fila + 1)) {
    const prod = texto(f[c("descripcion")]);
    const clase = CLASIF[norm(f[c("clasificacion")])];
    const fecha = fechaISO(f[c("fecha")]);
    const cant = numero(f[c("cantidad")]);
    if (!prod) continue;
    if (!clase || !fecha || cant <= 0) {
      omitidas++;
      continue;
    }
    const vu = numero(f[t.col.get("valor unitario") ?? -1]);
    const vt = t.col.has("valor total") ? numero(f[c("valor total")]) : vu * cant;
    lineas.push({
      fecha,
      clasificacion: clase,
      producto: limpiarNombre(prod),
      factura: numDoc(f[t.col.get("factura") ?? -1]),
      cantidad: cant,
      valorUnitario: vu,
      valorTotal: vt,
      destino: texto(f[c("cuartel salida")]) ?? "Distribuir",
    });
  }
  if (omitidas) avisos.push(`${omitidas} filas de salidas sin fecha, clasificación o cantidad válida se omitieron.`);
  return { lineas, avisos };
}
