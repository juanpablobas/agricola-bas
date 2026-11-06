import Link from "next/link";
import { exigirRol, puede } from "@/lib/auth";
import { clp, num } from "@/lib/formato";
import { corta, esFecha, hoyChile, lunesDe, nombreDia, sumaDias } from "@/lib/semana";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";
import { cargarOpciones } from "./lib";
import { cambiarEstado } from "./labor-acciones";
import { ESTADOS, avance, costos, estaAtrasada, nombreUnidad, type EstadoLabor } from "./modelo";

export const metadata = { title: "Labores" };

type Q = { vista?: string; desde?: string; hasta?: string; estado?: string; especie?: string; variedad?: string; cuartel?: string; trabajador?: string; contratista?: string; semana?: string; mes?: string; ok?: string };
const CAMPOS = "id, fecha, fecha_original, fecha_inicio, fecha_termino, estado, cuartel_id, variedad_id, labor_tipo_id, cuadrilla_id, fiscalizador_id, personas, jornadas, horas, ejecucion, cobro, precio_unitario, valor_jornal, valor_hora, cantidad_plan, cantidad_ejecutada, unidad_cantidad, costo_maquinaria, costo_insumos, presupuesto";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const finDeMes = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const mesMas = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export default async function Labores({ searchParams }: { searchParams: Promise<Q> }) {
  const p = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario", "operario");
  const edita = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");
  const veMonto = puede(perfil.rol, "administrador", "enc_administrativo", "propietario");
  const hoy = hoyChile();
  const vista = p.vista === "semana" || p.vista === "mes" ? p.vista : "panel";

  // Período según la vista
  const mes = /^\d{4}-\d{2}$/.test(p.mes ?? "") ? p.mes! : hoy.slice(0, 7);
  const semana = esFecha(p.semana) ? lunesDe(p.semana) : lunesDe(hoy);
  let desde: string, hasta: string;
  if (vista === "semana") { desde = semana; hasta = sumaDias(semana, 6); }
  else if (vista === "mes") { desde = lunesDe(`${mes}-01`); hasta = sumaDias(lunesDe(finDeMes(mes)), 6); }
  else { desde = esFecha(p.desde) ? p.desde : `${hoy.slice(0, 7)}-01`; hasta = esFecha(p.hasta) ? p.hasta : finDeMes(hoy.slice(0, 7)); }

  const [op, { data: delPeriodo }, { data: atrasadasTodas }] = await Promise.all([
    cargarOpciones(supabase),
    supabase.from("labor_registro").select(CAMPOS).gte("fecha", desde).lte("fecha", hasta).order("fecha").order("creado_en").range(0, 1999),
    supabase.from("labor_registro").select(CAMPOS).in("estado", ["programado", "reprogramado"]).lt("fecha", hoy).order("fecha").range(0, 999),
  ]);
  const ids = [...new Set([...((delPeriodo ?? []) as any[]), ...((atrasadasTodas ?? []) as any[])].map((l) => l.id))];
  const { data: lt } = p.trabajador && ids.length ? await supabase.from("labor_trabajador").select("labor_id, trabajador_id").in("labor_id", ids) : { data: [] as any[] };
  const conTrabajador = new Set(((lt ?? []) as any[]).filter((x) => x.trabajador_id === p.trabajador).map((x) => x.labor_id));

  // Filtros
  const especieDe = (l: any) => (l.cuartel_id ? op.especieDeCuartel.get(l.cuartel_id) : l.variedad_id ? op.especieDeVariedad.get(l.variedad_id) : null) ?? null;
  const variedadDe = (l: any) => (l.cuartel_id ? op.variedadDeCuartel.get(l.cuartel_id) : l.variedad_id) ?? null;
  const pasa = (l: any) =>
    (!p.estado || (p.estado === "atrasada" ? estaAtrasada(l, hoy) : l.estado === p.estado)) &&
    (!p.especie || especieDe(l) === p.especie) &&
    (!p.variedad || variedadDe(l) === p.variedad) &&
    (!p.cuartel || l.cuartel_id === p.cuartel || (l.variedad_id && l.variedad_id === op.variedadDeCuartel.get(p.cuartel))) &&
    (!p.contratista || l.cuadrilla_id === p.contratista) &&
    (!p.trabajador || l.fiscalizador_id === p.trabajador || conTrabajador.has(l.id));
  const labores = ((delPeriodo ?? []) as any[]).filter(pasa);
  const atrasadas = ((atrasadasTodas ?? []) as any[]).filter(pasa);
  const filtrosActivos = ["estado", "especie", "variedad", "cuartel", "trabajador", "contratista"].filter((k) => (p as any)[k]);

  // Indicadores del período
  const cuenta = (e: EstadoLabor) => labores.filter((l) => l.estado === e).length;
  const vencidas = labores.filter((l) => l.estado !== "cancelado" && l.fecha <= hoy);
  const hechasVencidas = vencidas.filter((l) => l.estado === "realizado").length;
  const cumplimiento = vencidas.length ? Math.round((hechasVencidas / vencidas.length) * 100) : null;
  const presupuesto = labores.filter((l) => l.estado !== "cancelado").reduce((s, l) => s + Number(l.presupuesto ?? 0), 0);
  const real = labores.filter((l) => l.estado === "realizado" || l.estado === "en_ejecucion").reduce((s, l) => s + costos(l).total, 0);

  const qs = (cambios: Partial<Q>) => {
    const u = new URLSearchParams();
    const todo = { ...p, ok: undefined, ...cambios } as Record<string, string | undefined>;
    for (const [k, v] of Object.entries(todo)) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/labores?${s}` : "/labores";
  };
  const volverAqui = qs({});

  const quien = (l: any) =>
    l.ejecucion === "contratista" ? (l.cuadrilla_id ? op.nombres.cuadrilla.get(l.cuadrilla_id) : "Contratista") : l.cuadrilla_id ? op.nombres.cuadrilla.get(l.cuadrilla_id) : l.personas ? `${l.personas} personas` : "Personal propio";

  const Fila = ({ l, acciones = false }: { l: any; acciones?: boolean }) => {
    const e = ESTADOS[l.estado as EstadoLabor];
    const pct = avance(l);
    const atr = estaAtrasada(l, hoy);
    const c = veMonto ? costos(l).total : 0;
    return (
      <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center" style={{ boxShadow: `inset 4px 0 0 ${atr ? "var(--color-alerta)" : e.borde}` }}>
        <Link href={`/labores/${l.id}`} className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 font-medium">
            {op.nombres.labor.get(l.labor_tipo_id)} <span className="font-normal text-tinta-suave">· {op.donde(l)}</span>
          </p>
          <p className="text-sm text-tinta-suave">
            <span className={atr ? "font-medium text-alerta" : ""}><span className="capitalize">{nombreDia(l.fecha).slice(0, 3)}</span> {corta(l.fecha)}</span>
            {l.fecha_original && l.fecha_original !== l.fecha && <span className="text-[#6b3fa0]"> (era {corta(l.fecha_original)})</span>}
            {" · "}{quien(l)}
            {l.cantidad_plan != null && ` · ${num(Number(l.cantidad_plan), 1)} ${nombreUnidad(l.unidad_cantidad, true)}`}
            {veMonto && c > 0 && ` · ${clp(c)}`}
          </p>
          {l.estado === "en_ejecucion" && pct !== null && (
            <span className="mt-1.5 flex items-center gap-2"><span className="h-1.5 w-32 overflow-hidden rounded-full bg-papel"><span className="block h-full rounded-full bg-ambar" style={{ width: `${pct}%` }} /></span><span className="text-xs tabular-nums text-tinta-suave">{pct} %</span></span>
          )}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`pastilla ${atr ? "bg-alerta-claro text-alerta" : e.pastilla}`}>{atr ? "Atrasada" : e.texto}</span>
          {acciones && edita && (
            <>
              <form action={cambiarEstado}>
                <input type="hidden" name="id" value={l.id} /><input type="hidden" name="estado" value="realizado" /><input type="hidden" name="volver" value={volverAqui} />
                <button className="boton min-h-9 px-3 py-1.5"><Icono nombre="ok" className="size-4" />Se terminó</button>
              </form>
              <Link href={`/labores/${l.id}`} className="boton-secundario min-h-9 px-3 py-1.5">Reprogramar</Link>
            </>
          )}
        </div>
      </li>
    );
  };

  const Lista = ({ titulo, punto, items, vacio, acciones = false, abierta = true }: { titulo: string; punto: string; items: any[]; vacio?: string; acciones?: boolean; abierta?: boolean }) =>
    items.length === 0 && !vacio ? null : (
      <details open={abierta} className="tarjeta group mb-4 overflow-hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold">
          <span className={`size-2.5 rounded-full ${punto}`} />{titulo}<span className="font-normal text-tinta-suave">({items.length})</span>
          <Icono nombre="volver" className="ml-auto size-4 -rotate-90 text-tinta-suave transition group-open:rotate-90" />
        </summary>
        {items.length === 0 ? <p className="border-t border-linea px-4 py-3 text-sm text-tinta-suave">{vacio}</p> : <ul className="divide-y divide-linea border-t border-linea">{items.map((l) => <Fila key={l.id} l={l} acciones={acciones} />)}</ul>}
      </details>
    );

  const Chip = ({ l }: { l: any }) => {
    const e = ESTADOS[l.estado as EstadoLabor];
    const atr = estaAtrasada(l, hoy);
    return (
      <Link href={`/labores/${l.id}`} title={`${op.nombres.labor.get(l.labor_tipo_id)} · ${op.donde(l)} · ${atr ? "Atrasada" : e.texto}`}
        className={`block truncate rounded-md px-1.5 py-1 text-[11px] font-medium leading-tight ${atr ? "bg-alerta-claro text-alerta" : e.pastilla}`}>
        {op.nombres.labor.get(l.labor_tipo_id)}<span className="hidden font-normal opacity-80 sm:inline"> · {l.cuartel_id ? op.nombres.cuartel.get(l.cuartel_id)?.split(" ")[0] : l.variedad_id ? op.donde(l).split(" ")[0] : "General"}</span>
      </Link>
    );
  };

  const tab = (v: string, t: string) => (
    <Link href={qs({ vista: v === "panel" ? undefined : v })} aria-current={vista === v ? "page" : undefined}
      className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold sm:flex-none ${vista === v ? "bg-white text-verde-oscuro shadow-sm" : "text-tinta-suave"}`}>{t}</Link>
  );

  const nombreFiltro = (k: string, v: string) =>
    k === "estado" ? (v === "atrasada" ? "Atrasadas" : ESTADOS[v as EstadoLabor]?.texto) : k === "especie" ? op.especies.find((x) => x.id === v)?.texto : k === "variedad" ? op.variedadesTodas.find((x) => x.id === v)?.texto
    : k === "cuartel" ? op.nombres.cuartel.get(v) : k === "trabajador" ? op.nombres.trabajador.get(v) : op.nombres.cuadrilla.get(v);

  return (
    <>
      <Encabezado
        titulo="Labores"
        subtitulo="Qué estaba programado, qué se hizo, qué se atrasó y cuánto costó."
        acciones={
          <>
            {edita && <Link href="/labores/registrar" className="boton"><Icono nombre="mas" className="size-4" />Agregar labor</Link>}
            {perfil.rol !== "operario" && <Link href="/labores/resumen" className="boton-secundario"><Icono nombre="finanzas" className="size-4" />Resumen</Link>}
            {perfil.rol !== "operario" && <Link href="/labores/catalogos" className="boton-secundario">Catálogo</Link>}
          </>
        }
      />
      {p.ok === "borrada" && <div className="mb-4"><Aviso tipo="ok">Labor borrada.</Aviso></div>}

      <div className="mb-3 flex gap-1 rounded-xl bg-papel p-1 ring-1 ring-linea sm:inline-flex">
        {tab("panel", "Panel")}{tab("semana", "Semana")}{tab("mes", "Mes")}
      </div>

      <details className="tarjeta mb-4 overflow-hidden">
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 px-4 text-sm font-medium">
          <Icono nombre="buscar" className="size-4" />Filtros
          {filtrosActivos.map((k) => <span key={k} className="pastilla bg-verde-claro text-verde-oscuro">{nombreFiltro(k, (p as any)[k])}</span>)}
          {filtrosActivos.length > 0 && <Link href={qs({ estado: undefined, especie: undefined, variedad: undefined, cuartel: undefined, trabajador: undefined, contratista: undefined })} className="ml-auto text-xs text-verde underline">Quitar filtros</Link>}
        </summary>
        <form method="get" className="grid grid-cols-2 gap-3 border-t border-linea p-4 sm:grid-cols-4">
          {vista !== "panel" && <input type="hidden" name="vista" value={vista} />}
          {vista === "semana" && <input type="hidden" name="semana" value={semana} />}
          {vista === "mes" && <input type="hidden" name="mes" value={mes} />}
          {vista === "panel" && (
            <>
              <div><label htmlFor="f-desde" className="etiqueta-campo">Desde</label><input id="f-desde" name="desde" type="date" defaultValue={desde} className="entrada px-2" /></div>
              <div><label htmlFor="f-hasta" className="etiqueta-campo">Hasta</label><input id="f-hasta" name="hasta" type="date" defaultValue={hasta} className="entrada px-2" /></div>
            </>
          )}
          <div><label htmlFor="f-estado" className="etiqueta-campo">Estado</label>
            <select id="f-estado" name="estado" defaultValue={p.estado ?? ""} className="entrada"><option value="">Todos</option><option value="atrasada">Atrasadas</option>{(Object.keys(ESTADOS) as EstadoLabor[]).map((k) => <option key={k} value={k}>{ESTADOS[k].texto}</option>)}</select></div>
          <div><label htmlFor="f-especie" className="etiqueta-campo">Cultivo</label>
            <select id="f-especie" name="especie" defaultValue={p.especie ?? ""} className="entrada"><option value="">Todos</option>{op.especies.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}</select></div>
          <div><label htmlFor="f-variedad" className="etiqueta-campo">Variedad</label>
            <select id="f-variedad" name="variedad" defaultValue={p.variedad ?? ""} className="entrada"><option value="">Todas</option>{op.variedadesTodas.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}</select></div>
          <div><label htmlFor="f-cuartel" className="etiqueta-campo">Cuartel</label>
            <select id="f-cuartel" name="cuartel" defaultValue={p.cuartel ?? ""} className="entrada"><option value="">Todos</option>{op.cuarteles.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}</select></div>
          <div><label htmlFor="f-trab" className="etiqueta-campo">Trabajador</label>
            <select id="f-trab" name="trabajador" defaultValue={p.trabajador ?? ""} className="entrada"><option value="">Todos</option>{op.trabajadores.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}</select></div>
          <div><label htmlFor="f-contr" className="etiqueta-campo">Contratista o cuadrilla</label>
            <select id="f-contr" name="contratista" defaultValue={p.contratista ?? ""} className="entrada"><option value="">Todos</option>{op.cuadrillas.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}</select></div>
          <div className="col-span-2 flex items-end gap-2 sm:col-span-4"><button className="boton">Aplicar</button><Link href={vista === "panel" ? "/labores" : `/labores?vista=${vista}`} className="boton-secundario">Limpiar</Link></div>
        </form>
      </details>

      {vista === "panel" && (
        <>
          <p className="mb-2 text-sm text-tinta-suave">
            Del {corta(desde)} al {corta(hasta)}
            {!esFecha(p.desde) && <> · <Link href={qs({ desde: `${mesMas(hoy.slice(0, 7), -1)}-01`, hasta: finDeMes(mesMas(hoy.slice(0, 7), -1)) })} className="underline">mes anterior</Link> · <Link href={qs({ desde: `${mesMas(hoy.slice(0, 7), 1)}-01`, hasta: finDeMes(mesMas(hoy.slice(0, 7), 1)) })} className="underline">mes siguiente</Link></>}
          </p>
          <section className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {([
              ["programado", "Pendientes", cuenta("programado")],
              ["en_ejecucion", "En ejecución", cuenta("en_ejecucion")],
              ["realizado", "Realizadas", cuenta("realizado")],
              ["reprogramado", "Reprogramadas", cuenta("reprogramado")],
            ] as const).map(([k, t, n]) => (
              <Link key={k} href={qs({ estado: p.estado === k ? undefined : k })} className={`tarjeta tocable p-3 ${p.estado === k ? "ring-2 ring-verde" : ""}`}>
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-tinta-suave"><span className={`size-2 rounded-full ${ESTADOS[k].punto}`} />{t}</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums">{n}</p>
              </Link>
            ))}
            <Link href={qs({ estado: p.estado === "atrasada" ? undefined : "atrasada" })} className={`tarjeta tocable p-3 ${atrasadas.length ? "border-alerta/40 bg-alerta-claro/40" : ""} ${p.estado === "atrasada" ? "ring-2 ring-alerta" : ""}`}>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-tinta-suave"><span className="size-2 rounded-full bg-alerta" />Atrasadas</p>
              <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${atrasadas.length ? "text-alerta" : ""}`}>{atrasadas.length}</p>
            </Link>
            <div className="tarjeta p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-tinta-suave">Cumplimiento</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums">{cumplimiento === null ? "—" : `${cumplimiento} %`}</p>
              <p className="text-[11px] text-tinta-suave">{hechasVencidas} de {vencidas.length} a la fecha</p>
            </div>
          </section>

          {veMonto && (presupuesto > 0 || real > 0) && (
            <section className="tarjeta mb-4 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">Presupuesto vs real</h2>
                <p className="text-sm"><strong className="tabular-nums">{clp(real)}</strong> <span className="text-tinta-suave">de {clp(presupuesto)} presupuestado</span></p>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-papel">
                <div className={`h-full rounded-full ${presupuesto > 0 && real > presupuesto ? "bg-alerta" : "bg-verde"}`} style={{ width: `${presupuesto > 0 ? Math.min(100, (real / presupuesto) * 100) : 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-tinta-suave">Real = labores realizadas o en ejecución (mano de obra, maquinaria e insumos). Presupuesto = todas las del período no canceladas.</p>
            </section>
          )}

          {(!p.estado || p.estado === "atrasada") && <Lista titulo="Atrasadas" punto="bg-alerta" items={atrasadas} acciones vacio={p.estado === "atrasada" ? "No hay labores atrasadas." : undefined} />}
          {(!p.estado || p.estado === "en_ejecucion") && <Lista titulo="En ejecución" punto={ESTADOS.en_ejecucion.punto} items={labores.filter((l) => l.estado === "en_ejecucion")} />}
          {(!p.estado || p.estado === "programado" || p.estado === "reprogramado") && (
            <Lista titulo="Por hacer" punto={ESTADOS.programado.punto} items={labores.filter((l) => (l.estado === "programado" || l.estado === "reprogramado") && l.fecha >= hoy)}
              vacio={p.estado ? undefined : "No hay labores por hacer en el período."} />
          )}
          {(!p.estado || p.estado === "realizado") && <Lista titulo="Realizadas" punto={ESTADOS.realizado.punto} items={labores.filter((l) => l.estado === "realizado").reverse()} />}
          {(!p.estado || p.estado === "cancelado") && <Lista titulo="Canceladas" punto={ESTADOS.cancelado.punto} items={labores.filter((l) => l.estado === "cancelado")} abierta={p.estado === "cancelado"} />}
          {labores.length === 0 && atrasadas.length === 0 && (
            <div className="tarjeta p-6 text-center">
              <p className="text-tinta-suave">No hay labores {filtrosActivos.length ? "con esos filtros" : "en este período"}.</p>
              {edita && <Link href="/labores/registrar" className="boton mt-3"><Icono nombre="mas" className="size-4" />Agregar labor</Link>}
            </div>
          )}
        </>
      )}

      {vista === "semana" && (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <Link href={qs({ semana: sumaDias(semana, -7) })} className="boton-secundario px-3" aria-label="Semana anterior">←</Link>
            <div className="text-center">
              <p className="font-medium">Semana del {corta(semana)} al {corta(sumaDias(semana, 6))}</p>
              {semana !== lunesDe(hoy) && <Link href={qs({ semana: undefined })} className="text-sm text-verde underline">Ir a esta semana</Link>}
            </div>
            <Link href={qs({ semana: sumaDias(semana, 7) })} className="boton-secundario px-3" aria-label="Semana siguiente">→</Link>
          </div>
          <div className="grid gap-2 lg:grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => sumaDias(semana, i)).map((d) => {
              const delDia = labores.filter((l) => l.fecha === d);
              return (
                <section key={d} className={`tarjeta flex flex-col overflow-hidden lg:min-h-48 ${d === hoy ? "ring-2 ring-verde" : ""}`}>
                  <div className={`flex items-center justify-between px-3 py-2 text-sm ${d === hoy ? "bg-verde text-white" : "bg-papel/70"}`}>
                    <span className="font-semibold capitalize"><span className="lg:hidden">{nombreDia(d)}</span><span className="hidden lg:inline">{nombreDia(d).slice(0, 3)}</span> {corta(d)}</span>
                    {edita && <Link href={`/labores/registrar?fecha=${d}`} className={`grid size-7 place-items-center rounded-md ${d === hoy ? "hover:bg-white/15" : "hover:bg-white"}`} aria-label={`Agregar labor el ${corta(d)}`}><Icono nombre="mas" className="size-4" /></Link>}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-2">
                    {delDia.length === 0 ? <p className="px-1 text-xs text-tinta-suave lg:hidden">Sin labores</p> : delDia.map((l) => <Chip key={l.id} l={l} />)}
                  </div>
                </section>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-tinta-suave">Toca una labor para verla, confirmarla o reprogramarla. Con el + agregas una labor ese día.</p>
        </>
      )}

      {vista === "mes" && (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <Link href={qs({ mes: mesMas(mes, -1) })} className="boton-secundario px-3" aria-label="Mes anterior">←</Link>
            <div className="text-center">
              <p className="font-medium capitalize">{MESES[Number(mes.slice(5, 7)) - 1]} {mes.slice(0, 4)}</p>
              {mes !== hoy.slice(0, 7) && <Link href={qs({ mes: undefined })} className="text-sm text-verde underline">Ir a este mes</Link>}
            </div>
            <Link href={qs({ mes: mesMas(mes, 1) })} className="boton-secundario px-3" aria-label="Mes siguiente">→</Link>
          </div>
          <div className="tarjeta overflow-hidden">
            <div className="grid grid-cols-7 border-b border-linea bg-papel/70 text-center text-[11px] font-semibold uppercase tracking-wide text-tinta-suave">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} className="py-1.5">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: Math.round((Date.parse(hasta) - Date.parse(desde)) / 864e5) + 1 }, (_, i) => sumaDias(desde, i)).map((d) => {
                const delDia = labores.filter((l) => l.fecha === d);
                const fuera = d.slice(0, 7) !== mes;
                return (
                  <div key={d} className={`min-h-16 border-b border-r border-linea p-1 sm:min-h-24 ${fuera ? "bg-papel/40 text-tinta-suave/60" : ""}`}>
                    <Link href={qs({ vista: "semana", semana: d, mes: undefined })} className={`mb-0.5 inline-grid size-6 place-items-center rounded-full text-xs ${d === hoy ? "bg-verde font-bold text-white" : "font-medium"}`}>{Number(d.slice(8, 10))}</Link>
                    {/* Celular: puntos de color; computador: nombres */}
                    <div className="flex flex-wrap gap-0.5 sm:hidden">
                      {delDia.slice(0, 6).map((l) => <Link key={l.id} href={`/labores/${l.id}`} className={`size-2.5 rounded-full ${estaAtrasada(l, hoy) ? "bg-alerta" : ESTADOS[l.estado as EstadoLabor].punto}`} aria-label={op.nombres.labor.get(l.labor_tipo_id)} />)}
                      {delDia.length > 6 && <span className="text-[9px] leading-none">+{delDia.length - 6}</span>}
                    </div>
                    <div className="hidden flex-col gap-0.5 sm:flex">
                      {delDia.slice(0, 3).map((l) => <Chip key={l.id} l={l} />)}
                      {delDia.length > 3 && <Link href={qs({ vista: "semana", semana: d, mes: undefined })} className="px-1 text-[11px] text-tinta-suave hover:underline">+{delDia.length - 3} más</Link>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">
            {(Object.keys(ESTADOS) as EstadoLabor[]).map((k) => <li key={k} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-full ${ESTADOS[k].punto}`} />{ESTADOS[k].texto}</li>)}
            <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-alerta" />Atrasada</li>
          </ul>
        </>
      )}
    </>
  );
}
