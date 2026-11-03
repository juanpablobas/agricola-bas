// Cálculos de los programas fitosanitarios.
// Regla: las dosis se guardan por 100 L de caldo. Si hay mojamiento real (litros/ha) para la
// variedad y el mes, la cantidad se recalcula con esos litros; si no, se usa la dosis por ha del programa.
// Las líneas que el programa define con menos de 100 L/ha (pastas en laterales) llevan dosis fija por ha.

export type Linea = {
  id: string;
  aplicacion_id: string;
  orden: number;
  categoria: string | null;
  objetivo: string | null;
  producto: string;
  ingrediente_activo: string | null;
  unidad: "Kg" | "L" | null;
  conc_100l: number | null;
  mojam_programa: number | null;
  dosis_ha: number | null;
  repeticiones: number;
  caracter: "Fija" | "Variable" | "Alternativa" | null;
  relacion: string | null;
  grupo_alt: number | null;
  alternativas: string | null;
  observacion: string | null;
  producto_id: string | null;
};

export type Aplicacion = {
  id: string;
  programa_id: string;
  orden: number;
  titulo: string | null;
  estado_fenologico: string | null;
  fecha_estimada: string | null;
  mes: number | null;
};

export const NOMBRE_MES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** Orden de la temporada: abril a marzo */
export const MESES_TEMPORADA = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

/** Meses desde `desde` hasta `hasta`, pasando de diciembre a enero si hace falta (máximo 12). */
export function mesesEntre(desde: number, hasta: number): number[] {
  const r: number[] = [];
  let m = desde;
  for (let i = 0; i < 12; i++) {
    r.push(m);
    if (m === hasta) break;
    m = m === 12 ? 1 : m + 1;
  }
  return r;
}

/** Las líneas principales son las del programa; las alternativas (grupo > 0) son opciones de reemplazo. */
export const esPrincipal = (l: Pick<Linea, "grupo_alt">) => (l.grupo_alt ?? 0) === 0;

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Kg o L de producto por hectárea, ya con las repeticiones. `litrosHa` = mojamiento real (o null). */
export function dosisPorHa(l: Linea, litrosHa: number | null): number {
  const rep = Number(l.repeticiones ?? 1) || 1;
  const conc = n(l.conc_100l);
  const mojam = n(l.mojam_programa);
  const fija = n(l.dosis_ha) ?? 0;
  const escala = conc !== null && litrosHa && litrosHa > 0 && !(mojam !== null && mojam > 0 && mojam < 100);
  const base = escala ? (conc! * litrosHa!) / 100 : fija;
  return base * rep;
}

/** Quita acentos, mayúsculas y signos para comparar nombres de productos */
export const clave = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** Lee todas las filas de una consulta (de a 1000) */
export async function leerTodo<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let d = 0; ; d += 1000) {
    const { data } = await consulta(d, d + 999);
    const lote = data ?? [];
    out.push(...lote);
    if (lote.length < 1000) break;
  }
  return out;
}

export const normalizarLinea = (l: any): Linea => ({
  ...l,
  conc_100l: n(l.conc_100l),
  mojam_programa: n(l.mojam_programa),
  dosis_ha: n(l.dosis_ha),
  repeticiones: Number(l.repeticiones ?? 1),
});

/** Separa las opciones escritas como texto ("Stimplex o SeaBioDuo o BioBKelp") */
export const opcionesDeTexto = (t: string | null) => (t ?? "").split(/\s+o\s+|\s*\/\s*|\s*,\s*/i).map((x) => x.trim()).filter(Boolean);
