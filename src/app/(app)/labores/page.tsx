import Link from "next/link";
import { exigirRol, puede } from "@/lib/auth";
import { clp, num } from "@/lib/formato";
import { corta, esFecha, hoyChile, lunesDe, nombreDia, sumaDias } from "@/lib/semana";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { BotonBorrar } from "@/components/BotonBorrar";
import { Icono } from "@/components/Icono";
import { confirmarRegistro, borrarRegistro } from "./acciones";
import { cargarOpciones } from "./lib";
import { enlaceWhatsapp, telefonoChile } from "@/lib/whatsapp";

export const metadata = { title: "Labores" };

const CAMPOS = "id, fecha, cuartel_id, variedad_id, labor_tipo_id, cuadrilla_id, fiscalizador_id, personas, jornadas, modalidad, observacion, estado";

export default async function Labores({ searchParams }: { searchParams: Promise<{ semana?: string; ok?: string }> }) {
  const p = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario", "operario");
  const edita = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");
  const veMonto = puede(perfil.rol, "administrador", "enc_administrativo", "propietario");

  const hoy = hoyChile();
  const semana = esFecha(p.semana) ? lunesDe(p.semana) : lunesDe(hoy);
  const fin = sumaDias(semana, 6);
  const dias = Array.from({ length: 7 }, (_, i) => sumaDias(semana, i));

  const [{ data: regs }, op, { data: atrasadas }] = await Promise.all([
    supabase.from("labor_registro").select(CAMPOS).gte("fecha", semana).lte("fecha", fin).order("fecha").order("creado_en"),
    cargarOpciones(supabase),
    // Lo que estaba por hacer y su día ya llegó (de cualquier semana): hay que confirmar si se hizo
    supabase.from("labor_registro").select(CAMPOS).eq("estado", "programado").lte("fecha", hoy).order("fecha"),
  ]);
  const todos = [...((regs ?? []) as any[]), ...((atrasadas ?? []) as any[])];
  const ids = [...new Set(todos.map((r) => r.id))];
  const { data: pagos } = veMonto && ids.length ? await supabase.from("labor_pago").select("registro_id, monto").in("registro_id", ids) : { data: [] as any[] };
  const montoDe = new Map<string, number>((pagos ?? []).map((x: any) => [x.registro_id as string, Number(x.monto)]));

  const porConfirmar = (atrasadas ?? []) as any[];
  const porHacer = ((regs ?? []) as any[]).filter((r) => r.estado === "programado" && r.fecha > hoy);
  const hechos = ((regs ?? []) as any[]).filter((r) => r.estado !== "programado");
  const totalJ = hechos.reduce((s, r) => s + Number(r.jornadas ?? 0), 0);
  const totalM = hechos.reduce((s, r) => s + (montoDe.get(r.id) ?? 0), 0);
  const volver = `/labores?semana=${semana}`;

  const detalle = (r: any) =>
    [
      r.cuadrilla_id ? op.nombres.cuadrilla.get(r.cuadrilla_id) : "Personal propio",
      r.personas ? `${r.personas} personas` : null,
      r.estado !== "programado" && r.jornadas ? `${num(Number(r.jornadas), 1)} jornadas` : null,
      r.modalidad === "trato" ? "trato" : null,
      r.fiscalizador_id ? `${r.estado === "programado" ? "fiscaliza" : "fiscalizó"} ${op.nombres.trabajador.get(r.fiscalizador_id)}` : null,
      r.observacion,
    ].filter(Boolean).join(" · ");

  const Acciones = ({ r, conHecho }: { r: any; conHecho?: boolean }) => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {conHecho && (
        <form action={confirmarRegistro}>
          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="volver" value={volver} />
          <button className="boton min-h-9 px-3 py-1.5"><Icono nombre="ok" className="size-4" />Sí, se hizo</button>
        </form>
      )}
      <Link href={`/labores/registro/${r.id}`} className="font-medium text-verde hover:underline">Editar</Link>
      <form action={borrarRegistro}>
        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="semana" value={semana} />
        <BotonBorrar pregunta={r.estado === "programado" ? "¿Borrar esta labor por hacer?" : "¿Borrar este trabajo? Se borra también su monto."} />
      </form>
    </div>
  );

  const Avisos = ({ r }: { r: any }) => {
    const labor = (op.nombres.labor.get(r.labor_tipo_id) ?? "labor").toLowerCase();
    const donde = r.cuartel_id ? `en el cuartel ${op.nombres.cuartel.get(r.cuartel_id)}` : r.variedad_id ? `en ${op.donde(r)}` : "en el campo";
    const cuando = `el ${nombreDia(r.fecha)} ${corta(r.fecha)}`;
    const gato = r.cuadrilla_id ? op.nombres.cuadrilla.get(r.cuadrilla_id) : null;
    const nota = r.observacion ? ` ${r.observacion}.` : "";
    const aFisc = r.fiscalizador_id ? `Hola ${op.nombres.trabajador.get(r.fiscalizador_id)}, ${cuando} toca ${labor} ${donde}.${gato ? ` Trabaja ${gato}.` : ""} Tú fiscalizas que quede bien hecha.${nota} Cuando termine, avísame. — Agrícola BAS` : null;
    const aGato = gato ? `Hola, ${cuando} toca ${labor} ${donde}.${r.personas ? ` Necesitamos ${r.personas} personas.` : ""}${nota} Confírmame por favor. — Agrícola BAS` : null;
    const telF = r.fiscalizador_id ? op.telefonos.trabajador.get(r.fiscalizador_id) : null;
    const telG = r.cuadrilla_id ? op.telefonos.cuadrilla.get(r.cuadrilla_id) : null;
    if (!aFisc && !aGato) return null;
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {aFisc && <a href={enlaceWhatsapp(telF, aFisc)} target="_blank" rel="noopener noreferrer" className="hover:underline" title={telefonoChile(telF) ? "Abre WhatsApp con el mensaje listo" : "Sin celular guardado: WhatsApp te deja elegir el contacto"}>Avisar al fiscalizador</a>}
        {aGato && <a href={enlaceWhatsapp(telG, aGato)} target="_blank" rel="noopener noreferrer" className="hover:underline">Avisar a la cuadrilla</a>}
      </div>
    );
  };

  const botones = (
    <>
      {edita && <Link href="/labores/registrar" className="boton"><Icono nombre="mas" className="size-4" />Agregar labor</Link>}
      {perfil.rol !== "operario" && <Link href="/labores/resumen" className="boton-secundario"><Icono nombre="finanzas" className="size-4" />Resumen</Link>}
      {perfil.rol !== "operario" && <Link href="/labores/catalogos" className="boton-secundario">Cuadrillas y trabajadores</Link>}
    </>
  );

  return (
    <>
      <Encabezado titulo="Labores" subtitulo="Anota cada labor una vez: lo que está por hacer queda en azul y, cuando se haga, lo confirmas." acciones={botones} />
      {p.ok === "registro" && <div className="mb-4"><Aviso tipo="ok">Trabajo guardado.</Aviso></div>}
      {p.ok === "por_hacer" && <div className="mb-4"><Aviso tipo="ok">Labor guardada como por hacer. Cuando llegue el día, la app te preguntará si se hizo.</Aviso></div>}
      {p.ok === "hecho" && <div className="mb-4"><Aviso tipo="ok">Listo, quedó como hecha.</Aviso></div>}
      {p.ok === "editado" && <div className="mb-4"><Aviso tipo="ok">Cambios guardados.</Aviso></div>}

      {edita && porConfirmar.length > 0 && (
        <section className="mb-4 overflow-hidden rounded-[var(--radius-tarjeta)] border border-ambar/40 bg-white">
          <h2 className="bg-ambar-claro px-4 py-2 text-sm font-semibold text-ambar">¿Se hicieron? ({porConfirmar.length})</h2>
          <ul className="divide-y divide-linea">
            {porConfirmar.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{op.nombres.labor.get(r.labor_tipo_id)} · {op.donde(r)}</p>
                  <p className="text-sm text-tinta-suave">Era para el {nombreDia(r.fecha)} {corta(r.fecha)} · {detalle(r)}</p>
                </div>
                <Acciones r={r} conHecho />
              </li>
            ))}
          </ul>
          <p className="border-t border-linea px-4 py-2 text-xs text-tinta-suave">Si no se hizo ese día, toca Editar y cámbiale la fecha.</p>
        </section>
      )}

      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={`/labores?semana=${sumaDias(semana, -7)}`} className="boton-secundario px-3" aria-label="Semana anterior">←</Link>
        <div className="text-center">
          <p className="font-medium">Semana del {corta(semana)} al {corta(fin)}</p>
          {semana !== lunesDe(hoy) && <Link href="/labores" className="text-sm text-verde underline">Ir a esta semana</Link>}
        </div>
        <Link href={`/labores?semana=${sumaDias(semana, 7)}`} className="boton-secundario px-3" aria-label="Semana siguiente">→</Link>
      </div>

      <section className="tarjeta mb-4 overflow-hidden">
        <h2 className="flex items-center gap-2 p-4 pb-2 font-semibold"><span className="size-2.5 rounded-full bg-agua" />Por hacer</h2>
        {porHacer.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-tinta-suave">
            Nada por hacer anotado para lo que queda de esta semana.{" "}
            {edita && <Link href="/labores/registrar?estado=programado" className="text-verde underline">Agregar una labor por hacer</Link>}
          </p>
        ) : (
          <ul className="divide-y divide-linea border-t border-linea">
            {porHacer.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 px-4 py-3 shadow-[inset_4px_0_0_var(--color-agua)]">
                <div>
                  <p className="font-medium">{op.nombres.labor.get(r.labor_tipo_id)} · {op.donde(r)}</p>
                  <p className="text-sm text-tinta-suave"><span className="font-medium text-agua first-letter:uppercase">{nombreDia(r.fecha)} {corta(r.fecha)}</span> · {detalle(r)}{veMonto && montoDe.has(r.id) ? ` · ${clp(montoDe.get(r.id))} acordado` : ""}</p>
                </div>
                {edita && <><Avisos r={r} /><Acciones r={r} /></>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tarjeta overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-2">
          <h2 className="flex items-center gap-2 font-semibold"><span className="size-2.5 rounded-full bg-verde" />Hecho</h2>
          <p className="text-sm text-tinta-suave">{num(totalJ, 1)} jornadas{veMonto && totalM > 0 ? ` · ${clp(totalM)}` : ""}</p>
        </div>
        {hechos.length === 0 && <p className="px-4 pb-4 text-sm text-tinta-suave">Todavía no hay trabajo hecho anotado en esta semana.</p>}
        {dias.map((d) => {
          const delDia = hechos.filter((r) => r.fecha === d);
          if (delDia.length === 0) return null;
          return (
            <div key={d} className="border-t border-linea">
              <p className="bg-papel/60 px-4 py-1.5 text-sm font-medium capitalize">{nombreDia(d)} {corta(d)} <span className="font-normal text-tinta-suave">· {num(delDia.reduce((s, r) => s + Number(r.jornadas ?? 0), 0), 1)} jornadas</span></p>
              {delDia.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                  <div className="min-w-56 flex-1">
                    <p className="font-medium">{op.nombres.labor.get(r.labor_tipo_id)} · {op.donde(r)}</p>
                    <p className="text-sm text-tinta-suave">{detalle(r)}</p>
                  </div>
                  {veMonto && montoDe.has(r.id) && <span className="text-sm font-medium">{clp(montoDe.get(r.id))}</span>}
                  {edita && <Acciones r={r} />}
                </div>
              ))}
            </div>
          );
        })}
      </section>
    </>
  );
}
