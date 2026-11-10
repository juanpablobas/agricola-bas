import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirRol, puede } from "@/lib/auth";
import { clp, fecha, fechaHora, num } from "@/lib/formato";
import { hoyChile, nombreDia } from "@/lib/semana";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";
import { BotonBorrar } from "@/components/BotonBorrar";
import { BotonEnviar } from "@/components/BotonEnviar";
import { SubirArchivo } from "@/components/SubirArchivo";
import { cargarOpciones } from "../lib";
import { enlaceWhatsapp, telefonoChile } from "@/lib/whatsapp";
import { ESTADOS, MOTIVOS, PAGOS, avance, costos, estaAtrasada, nombreCobro, nombreMotivo, nombreUnidad, type EstadoLabor } from "../modelo";
import {
  actualizarPago, agregarInsumo, quitarInsumo, borrarArchivoLabor, borrarAvance, borrarLabor, cambiarEstado, comentarFiscalizador, registrarArchivoLabor, registrarAvance, reprogramar,
} from "../labor-acciones";

export const metadata = { title: "Labor" };

const OK: Record<string, string> = {
  creada: "Labor guardada.", editada: "Cambios guardados.", estado: "Estado actualizado.", reprogramada: "Labor reprogramada. La fecha original queda guardada.",
  avance: "Avance registrado.", avance_completo: "Avance registrado: ya se completó lo planificado. Si terminó, márcala como realizada.",
  pago: "Pago actualizado.", comentario: "Comentario guardado.", insumo: "Insumo agregado.", insumo_quitado: "Insumo quitado. Si se había descontado, volvió a la bodega.",
};
const ERROR: Record<string, string> = {
  reprogramar: "Para reprogramar indica la nueva fecha y el motivo.",
  avance: "Revisa el avance: una cantidad mayor a cero y una fecha que no sea futura.",
  insumo: "Revisa el insumo: elige un producto y una cantidad mayor a cero.",
  insumo_ha: "Para calcular por hectárea, la labor necesita una superficie (cuartel, variedad o cantidad en hectáreas).",
  insumo_quitar: "No se pudo devolver el producto a bodega. Pide al administrador que lo quite.",
};

