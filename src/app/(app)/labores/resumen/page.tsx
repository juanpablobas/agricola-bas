import Link from "next/link";
import { exigirRol, puede } from "@/lib/auth";
import { clp, num } from "@/lib/formato";
import { esFecha, hoyChile } from "@/lib/semana";
import { leerTodo } from "@/lib/programas";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { cargarOpciones } from "../lib";

export const metadata = { title: "Resumen de labores" };

const AGRUPA = { labor: "Por labor", cuartel: "Por cuartel", cuadrilla: "Por cuadrilla", fiscalizador: "Por quien fiscaliza" } as const;

export default async function Resumen({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; por?: string }> }) {
  const p = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const veMonto = puede(perfil.rol, "administrador", "enc_administrativo", "propietario");

  const hoy = hoyChile();
  const desde = esFecha(p.desde) ? p.desde : hoy.slice(0, 8) + "01";
  const hasta = esFecha(p.hasta) ? p.hasta : hoy;
  const por = (p.por === "cuartel" || p.por === "cuadrilla" || p.por === "fiscalizador" ? p.por : "labor") as keyof typeof AGRUPA;

  const op = await cargarOpciones(supabase);
  const regs = await leerTodo<any>((d, h) =>
    supabase.from("labor_registro").select("id, fecha, cuartel_id, variedad_id, labor_tipo_id, cuadrilla_id, fiscalizador_id, personas, jornadas").gte("fecha", desde).lte("fecha", hasta).order("id").range(d, h));
  const montoDe = new Map<string, number>();
  if (veMonto && regs.length) {
    for (let i = 0; i < regs.length; i += 200) {
      const { data } = await supabase.from("labor_pago").select("registro_id, monto").in("registro_id", regs.slice(i, i + 200).map((r) => r.id));
      for (const x of (data ?? []) as any[]) montoDe.set(x.registro_id, Number(x.monto));
    }
  }

  const grupos = new Map<string, { nombre: string; reg: number; jornadas: number; monto: number; conMonto: number; jornadasConMonto: number }>();
  for (const r of regs) {
    const id = por === "labor" ? r.labor_tipo_id : por === "cuartel" ? r.cuartel_id ?? (r.variedad_id ? `v:${r.variedad_id}` : "general") : por === "fiscalizador" ? r.fiscalizador_id ?? "nadie" : r.cuadrilla_id ?? "propio";
    const nombre = por === "fiscalizador" ? (id === "nadie" ? "Sin fiscalizador" : op.nombres.trabajador.get(id)) : por === "labor" ? op.nombres.labor.get(id) : por === "cuartel" ? op.donde(r) : id === "propio" ? "Personal propio" : op.nombres.cuadrilla.get(id);
    const g = grupos.get(id) ?? { nombre: nombre ?? "—", reg: 0, jornadas: 0, monto: 0, conMonto: 0, jornadasConMonto: 0 };
    g.reg++;
    g.jornadas += Number(r.jornadas);
    if (montoDe.has(r.id)) { g.monto += montoDe.get(r.id)!; g.conMonto++; g.jornadasConMonto += Number(r.jornadas); }
    grupos.set(id, g);
  }
  const filas = [...grupos.values()].sort((a, b) => b.jornadas - a.jornadas);
  const totJ = filas.reduce((s, g) => s + g.jornadas, 0);
  const totM = filas.reduce((s, g) => s + g.monto, 0);
  const sinMonto = regs.length - montoDe.size;

  return (
    <>
      <Encabezado titulo="Resumen de labores" subtitulo="Cuántas jornadas se trabajaron, y cuánto se pagó si está anotado." volver={{ href: "/labores", texto: "Labores" }} />
      <form method="get" className="tarjeta mb-4 flex flex-wrap items-end gap-3 p-4">
        <div><label htmlFor="desde" className="etiqueta-campo">Desde</label><input id="desde" name="desde" type="date" defaultValue={desde} className="entrada" /></div>
        <div><label htmlFor="hasta" className="etiqueta-campo">Hasta</label><input id="hasta" name="hasta" type="date" defaultValue={hasta} className="entrada" /></div>
        <div><label htmlFor="por" className="etiqueta-campo">Agrupar</label>
          <select id="por" name="por" defaultValue={por} className="entrada">{Object.entries(AGRUPA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <button className="boton">Ver</button>
      </form>

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Registros</p><p className="mt-1 text-2xl font-semibold">{num(regs.length)}</p></div>
        <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Jornadas</p><p className="mt-1 text-2xl font-semibold">{num(totJ, 1)}</p></div>
        {veMonto && <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Monto anotado</p><p className="mt-1 text-2xl font-semibold">{clp(totM)}</p></div>}
        {veMonto && totM > 0 && <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Promedio por jornada</p><p className="mt-1 text-2xl font-semibold">{clp(totM / Math.max(1, filas.reduce((s, g) => s + g.jornadasConMonto, 0)))}</p></div>}
      </section>

      {veMonto && regs.length > 0 && sinMonto > 0 && <div className="mb-3"><Aviso>{sinMonto} de {regs.length} registros no tienen monto anotado, así que el total pagado puede estar incompleto.</Aviso></div>}

      <section className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead><tr><th>{AGRUPA[por].replace("Por ", "")[0].toUpperCase() + AGRUPA[por].replace("Por ", "").slice(1)}</th><th className="text-right">Registros</th><th className="text-right">Jornadas</th>{veMonto && <th className="text-right">Monto</th>}</tr></thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-tinta-suave">No hay registros en ese período.</td></tr>}
            {filas.map((g) => (
              <tr key={g.nombre}>
                <td className="font-medium">{g.nombre}</td>
                <td className="text-right">{g.reg}</td>
                <td className="text-right">{num(g.jornadas, 1)}</td>
                {veMonto && <td className="text-right">{g.conMonto ? clp(g.monto) : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="mt-3 text-xs text-tinta-suave">Una jornada es una persona trabajando un día. <Link href="/labores" className="underline">Volver a la semana</Link></p>
    </>
  );
}
