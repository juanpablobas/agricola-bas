// Reglas compartidas del módulo de labores: estados, motivos, unidades, cobros y cálculo de costos.

export type EstadoLabor = "programado" | "en_ejecucion" | "realizado" | "reprogramado" | "cancelado";

export const ESTADOS: Record<EstadoLabor, { texto: string; pastilla: string; punto: string; borde: string }> = {
  programado: { texto: "Pendiente", pastilla: "bg-agua-claro text-agua", punto: "bg-agua", borde: "var(--color-agua)" },
  en_ejecucion: { texto: "En ejecución", pastilla: "bg-ambar-claro text-ambar", punto: "bg-ambar", borde: "var(--color-ambar)" },
  realizado: { texto: "Realizada", pastilla: "bg-verde-claro text-verde-oscuro", punto: "bg-verde", borde: "var(--color-verde)" },
  reprogramado: { texto: "Reprogramada", pastilla: "bg-[#efe6f7] text-[#6b3fa0]", punto: "bg-[#6b3fa0]", borde: "#6b3fa0" },
  cancelado: { texto: "Cancelada", pastilla: "bg-linea/70 text-tinta-suave", punto: "bg-tinta-suave", borde: "var(--color-linea)" },
};

/** Una labor está atrasada si no se ha hecho y su día ya pasó */
export const estaAtrasada = (l: { estado: string; fecha: string }, hoy: string) =>
  (l.estado === "programado" || l.estado === "reprogramado") && l.fecha < hoy;

export const MOTIVOS = [
  ["lluvia", "Lluvia"],
  ["suelo_humedo", "Suelo húmedo"],
  ["viento", "Viento"],
  ["falta_personal", "Falta de personal"],
  ["falta_maquinaria", "Falta de maquinaria"],
  ["falta_insumos", "Falta de insumos"],
  ["cambio_prioridad", "Cambio de prioridad"],
  ["otro", "Otro"],
] as const;
export const nombreMotivo = (m: string | null) => MOTIVOS.find(([k]) => k === m)?.[1] ?? m ?? "";

export const UNIDADES = [
  ["ha", "hectáreas"],
  ["arbol", "árboles"],
  ["hilera", "hileras"],
  ["jornada", "jornadas"],
  ["unidad", "unidades"],
] as const;
export const nombreUnidad = (u: string | null, corto = false) =>
  corto ? ({ ha: "ha", arbol: "árb.", hilera: "hil.", jornada: "jor.", unidad: "u." } as Record<string, string>)[u ?? ""] ?? "" : UNIDADES.find(([k]) => k === u)?.[1] ?? "";

export const COBROS = [
  ["ha", "Por hectárea"],
  ["arbol", "Por árbol"],
  ["jornada", "Por jornada"],
  ["unidad", "Por unidad"],
  ["fijo", "Precio fijo (total)"],
] as const;
export const nombreCobro = (c: string | null) => COBROS.find(([k]) => k === c)?.[1] ?? "";

export const PAGOS = [
  ["pendiente", "Pendiente"],
  ["parcial", "Parcial"],
  ["pagado", "Pagado"],
] as const;

export const CATEGORIAS = [
  "Poda",
  "Manejo vegetativo",
  "Manejo de fruta",
  "Malezas",
  "Aplicaciones fitosanitarias",
  "Riego y fertilización",
  "Cosecha y postcosecha",
  "Suelo",
  "Mantención",
  "Monitoreo",
  "Otras",
];

type Costeable = {
  ejecucion?: string | null;
  personas?: number | string | null;
  jornadas?: number | string | null;
  horas?: number | string | null;
  valor_jornal?: number | string | null;
  valor_hora?: number | string | null;
  cobro?: string | null;
  precio_unitario?: number | string | null;
  cantidad_ejecutada?: number | string | null;
  cantidad_plan?: number | string | null;
  costo_maquinaria?: number | string | null;
  costo_insumos?: number | string | null;
};
const nn = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Costo de la labor por tipo: mano de obra propia, externa (contratista), maquinaria e insumos */
export function costos(l: Costeable, usarPlan = false) {
  let propia = 0;
  let externa = 0;
  if ((l.ejecucion ?? "propio") === "contratista") {
    const precio = nn(l.precio_unitario) ?? 0;
    const cant = (usarPlan ? nn(l.cantidad_plan) : nn(l.cantidad_ejecutada) ?? nn(l.cantidad_plan)) ?? 0;
    externa = l.cobro === "fijo" ? precio : precio * cant;
  } else {
    const horas = nn(l.horas);
    if (horas && nn(l.valor_hora)) propia = horas * (nn(l.valor_hora) ?? 0);
    else propia = (nn(l.jornadas) ?? 0) * (nn(l.valor_jornal) ?? 0);
  }
  const maquinaria = nn(l.costo_maquinaria) ?? 0;
  const insumos = nn(l.costo_insumos) ?? 0;
  return { propia: Math.round(propia), externa: Math.round(externa), maquinaria, insumos, total: Math.round(propia + externa + maquinaria + insumos) };
}

/** Porcentaje de avance (0 a 100), si hay cantidad planificada */
export function avance(l: { estado: string; cantidad_plan?: number | string | null; cantidad_ejecutada?: number | string | null }) {
  if (l.estado === "realizado") return 100;
  const plan = nn(l.cantidad_plan);
  const ej = nn(l.cantidad_ejecutada) ?? 0;
  if (!plan || plan <= 0) return l.estado === "en_ejecucion" ? null : 0;
  return Math.min(100, Math.round((ej / plan) * 100));
}
