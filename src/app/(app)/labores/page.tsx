import Link from "next/link";
import { exigirRol, puede } from "@/lib/auth";
import { clp, num } from "@/lib/formato";
import { corta, esFecha, hoyChile, lunesDe, nombreDia, sumaDias } from "@/lib/semana";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";
import { borrarPlan, borrarRegistro, cambiarEstadoPlan } from "./acciones";
import { cargarOpciones } from "./lib";

export const metadata = { title: "Labores" };

export default async function Labores({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const p = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const edita = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");
  const veMonto = puede(perfil.rol, "administrador", "enc_administrativo", "propietario");

  const hoy = hoyChile();
  const semana = esFecha(p.semana) ? lunesDe(p.semana) : lunesDe(hoy);
  const fin = sumaDias(semana, 6);
  const dias = Array.from({ length: 7 }, (_, i) => sumaDias(semana, i));

  const [{ data: plan }, { data: regs }, op] = await Promise.all([
    supabase.from("labor_plan").select("id, cuartel_id, labor_tipo_id, cuadrilla_id, fiscalizador_id, personas_previstas, observacion, estado").eq("semana", semana).order("creado_en"),
    supabase.from("labor_registro").select("id, fecha, cuartel_id, labor_tipo_id, cuadrilla_id, fiscalizador_id, personas, jornadas, modalidad, observacion").gte("fecha", semana).lte("fecha", fin).order("fecha").order("creado_en"),
    cargarOpciones(supabase),
  ]);
  const ids = (regs ?? []).map((r: any) => r.id);
  const { data: pagos } = veMonto && ids.length ? await supabase.from("labor_pago").select("registro_id, monto").in("registro_id", ids) : { data: [] as any[] };
  const montoDe = new Map<string, number>((pagos ?? []).map((x: any) => [x.registro_id as string, Number(x.monto)]));

  const totalJ = (regs ?? []).reduce((s: number, r: any) => s + Number(r.jornadas), 0);
  const totalM = [...montoDe.values()].reduce((s, m) => s + m, 0);

  const botones = (
    <>
      {edita && <Link href="/labores/registrar" className="boton"><Icono nombre="mas" className="size-4" />Registrar trabajo</Link>}
      {edita && <Link href={`/labores/plan?semana=${semana}`} className="boton-secundario">Planificar</Link>}
      <Link href="/labores/resumen" className="boton-secundario"><Icono nombre="finanzas" className="size-4" />Resumen</Link>
      <Link href="/labores/catalogos" className="boton-secundario">Cuadrillas, trabajadores y labores</Link>
    </>
  );

  return (
    <>
      <Encabezado titulo="Labores" subtitulo="Plan de la semana y trabajo realizado por cada cuadrilla." acciones={botones} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/labores?semana=${sumaDias(semana, -7)}`} className="boton-secundario">← Semana anterior</Link>
        <p className="px-2 font-medium">Semana del {corta(semana)} al {corta(fin)}</p>
        <Link href={`/labores?semana=${sumaDias(semana, 7)}`} className="boton-secundario">Semana siguiente →</Link>
        {semana !== lunesDe(hoy) && <Link href="/labores" className="text-sm underline">Ir a esta semana</Link>}
      </div>

      <section className="tarjeta mb-4">
        <h2 className="p-4 pb-2 font-semibold">Plan de la semana</h2>
        {(plan ?? []).length === 0 ? (
          <p className="px-4 pb-4 text-sm text-tinta-suave">Todavía no hay nada planificado. {edita && <Link href={`/labores/plan?semana=${semana}`} className="underline">Agregar al plan</Link>}</p>
        ) : (
          (plan ?? []).map((x: any) => (
            <div key={x.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-linea px-4 py-3 ${x.estado !== "pendiente" ? "text-tinta-suave" : ""}`}>
              <div className="min-w-56 flex-1">
                <p className={`font-medium ${x.estado === "cancelada" ? "line-through" : ""}`}>{op.nombres.labor.get(x.labor_tipo_id)} · {x.cuartel_id ? op.nombres.cuartel.get(x.cuartel_id) : "General del campo"}</p>
                <p className="text-sm text-tinta-suave">
                  {x.cuadrilla_id ? op.nombres.cuadrilla.get(x.cuadrilla_id) : "Cuadrilla por definir"}
                  {x.personas_previstas ? ` · ${x.personas_previstas} personas` : ""}{x.fiscalizador_id ? ` · fiscaliza ${op.nombres.trabajador.get(x.fiscalizador_id)}` : ""}{x.observacion ? ` · ${x.observacion}` : ""}
                </p>
              </div>
              <span className={`pastilla ${x.estado === "hecha" ? "bg-verde-claro text-verde-oscuro" : x.estado === "cancelada" ? "bg-alerta-claro text-alerta" : "bg-ambar-claro text-ambar"}`}>{x.estado === "hecha" ? "Hecha" : x.estado === "cancelada" ? "Cancelada" : "Pendiente"}</span>
              {edita && (
                <div className="flex items-center gap-3 text-sm">
                  {x.estado === "pendiente" && <Link href={`/labores/registrar?plan=${x.id}`} className="font-medium text-verde hover:underline">Registrar</Link>}
                  <form action={cambiarEstadoPlan}>
                    <input type="hidden" name="id" value={x.id} /><input type="hidden" name="semana" value={semana} />
                    <input type="hidden" name="estado" value={x.estado === "pendiente" ? "cancelada" : "pendiente"} />
                    <button className="hover:underline">{x.estado === "pendiente" ? "Cancelar" : "Reabrir"}</button>
                  </form>
                  <form action={borrarPlan}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="semana" value={semana} /><button className="text-alerta hover:underline">Borrar</button></form>
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <section className="tarjeta">
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-2">
          <h2 className="font-semibold">Trabajo registrado</h2>
          <p className="text-sm text-tinta-suave">{num(totalJ, 1)} jornadas{veMonto && totalM > 0 ? ` · ${clp(totalM)}` : ""}</p>
        </div>
        {(regs ?? []).length === 0 && <div className="px-4 pb-4"><Aviso>Aún no hay trabajo registrado esta semana.</Aviso></div>}
        {dias.map((d) => {
          const delDia = (regs ?? []).filter((r: any) => r.fecha === d);
          if (delDia.length === 0) return null;
          return (
            <div key={d} className="border-t border-linea">
              <p className="bg-papel/60 px-4 py-1.5 text-sm font-medium capitalize">{nombreDia(d)} {corta(d)} <span className="font-normal text-tinta-suave">· {num(delDia.reduce((s: number, r: any) => s + Number(r.jornadas), 0), 1)} jornadas</span></p>
              {delDia.map((r: any) => (
                <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                  <div className="min-w-56 flex-1">
                    <p className="font-medium">{op.nombres.labor.get(r.labor_tipo_id)} · {r.cuartel_id ? op.nombres.cuartel.get(r.cuartel_id) : "General del campo"}</p>
                    <p className="text-sm text-tinta-suave">
                      {r.cuadrilla_id ? op.nombres.cuadrilla.get(r.cuadrilla_id) : "Personal propio"} · {r.personas} personas · {num(Number(r.jornadas), 1)} jornadas · {r.modalidad === "trato" ? "trato" : "por día"}{r.fiscalizador_id ? ` · fiscalizó ${op.nombres.trabajador.get(r.fiscalizador_id)}` : ""}
                      {r.observacion ? ` · ${r.observacion}` : ""}
                    </p>
                  </div>
                  {veMonto && montoDe.has(r.id) && <span className="text-sm font-medium">{clp(montoDe.get(r.id))}</span>}
                  {edita && <form action={borrarRegistro}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="semana" value={semana} /><button className="text-sm text-alerta hover:underline">Borrar</button></form>}
                </div>
              ))}
            </div>
          );
        })}
      </section>
    </>
  );
}
