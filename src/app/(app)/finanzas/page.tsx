import Link from "next/link";
import { exigirRol } from "@/lib/auth";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";
import { Tablero, type Ceco, type FilaGasto, type FilaPpto } from "./Tablero";

export const metadata = { title: "Finanzas" };

async function traerTodo<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null }>) {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data } = await consulta(desde, desde + 999);
    const lote = data ?? [];
    filas.push(...lote);
    if (lote.length < 1000) break;
  }
  return filas;
}

export default async function Finanzas() {
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "propietario");
  const puedeCargar = perfil.rol === "administrador" || perfil.rol === "enc_administrativo";

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: temporadas } = await supabase.from("temporada").select("id, nombre, inicio, termino").order("inicio", { ascending: false });
  const temporada = (temporadas ?? []).find((t) => t.inicio <= hoy && t.termino >= hoy) ?? (temporadas ?? [])[0];

  const botones = (
    <>
      <Link href="/finanzas/gastos" className="boton-secundario"><Icono nombre="archivo" className="size-4" />Ver gastos</Link>
      {puedeCargar && <Link href="/finanzas/cargar" className="boton"><Icono nombre="subir" className="size-4" />Cargar archivo</Link>}
    </>
  );

  if (!temporada) {
    return (<><Encabezado titulo="Finanzas" /><Aviso>No hay temporada creada. Créala en Campo.</Aviso></>);
  }

  const [pptoRaw, gastosRaw, { data: cecosRaw }, { data: cuarteles }, { data: campo }] = await Promise.all([
    traerTodo<any>((d, h) =>
      supabase.from("v_presupuesto_real").select("ceco_id, item, mes, presupuesto").eq("temporada_id", temporada.id).gt("presupuesto", 0).order("mes").range(d, h),
    ),
    traerTodo<any>((d, h) =>
      supabase
        .from("gasto")
        .select("fecha, ceco_id, item, total, detalle, sin_presupuesto, sublabor_ppto, numero_documento, proveedor(nombre)")
        .eq("temporada_id", temporada.id)
        .order("fecha")
        .order("id")
        .range(d, h),
    ),
    supabase.from("ceco").select("id, codigo, nombre, tipo, variedad_id, ceco_presupuesto_id").order("codigo"),
    supabase.from("v_cuartel").select("variedad_id, superficie_ha, estado_productivo").eq("activo", true),
    supabase.from("campo").select("superficie_total_ha").maybeSingle(),
  ]);

  if (gastosRaw.length === 0 && pptoRaw.length === 0) {
    return (
      <>
        <Encabezado titulo="Finanzas" subtitulo={`Temporada ${temporada.nombre}`} acciones={botones} />
        <Aviso>
          Todavía no hay datos de esta temporada. {puedeCargar ? "Sube el Excel del administrador en “Cargar archivo”." : "Pide al administrador que cargue el archivo."}
        </Aviso>
      </>
    );
  }

  // Hectáreas por variedad (solo cuarteles plantados)
  const haPorVariedad = new Map<string, number>();
  for (const c of cuarteles ?? []) {
    if (!c.variedad_id || c.estado_productivo === "sin_plantar" || c.estado_productivo === "eliminado") continue;
    haPorVariedad.set(c.variedad_id, (haPorVariedad.get(c.variedad_id) ?? 0) + Number(c.superficie_ha));
  }
  const haGeneral = campo?.superficie_total_ha ? Number(campo.superficie_total_ha) : null;

  const cecos: Ceco[] = (cecosRaw ?? []).map((c) => ({
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
    tipo: c.tipo,
    ha: c.tipo === "variedad" ? haPorVariedad.get(c.variedad_id) ?? null : c.codigo === "C111" ? haGeneral : null,
  }));
  const grupoDe = new Map((cecosRaw ?? []).map((c) => [c.id as string, (c.ceco_presupuesto_id ?? c.id) as string]));

  const ppto: FilaPpto[] = pptoRaw.map((p) => ({ ceco_id: p.ceco_id, item: p.item, mes: p.mes, presupuesto: Number(p.presupuesto) }));
  const gastos: FilaGasto[] = gastosRaw.map((g) => ({
    f: g.fecha,
    c: g.ceco_id ? grupoDe.get(g.ceco_id) ?? g.ceco_id : null,
    i: g.item,
    t: Number(g.total),
    p: g.proveedor?.nombre ?? null,
    d: g.detalle,
    s: g.sin_presupuesto,
    l: g.sublabor_ppto,
    n: g.numero_documento,
  }));

  const inicio = new Date(temporada.inicio + "T12:00:00Z");
  const meses = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + k, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });

  return (
    <>
      <Encabezado
        titulo="Finanzas"
        subtitulo={`Temporada ${temporada.nombre} · presupuesto contra gasto real, con IVA. Usa los filtros o toca una fila para ver el detalle.`}
        acciones={botones}
      />
      <Tablero temporada={temporada.nombre} meses={meses} cecos={cecos} ppto={ppto} gastos={gastos} haGeneral={haGeneral} />
    </>
  );
}