function Dato({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-tinta-suave">{t}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export default async function Labor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; sinstock?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario", "operario");
  const edita = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");
  const veMonto = puede(perfil.rol, "administrador", "enc_administrativo", "propietario");
  const gestionaPago = puede(perfil.rol, "administrador", "enc_administrativo");

  const { data: l } = await supabase.from("labor_registro").select("*").eq("id", id).maybeSingle();
  if (!l) notFound();
  const [op, { data: trab }, { data: avances }, { data: hist }, { data: archivos }, { data: usuarios }, { data: insumos }, { data: bodega }] = await Promise.all([
    cargarOpciones(supabase, { cuadrilla: l.cuadrilla_id, labor: l.labor_tipo_id, fiscalizador: l.fiscalizador_id }),
    supabase.from("labor_trabajador").select("trabajador_id").eq("labor_id", id),
    supabase.from("labor_avance").select("id, fecha, cantidad, observacion, creado_por").eq("labor_id", id).order("fecha", { ascending: false }),
    supabase.from("labor_historial").select("*").eq("labor_id", id).order("creado_en", { ascending: false }),
    supabase.from("archivo").select("id, ruta, nombre, mime, bytes, creado_en, subido_por").eq("entidad", "labor").eq("entidad_id", id).order("creado_en", { ascending: false }),
    supabase.from("perfil").select("id, nombre, email"),
    supabase.from("labor_insumo").select("id, cantidad, costo_unitario, descontar, mov_id, observacion, producto(id, nombre, unidad)").eq("labor_id", id).order("creado_en"),
    supabase.from("v_stock").select("producto_id, nombre, unidad, clasificacion, stock").gt("stock", 0).order("nombre").range(0, 999),
  ]);
  const usuario = new Map(((usuarios ?? []) as any[]).map((u) => [u.id as string, (u.nombre || u.email) as string]));
  const rutas = ((archivos ?? []) as any[]).map((a) => a.ruta);
  const { data: firmadas } = rutas.length ? await supabase.storage.from("archivos").createSignedUrls(rutas, 3600) : { data: [] as { path: string | null; signedUrl: string }[] };
  const url = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));
  const fotos = ((archivos ?? []) as any[]).filter((a) => a.mime?.startsWith("image/"));
  const docs = ((archivos ?? []) as any[]).filter((a) => !a.mime?.startsWith("image/"));

  // ¿La factura del contratista ya está en Finanzas? (para no contar dos veces)
  const { data: enFinanzas } = veMonto && l.documento
    ? await supabase.from("gasto").select("fecha, total, detalle, proveedor(nombre)").eq("numero_documento", l.documento).limit(3)
    : { data: [] as any[] };

  const hoy = hoyChile();
  const estado = l.estado as EstadoLabor;
  // Superficie de la labor, para calcular insumos por hectárea
  const haLabor = l.unidad_cantidad === "ha" && l.cantidad_plan ? Number(l.cantidad_plan)
    : l.cuartel_id ? op.cuarteles.find((c) => c.id === l.cuartel_id)?.ha ?? null
    : l.variedad_id ? op.variedades.find((v) => v.id === `v:${l.variedad_id}`)?.ha ?? null : null;
  const listaInsumos = (insumos ?? []) as any[];
  const porClase = new Map<string, any[]>();
  for (const b of (bodega ?? []) as any[]) porClase.set(b.clasificacion ?? "Otros", [...(porClase.get(b.clasificacion ?? "Otros") ?? []), b]);
  const e = ESTADOS[estado];
  const atrasada = estaAtrasada(l, hoy);
  const pct = avance(l);
  const c = costos(l);
  const pres = l.presupuesto != null ? Number(l.presupuesto) : null;
  const unidad = nombreUnidad(l.unidad_cantidad);
  const trabajadores = ((trab ?? []) as any[]).map((t) => op.nombres.trabajador.get(t.trabajador_id) ?? "—");
  const labor = op.nombres.labor.get(l.labor_tipo_id) ?? "Labor";
  const pendiente = estado === "programado" || estado === "reprogramado";

  const BotonEstado = ({ a, texto, primario = false, icono }: { a: EstadoLabor; texto: string; primario?: boolean; icono?: string }) => (
    <form action={cambiarEstado}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="estado" value={a} />
      <button className={`${primario ? "boton" : "boton-secundario"} w-full`}>{icono && <Icono nombre={icono} className="size-4" />}{texto}</button>
    </form>
  );

  return (
    <>
      <Encabezado
        titulo={labor}
        subtitulo={<>{op.donde(l)} · {op.nombres.categoria.get(l.labor_tipo_id)}</>}
        volver={{ href: "/labores", texto: "Labores" }}
        acciones={edita ? <Link href={`/labores/registro/${id}`} className="boton-secundario"><Icono nombre="editar" className="size-4" />Editar</Link> : undefined}
      />
      {q.ok && OK[q.ok] && <div className="mb-4"><Aviso tipo="ok">{OK[q.ok]}</Aviso></div>}
      {q.error && ERROR[q.error] && <div className="mb-4"><Aviso tipo="error">{ERROR[q.error]}</Aviso></div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Estado y fechas */}
          <section className="tarjeta overflow-hidden" style={{ boxShadow: `inset 4px 0 0 ${e.borde}` }}>
            <div className="flex flex-wrap items-center gap-2 p-4 pb-3">
              <span className={`pastilla ${e.pastilla}`}>{e.texto}</span>
              {atrasada && <span className="pastilla bg-alerta-claro text-alerta">Atrasada</span>}
              {l.ejecucion === "contratista" && <span className="pastilla bg-papel">Contratista</span>}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 sm:grid-cols-4">
              <Dato t="Planificada">{fecha(l.fecha_original ?? l.fecha)}</Dato>
              <Dato t={l.fecha_original && l.fecha_original !== l.fecha ? "Reprogramada para" : "Programada"}>
                <span className={l.fecha_original && l.fecha_original !== l.fecha ? "text-[#6b3fa0]" : ""}><span className="capitalize">{nombreDia(l.fecha).slice(0, 3)}</span> {fecha(l.fecha)}</span>
              </Dato>
              <Dato t="Inicio real">{l.fecha_inicio ? fecha(l.fecha_inicio) : "—"}</Dato>
              <Dato t="Término real">{l.fecha_termino ? fecha(l.fecha_termino) : "—"}</Dato>
            </dl>
            {(l.cantidad_plan != null || l.cantidad_ejecutada != null) && (
              <div className="border-t border-linea px-4 py-3">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>Ejecutado <strong>{num(Number(l.cantidad_ejecutada ?? 0), 2)}</strong>{l.cantidad_plan != null && <> de {num(Number(l.cantidad_plan), 2)}</>} {unidad}</span>
                  {pct !== null && <strong className="tabular-nums">{pct} %</strong>}
                </div>
                {pct !== null && <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-papel"><div className="h-full rounded-full bg-verde transition-all" style={{ width: `${pct}%` }} /></div>}
              </div>
            )}
          </section>

          {/* Acciones */}
          {edita && (
            <section className="tarjeta p-4">
              <h2 className="mb-3 font-semibold">¿Qué pasó con esta labor?</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {pendiente && <BotonEstado a="en_ejecucion" texto="Empezó" icono="labores" />}
                {estado !== "realizado" && estado !== "cancelado" && <BotonEstado a="realizado" texto="Se terminó" primario icono="ok" />}
                {estado === "en_ejecucion" && <BotonEstado a="programado" texto="Volver a pendiente" />}
                {(estado === "realizado" || estado === "cancelado") && <BotonEstado a="programado" texto="Reabrir" />}
                {estado === "realizado" && <BotonEstado a="en_ejecucion" texto="Sigue en ejecución" />}
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {estado !== "realizado" && estado !== "cancelado" && (
                  <details className="group rounded-xl border border-linea">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium"><Icono nombre="historia" className="size-4" />Reprogramar (cambiar fecha con motivo)</summary>
                    <form action={reprogramar} className="grid gap-3 border-t border-linea p-3 sm:grid-cols-3">
                      <input type="hidden" name="id" value={id} />
                      <div><label htmlFor="nueva_fecha" className="etiqueta-campo">Nueva fecha</label><input id="nueva_fecha" name="nueva_fecha" type="date" required min={hoy} className="entrada" /></div>
                      <div><label htmlFor="motivo" className="etiqueta-campo">Motivo</label>
                        <select id="motivo" name="motivo" required defaultValue="" className="entrada"><option value="" disabled>Elegir…</option>{MOTIVOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
                      <div><label htmlFor="obs_rep" className="etiqueta-campo">Observaciones</label><input id="obs_rep" name="observacion" className="entrada" placeholder="Opcional" /></div>
                      <div className="sm:col-span-3"><BotonEnviar className="boton">Reprogramar</BotonEnviar></div>
                    </form>
                  </details>
                )}
                {estado !== "realizado" && estado !== "cancelado" && (
                  <details className="group rounded-xl border border-linea" open={estado === "en_ejecucion" && (avances ?? []).length === 0 && l.cantidad_plan != null}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium"><Icono nombre="mas" className="size-4" />Registrar avance parcial</summary>
                    <form action={registrarAvance} className="grid gap-3 border-t border-linea p-3 sm:grid-cols-3">
                      <input type="hidden" name="id" value={id} />
                      <div><label htmlFor="fecha_av" className="etiqueta-campo">Fecha</label><input id="fecha_av" name="fecha" type="date" defaultValue={hoy} max={hoy} className="entrada" /></div>
                      <div><label htmlFor="cant_av" className="etiqueta-campo">Cantidad avanzada{unidad ? ` (${unidad})` : ""}</label><input id="cant_av" name="cantidad" inputMode="decimal" required className="entrada" placeholder="Ej: 1,5" /></div>
                      <div><label htmlFor="obs_av" className="etiqueta-campo">Observación</label><input id="obs_av" name="observacion" className="entrada" placeholder="Opcional" /></div>
                      <div className="sm:col-span-3"><BotonEnviar className="boton">Guardar avance</BotonEnviar></div>
                    </form>
                  </details>
                )}
                {estado !== "cancelado" && estado !== "realizado" && (
                  <details className="group rounded-xl border border-linea">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium text-alerta"><Icono nombre="cerrar" className="size-4" />Cancelar labor</summary>
                    <form action={cambiarEstado} className="flex flex-wrap items-end gap-3 border-t border-linea p-3">
                      <input type="hidden" name="id" value={id} /><input type="hidden" name="estado" value="cancelado" />
                      <div className="min-w-48 flex-1"><label htmlFor="obs_can" className="etiqueta-campo">Por qué se cancela</label><input id="obs_can" name="observacion" className="entrada" placeholder="Opcional" /></div>
                      <button className="boton-peligro">Cancelar labor</button>
                    </form>
                  </details>
                )}
              </div>
            </section>
          )}

          {/* Quién */}
          <section className="tarjeta p-4">
            <h2 className="mb-3 font-semibold">Quién la hace</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Dato t="Modalidad">{l.ejecucion === "contratista" ? "Contratista" : "Personal propio"}</Dato>
              {l.ejecucion === "contratista" ? (
                <>
                  <Dato t="Contratista">{l.cuadrilla_id ? op.nombres.cuadrilla.get(l.cuadrilla_id) : "Sin definir"}{l.cuadrilla_id && op.nombres.rut.get(l.cuadrilla_id) ? <span className="block text-xs font-normal text-tinta-suave">RUT {op.nombres.rut.get(l.cuadrilla_id)}</span> : null}</Dato>
                  <Dato t="Cobra">{nombreCobro(l.cobro) || "—"}</Dato>
                </>
              ) : (
                <Dato t="Cuadrilla">{l.cuadrilla_id ? op.nombres.cuadrilla.get(l.cuadrilla_id) : "—"}</Dato>
              )}
              <Dato t="Personas">{l.personas ?? "—"}</Dato>
              <Dato t={l.horas ? "Horas" : "Jornadas"}>{l.horas ? num(Number(l.horas), 1) : l.jornadas != null ? num(Number(l.jornadas), 1) : "—"}</Dato>
              <Dato t="Fiscaliza">{l.fiscalizador_id ? op.nombres.trabajador.get(l.fiscalizador_id) : "Sin definir"}</Dato>
              {l.confirmado_por && <Dato t="Confirmó que terminó">{usuario.get(l.confirmado_por) ?? "—"}<span className="block text-xs font-normal text-tinta-suave">{fechaHora(l.confirmado_en)}</span></Dato>}
            </dl>
            {trabajadores.length > 0 && <p className="mt-3 flex flex-wrap gap-1.5">{trabajadores.map((t) => <span key={t} className="pastilla bg-verde-claro text-verde-oscuro">{t}</span>)}</p>}
            {l.observacion && <p className="mt-3 rounded-lg bg-papel px-3 py-2 text-sm"><span className="font-medium">Observaciones:</span> {l.observacion}</p>}
            {edita && (pendiente || estado === "en_ejecucion") && (() => {
              const lab = labor.toLowerCase();
              const donde = l.cuartel_id ? `en el cuartel ${op.nombres.cuartel.get(l.cuartel_id)}` : l.variedad_id ? `en ${op.donde(l)}` : "en el campo";
              const cuando = `el ${nombreDia(l.fecha)} ${fecha(l.fecha).slice(0, 5)}`;
              const gato = l.cuadrilla_id ? op.nombres.cuadrilla.get(l.cuadrilla_id) : null;
              const nota = l.observacion ? ` ${l.observacion}.` : "";
              const cant = l.cantidad_plan != null ? ` (${num(Number(l.cantidad_plan), 1)} ${unidad})` : "";
              const aFisc = l.fiscalizador_id ? `Hola ${op.nombres.trabajador.get(l.fiscalizador_id)}, ${cuando} toca ${lab} ${donde}${cant}.${gato ? ` Trabaja ${gato}.` : ""} Tú fiscalizas que quede bien hecha.${nota} Cuando termine, avísame. — Agrícola BAS` : null;
              const aGato = gato ? `Hola, ${cuando} toca ${lab} ${donde}${cant}.${l.personas ? ` Necesitamos ${l.personas} personas.` : ""}${nota} Confírmame por favor. — Agrícola BAS` : null;
              const telF = l.fiscalizador_id ? op.telefonos.trabajador.get(l.fiscalizador_id) : null;
              const telG = l.cuadrilla_id ? op.telefonos.cuadrilla.get(l.cuadrilla_id) : null;
              if (!aFisc && !aGato) return null;
              return (
                <div className="mt-3 flex flex-wrap gap-2">
                  {aFisc && <a href={enlaceWhatsapp(telF, aFisc)} target="_blank" rel="noopener noreferrer" className="boton-secundario min-h-9 px-3 py-1.5" title={telefonoChile(telF) ? "Abre WhatsApp con el mensaje listo" : "Sin celular guardado: WhatsApp te deja elegir el contacto"}>Avisar al fiscalizador</a>}
                  {aGato && <a href={enlaceWhatsapp(telG, aGato)} target="_blank" rel="noopener noreferrer" className="boton-secundario min-h-9 px-3 py-1.5">Avisar a {l.ejecucion === "contratista" ? "el contratista" : "la cuadrilla"}</a>}
                </div>
              );
            })()}
          </section>

          {/* Insumos de bodega */}
          <section id="insumos" className="tarjeta scroll-mt-20 p-4">
            <h2 className="mb-1 font-semibold">Insumos de bodega</h2>
            <p className="mb-3 text-sm text-tinta-suave">Herbicida, pasta de poda u otro insumo usado en esta labor. {pendiente ? "Como está pendiente, se descuenta de bodega cuando la marques como empezada o terminada." : "Se descuenta de bodega al agregarlo."}</p>
            {q.sinstock && <div className="mb-3"><Aviso tipo="error">No alcanzó el stock de {q.sinstock}: quedó sin descontar. Revisa la bodega o la cantidad.</Aviso></div>}
            {listaInsumos.length > 0 && (
              <ul className="mb-3 divide-y divide-linea rounded-xl border border-linea">
                {listaInsumos.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{x.producto?.nombre}</span>
                      <span className="block text-sm text-tinta-suave">
                        {Number(x.cantidad).toLocaleString("es-CL", { maximumFractionDigits: 3 })} {x.producto?.unidad ?? ""}
                        {veMonto && x.costo_unitario != null && ` · ${clp(Number(x.cantidad) * Number(x.costo_unitario))}`}
                        {x.observacion ? ` · ${x.observacion}` : ""}
                      </span>
                    </span>
                    <span className={`pastilla ${!x.descontar ? "bg-papel text-tinta-suave" : x.mov_id ? "bg-verde-claro text-verde-oscuro" : "bg-ambar-claro text-ambar"}`}>
                      {!x.descontar ? "No se descuenta" : x.mov_id ? "Descontado de bodega" : "Se descuenta al hacerse"}
                    </span>
                    {edita && (
                      <form action={quitarInsumo}>
                        <input type="hidden" name="id" value={id} /><input type="hidden" name="insumo" value={x.id} />
                        <BotonBorrar pregunta={x.mov_id ? "¿Quitar este insumo? El producto vuelve a la bodega." : "¿Quitar este insumo?"} className="text-sm text-alerta hover:underline">Quitar</BotonBorrar>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {edita && (
              <details className="rounded-xl border border-linea" open={listaInsumos.length === 0}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium"><Icono nombre="mas" className="size-4" />Agregar insumo</summary>
                <form action={agregarInsumo} className="grid gap-3 border-t border-linea p-3 sm:grid-cols-6">
                  <input type="hidden" name="id" value={id} />
                  {haLabor ? <input type="hidden" name="ha" value={haLabor} /> : null}
                  <div className="sm:col-span-3">
                    <label htmlFor="ins-prod" className="etiqueta-campo">Producto</label>
                    <select id="ins-prod" name="producto" required defaultValue="" className="entrada">
                      <option value="" disabled>Elegir…</option>
                      {[...porClase].map(([cl, ps]) => (
                        <optgroup key={cl} label={cl}>{ps.map((b) => <option key={b.producto_id} value={b.producto_id}>{b.nombre} · hay {num(Number(b.stock), 2)} {b.unidad ?? ""}</option>)}</optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <label htmlFor="ins-cant" className="etiqueta-campo">Cantidad</label>
                    <input id="ins-cant" name="cantidad" required inputMode="decimal" className="entrada" placeholder="Ej: 2,5" />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="ins-modo" className="etiqueta-campo">Es</label>
                    <select id="ins-modo" name="por_ha" defaultValue="0" className="entrada">
                      <option value="0">Total usado</option>
                      {haLabor ? <option value="1">Por hectárea (× {num(haLabor, 2)} ha)</option> : null}
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label htmlFor="ins-obs" className="etiqueta-campo">Observación (opcional)</label>
                    <input id="ins-obs" name="observacion" className="entrada" placeholder="Ej: mezcla con agua 1:1" />
                  </div>
                  <label className="flex items-center gap-2 self-end pb-3 text-sm sm:col-span-2">
                    <input type="checkbox" name="descontar" value="1" defaultChecked className="size-4 accent-verde" />Descontar de bodega
                  </label>
                  <div className="sm:col-span-6"><BotonEnviar className="boton">Agregar insumo</BotonEnviar></div>
                </form>
              </details>
            )}
            {!edita && listaInsumos.length === 0 && <p className="text-sm text-tinta-suave">Sin insumos registrados.</p>}
          </section>

          {/* Evidencias */}
          <section className="tarjeta p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Fotos, documentos y fiscalización</h2>
              {edita && <SubirArchivo entidad="labor" entidadId={id} registrar={registrarArchivoLabor} />}
            </div>
            {fotos.length > 0 && (
              <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {fotos.map((a) => (
                  <li key={a.id} className="overflow-hidden rounded-lg border border-linea">
                    <a href={url.get(a.ruta)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url.get(a.ruta)} alt={a.nombre} className="aspect-square w-full object-cover" loading="lazy" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {docs.length > 0 && (
              <ul className="mb-3 divide-y divide-linea">
                {docs.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <a href={url.get(a.ruta)} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm text-verde hover:underline"><Icono nombre="archivo" className="size-4 shrink-0" /><span className="truncate">{a.nombre}</span></a>
                    {perfil.rol === "administrador" && <form action={borrarArchivoLabor}><input type="hidden" name="id" value={a.id} /><button className="text-alerta" aria-label={`Eliminar ${a.nombre}`}><Icono nombre="basura" className="size-4" /></button></form>}
                  </li>
                ))}
              </ul>
            )}
            {fotos.length === 0 && docs.length === 0 && <p className="mb-3 text-sm text-tinta-suave">Sin fotos ni documentos. Desde el celular puedes sacar la foto directo.</p>}
            {edita ? (
              <form action={comentarFiscalizador} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={id} />
                <label htmlFor="comentario" className="etiqueta-campo">Comentario del fiscalizador</label>
                <textarea id="comentario" name="comentario" rows={2} defaultValue={l.comentario_fiscalizador ?? ""} className="entrada" placeholder="Ej: quedaron 3 hileras sin ralear, se pidió repasar" />
                <div><BotonEnviar className="boton-secundario">Guardar comentario</BotonEnviar></div>
              </form>
            ) : l.comentario_fiscalizador ? (
              <p className="text-sm"><span className="font-medium">Fiscalizador:</span> {l.comentario_fiscalizador}</p>
            ) : null}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          {/* Costos */}
          {veMonto && (
            <section className="tarjeta p-4">
              <h2 className="mb-3 font-semibold">Costos</h2>
              <dl className="flex flex-col gap-1.5 text-sm">
                {[["Mano de obra propia", c.propia], ["Mano de obra externa", c.externa], ["Maquinaria", c.maquinaria], ["Insumos", c.insumos]].map(([t, v]) => (
                  <div key={t as string} className="flex justify-between gap-2"><dt className="text-tinta-suave">{t}</dt><dd className="tabular-nums">{Number(v) ? clp(Number(v)) : "—"}</dd></div>
                ))}
                <div className="mt-1 flex justify-between gap-2 border-t border-linea pt-2 font-semibold"><dt>Costo real</dt><dd className="tabular-nums">{clp(c.total)}</dd></div>
                {pres != null && (
                  <>
                    <div className="flex justify-between gap-2"><dt className="text-tinta-suave">Presupuesto</dt><dd className="tabular-nums">{clp(pres)}</dd></div>
                    {c.total > 0 && c.total !== pres && <div className={`flex justify-between gap-2 font-medium ${c.total > pres ? "text-alerta" : "text-verde"}`}><dt>{c.total > pres ? "Sobre el presupuesto" : "Bajo el presupuesto"}</dt><dd className="tabular-nums">{clp(Math.abs(c.total - pres))}</dd></div>}
                  </>
                )}
                {l.ejecucion === "contratista" && l.precio_unitario != null && (
                  <p className="mt-1 text-xs text-tinta-suave">{l.cobro === "fijo" ? "Precio fijo" : `${clp(Number(l.precio_unitario))} ${nombreCobro(l.cobro).toLowerCase()} × ${num(Number(l.cantidad_ejecutada ?? l.cantidad_plan ?? 0), 2)}`}</p>
                )}
                {l.ejecucion !== "contratista" && (l.valor_jornal || l.valor_hora) && (
                  <p className="mt-1 text-xs text-tinta-suave">{l.valor_hora && l.horas ? `${num(Number(l.horas), 1)} h × ${clp(Number(l.valor_hora))}` : `${num(Number(l.jornadas ?? 0), 1)} jornadas × ${clp(Number(l.valor_jornal))}`}</p>
                )}
              </dl>
              {l.ejecucion === "contratista" && (
                <div className="mt-4 border-t border-linea pt-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                    Pago <span className={`pastilla ${l.estado_pago === "pagado" ? "bg-verde-claro text-verde-oscuro" : l.estado_pago === "parcial" ? "bg-ambar-claro text-ambar" : "bg-papel"}`}>{PAGOS.find(([k]) => k === l.estado_pago)?.[1]}</span>
                    {l.monto_pagado ? <span className="font-normal text-tinta-suave">{clp(Number(l.monto_pagado))}</span> : null}
                  </p>
                  {(enFinanzas ?? []).length > 0 && (
                    <p className="mb-2 rounded-lg bg-verde-claro/60 px-2.5 py-1.5 text-xs text-verde-oscuro">
                      La factura {l.documento} ya está en Finanzas ({(enFinanzas as any[]).map((g) => `${g.proveedor?.nombre ?? ""} ${clp(Number(g.total))}`).join("; ")}). No la sumes de nuevo como gasto.
                    </p>
                  )}
                  {gestionaPago && (
                    <form action={actualizarPago} className="grid grid-cols-2 gap-2">
                      <input type="hidden" name="id" value={id} />
                      <select name="estado_pago" defaultValue={l.estado_pago} className="entrada py-2 text-sm" aria-label="Estado del pago">{PAGOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                      <input name="monto_pagado" defaultValue={l.monto_pagado ?? ""} inputMode="numeric" placeholder="Monto pagado" className="entrada py-2 text-sm" aria-label="Monto pagado" />
                      <input name="documento" defaultValue={l.documento ?? ""} placeholder="N° factura" className="entrada col-span-2 py-2 text-sm" aria-label="Factura o documento" />
                      <div className="col-span-2"><BotonEnviar className="boton-secundario w-full">Guardar pago</BotonEnviar></div>
                    </form>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Avances */}
          {(avances ?? []).length > 0 && (
            <section className="tarjeta p-4">
              <h2 className="mb-2 font-semibold">Avances</h2>
              <ul className="divide-y divide-linea text-sm">
                {(avances as any[]).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                    <span>{fecha(a.fecha)} · <strong>{num(Number(a.cantidad), 2)}</strong> {unidad}{a.observacion ? <span className="block text-xs text-tinta-suave">{a.observacion}</span> : null}</span>
                    {edita && <form action={borrarAvance}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="labor_id" value={id} /><BotonBorrar pregunta="¿Quitar este avance?" className="text-xs text-alerta hover:underline">Quitar</BotonBorrar></form>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Historial */}
          <section className="tarjeta p-4">
            <h2 className="mb-2 font-semibold">Historial</h2>
            <ol className="relative flex flex-col gap-3 border-l border-linea pl-4 text-sm">
              {((hist ?? []) as any[]).map((h) => (
                <li key={h.id} className="relative">
                  <span className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full ${h.estado_despues ? ESTADOS[h.estado_despues as EstadoLabor]?.punto ?? "bg-linea" : "bg-linea"}`} />
                  <p className="font-medium">
                    {h.tipo === "creada" && <>Creada{h.estado_despues ? ` como ${ESTADOS[h.estado_despues as EstadoLabor]?.texto.toLowerCase()}` : ""}</>}
                    {h.tipo === "estado" && <>{ESTADOS[h.estado_antes as EstadoLabor]?.texto ?? h.estado_antes} → {ESTADOS[h.estado_despues as EstadoLabor]?.texto ?? h.estado_despues}</>}
                    {h.tipo === "fecha" && <>{h.motivo ? "Reprogramada" : "Fecha cambiada"}: {fecha(h.fecha_antes)} → {fecha(h.fecha_despues)}</>}
                    {h.tipo === "avance" && <>Avance</>}
                    {h.tipo === "responsable" && <>Responsables</>}
                    {h.tipo === "edicion" && <>Edición</>}
                    {h.tipo === "pago" && <>Pago</>}
                    {h.tipo === "comentario" && <>Fiscalización</>}
                  </p>
                  {(h.motivo || h.detalle) && <p className="text-tinta-suave">{[h.motivo ? `Motivo: ${nombreMotivo(h.motivo)}` : null, h.detalle].filter(Boolean).join(" · ")}</p>}
                  <p className="text-xs text-tinta-suave">{fechaHora(h.creado_en)}{h.usuario ? ` · ${usuario.get(h.usuario) ?? ""}` : ""}</p>
                </li>
              ))}
            </ol>
          </section>

          {edita && (
            <form action={borrarLabor} className="text-center">
              <input type="hidden" name="id" value={id} />
              <BotonBorrar pregunta="¿Borrar esta labor con todo su historial? No se puede deshacer. Si no se hizo, mejor cancélala.">Borrar labor</BotonBorrar>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
