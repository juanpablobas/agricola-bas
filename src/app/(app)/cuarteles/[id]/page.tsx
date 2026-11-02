import Link from "next/link";
import { obtenerSesion, puede } from "@/lib/auth";
import { bytes, fecha, fechaHora, ha, num } from "@/lib/formato";
import { colorEspecie, etiquetaEstado, TABLAS, ACCIONES } from "@/lib/etiquetas";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";
import { SubirArchivo } from "@/components/SubirArchivo";
import { BotonEnviar } from "@/components/BotonEnviar";
import { cambiarActivo, registrarArchivo, borrarArchivo } from "../acciones";
import { cargarCuartel } from "./cargar";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await obtenerSesion();
  const { data } = await supabase.from("cuartel").select("codigo").eq("id", id).maybeSingle();
  return { title: data ? `Cuartel ${data.codigo}` : "Cuartel" };
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-tinta-suave">{titulo}</dt>
      <dd className="text-sm text-tinta">{children}</dd>
    </div>
  );
}

const CAMPOS_LEGIBLES: Record<string, string> = {
  codigo: "código",
  nombre: "nombre",
  superficie_ha: "superficie",
  estado_productivo: "estado",
  sistema_riego: "sistema de riego",
  observaciones: "observaciones",
  activo: "activo",
  variedad_id: "variedad",
  especie_id: "especie",
  portainjerto: "portainjerto",
  anio_plantacion: "año de plantación",
  distancia_hileras_m: "distancia entre hileras",
  distancia_plantas_m: "distancia entre plantas",
  plantas: "plantas",
  hasta: "término",
  desde: "inicio",
};

function camposCambiados(antes: any, despues: any) {
  if (!antes || !despues) return [];
  return Object.keys(CAMPOS_LEGIBLES).filter((k) => k in despues && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]));
}

export default async function FichaCuartel({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, perfil } = await obtenerSesion();
  const editor = puede(perfil.rol, "administrador", "enc_agricola");
  const subeArchivos = puede(perfil.rol, "administrador", "enc_agricola", "enc_administrativo");
  const veAuditoria = puede(perfil.rol, "administrador", "propietario");

  const c = await cargarCuartel(supabase, id);

  const [{ data: periodos }, { data: sectores }, { data: archivos }, { data: usuarios }] = await Promise.all([
    supabase
      .from("cuartel_periodo")
      .select("id, desde, hasta, portainjerto, anio_plantacion, distancia_hileras_m, distancia_plantas_m, plantas, motivo, especie(nombre), variedad(nombre)")
      .eq("cuartel_id", id)
      .order("hasta", { ascending: false, nullsFirst: true })
      .order("desde", { ascending: false }),
    supabase
      .from("cuartel_sector")
      .select("sector_riego(id, codigo, superficie_ha, lineas_por_hilera, caudal_emisor_lh, distancia_emisores_m, precipitacion_mmh, horas_turno, equipo_riego(numero, emisor))")
      .eq("cuartel_id", id),
    supabase
      .from("archivo")
      .select("id, ruta, nombre, mime, bytes, creado_en, subido_por")
      .eq("entidad", "cuartel")
      .eq("entidad_id", id)
      .order("creado_en", { ascending: false }),
    supabase.from("v_usuario").select("id, nombre"),
  ]);

  const periodoIds = (periodos ?? []).map((p: any) => p.id);
  const { data: cambios } = veAuditoria
    ? await supabase
        .from("v_actividad")
        .select("id, tabla, accion, antes, despues, fecha, usuario_id, usuario_nombre")
        .or(`registro_id.eq.${id}${periodoIds.length ? `,registro_id.in.(${periodoIds.join(",")})` : ""}`)
        .order("fecha", { ascending: false })
        .limit(30)
    : { data: [] as any[] };

  const nombreUsuario = new Map((usuarios ?? []).map((u: any) => [u.id, u.nombre]));
  const rutas = (archivos ?? []).map((a: any) => a.ruta);
  const { data: firmadas } = rutas.length
    ? await supabase.storage.from("archivos").createSignedUrls(rutas, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const url = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));
  const fotos = (archivos ?? []).filter((a: any) => a.mime?.startsWith("image/"));
  const documentos = (archivos ?? []).filter((a: any) => !a.mime?.startsWith("image/"));
  const listaSectores = (sectores ?? []).map((s: any) => s.sector_riego).filter(Boolean);

  const plantasTexto =
    c.plantas !== null ? `${num(c.plantas)} (conteo)` : c.plantas_teoricas ? `≈ ${num(c.plantas_teoricas)} (teóricas por marco)` : "—";
  const densidad =
    c.distancia_hileras_m && c.distancia_plantas_m ? Math.round(10000 / (Number(c.distancia_hileras_m) * Number(c.distancia_plantas_m))) : null;

  return (
    <>
      <header className="mb-5">
        <Link href="/cuarteles" className="mb-2 inline-flex items-center gap-1 text-sm text-tinta-suave hover:text-verde">
          <Icono nombre="volver" className="size-4" />
          Cuarteles
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-14 place-items-center rounded-xl text-base font-bold text-white" style={{ background: colorEspecie(c.especie) }}>
              {c.codigo}
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {c.especie} {c.variedad ?? <span className="text-ambar">· sin variedad</span>}
              </h1>
              <p className="text-sm text-tinta-suave">
                Cuartel {c.codigo}
                {c.nombre ? ` · ${c.nombre}` : ""} · {ha(c.superficie_ha)} · {etiquetaEstado(c.estado_productivo)}
                {!c.activo && <span className="pastilla ml-2 bg-alerta-claro text-alerta">Dado de baja</span>}
              </p>
            </div>
          </div>
          {editor && (
            <div className="flex flex-wrap gap-2">
              <Link href={`/cuarteles/${id}/editar`} className="boton-secundario">
                <Icono nombre="editar" className="size-4" />
                Editar
              </Link>
              <Link href={`/cuarteles/${id}/plantacion`} className="boton-secundario">
                <Icono nombre="historia" className="size-4" />
                Cambio de plantación
              </Link>
            </div>
          )}
        </div>
      </header>

      {ok === "guardado" && <div className="mb-4"><Aviso tipo="ok">Cambios guardados.</Aviso></div>}
      {ok === "plantacion" && <div className="mb-4"><Aviso tipo="ok">Nueva plantación registrada. La anterior quedó en el historial.</Aviso></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="tarjeta p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Ficha</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Dato titulo="Superficie">{ha(c.superficie_ha)}</Dato>
            <Dato titulo="Especie">{c.especie ?? "—"}</Dato>
            <Dato titulo="Variedad">{c.variedad ?? <span className="text-ambar">Por definir</span>}</Dato>
            <Dato titulo="Año de plantación">{c.anio_plantacion ?? <span className="text-ambar">Por completar</span>}</Dato>
            <Dato titulo="Portainjerto">{c.portainjerto ?? <span className="text-ambar">Por completar</span>}</Dato>
            <Dato titulo="Marco">
              {c.distancia_hileras_m && c.distancia_plantas_m
                ? `${num(c.distancia_hileras_m, 1)} × ${num(c.distancia_plantas_m, 1)} m (${num(densidad)} pl/ha)`
                : "—"}
            </Dato>
            <Dato titulo="Plantas">{plantasTexto}</Dato>
            <Dato titulo="Estado">{etiquetaEstado(c.estado_productivo)}</Dato>
            <Dato titulo="Sistema de riego">{c.sistema_riego ?? "—"}</Dato>
          </dl>
          {c.observaciones && (
            <div className="mt-5 rounded-lg bg-papel p-3 text-sm">
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-tinta-suave">Observaciones</p>
              {c.observaciones}
            </div>
          )}
        </section>

        <section className="tarjeta p-5">
          <h2 className="mb-3 font-semibold">Riego</h2>
          {listaSectores.length === 0 && <p className="text-sm text-tinta-suave">Sin sector de riego asignado.</p>}
          <ul className="flex flex-col gap-4">
            {listaSectores.map((s: any) => (
              <li key={s.id} className="text-sm">
                <p className="font-medium">
                  Sector {s.codigo} · Equipo {s.equipo_riego?.numero}
                  {s.superficie_ha && <span className="font-normal text-tinta-suave"> · {ha(s.superficie_ha)}</span>}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-2">
                  <Dato titulo="Líneas / hilera">{s.lineas_por_hilera ?? "—"}</Dato>
                  <Dato titulo="Emisor">{s.caudal_emisor_lh ? `${num(s.caudal_emisor_lh, 1)} l/h c/${num(s.distancia_emisores_m, 2)} m` : "—"}</Dato>
                  <Dato titulo="Precipitación">{s.precipitacion_mmh ? `${num(s.precipitacion_mmh, 2)} mm/h` : "—"}</Dato>
                  <Dato titulo="Turno">{s.horas_turno ? `${num(s.horas_turno, 1)} h` : "—"}</Dato>
                </dl>
              </li>
            ))}
          </ul>
          <Link href="/riego" className="mt-4 inline-block text-sm text-verde hover:underline">Ver todos los equipos</Link>
        </section>
      </div>

      <section className="tarjeta mt-5 overflow-hidden">
        <h2 className="px-5 pt-5 font-semibold">Historial de plantación</h2>
        <div className="overflow-x-auto">
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Período</th>
                <th>Especie y variedad</th>
                <th>Portainjerto</th>
                <th>Marco</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {(periodos ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">
                    {p.desde ? fecha(p.desde) : "Inicio"} → {p.hasta ? fecha(p.hasta) : <span className="pastilla bg-verde-claro text-verde-oscuro">Vigente</span>}
                  </td>
                  <td>{p.especie?.nombre} {p.variedad?.nombre ?? "(sin variedad)"}</td>
                  <td>{p.portainjerto ?? "—"}</td>
                  <td className="whitespace-nowrap">{p.distancia_hileras_m ? `${num(p.distancia_hileras_m, 1)} × ${num(p.distancia_plantas_m, 1)} m` : "—"}</td>
                  <td className="text-tinta-suave">{p.motivo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tarjeta mt-5 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Fotos y documentos</h2>
          {subeArchivos && <SubirArchivo entidad="cuartel" entidadId={id} registrar={registrarArchivo} />}
        </div>
        {fotos.length === 0 && documentos.length === 0 && (
          <p className="text-sm text-tinta-suave">Aún no hay archivos. Puedes subir fotos desde el celular, análisis de suelo, planos o informes técnicos.</p>
        )}
        {fotos.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {fotos.map((a: any) => (
              <li key={a.id} className="overflow-hidden rounded-lg border border-linea">
                <a href={url.get(a.ruta)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url.get(a.ruta)} alt={a.nombre} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                </a>
                <p className="truncate px-2 py-1.5 text-xs text-tinta-suave">{fecha(a.creado_en)} · {nombreUsuario.get(a.subido_por) ?? ""}</p>
              </li>
            ))}
          </ul>
        )}
        {documentos.length > 0 && (
          <ul className="mt-4 divide-y divide-linea">
            {documentos.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <a href={url.get(a.ruta)} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-sm text-verde hover:underline">
                  <Icono nombre="archivo" className="size-4 shrink-0" />
                  <span className="truncate">{a.nombre}</span>
                </a>
                <span className="flex shrink-0 items-center gap-3 text-xs text-tinta-suave">
                  {bytes(a.bytes)} · {fecha(a.creado_en)}
                  {perfil.rol === "administrador" && (
                    <form action={borrarArchivo}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="text-alerta hover:underline" aria-label={`Eliminar ${a.nombre}`}>
                        <Icono nombre="basura" className="size-4" />
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5 rounded-[var(--radius-tarjeta)] border border-dashed border-linea p-5">
        <h2 className="font-semibold">Historia agrícola y económica</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Labores, aplicaciones, fertilización, cosechas, costos por hectárea, costo por kilo y margen de este cuartel se irán sumando aquí desde las etapas 3 y 4.
        </p>
      </section>

      {veAuditoria && (
        <section className="tarjeta mt-5 p-5">
          <h2 className="mb-3 font-semibold">Registro de cambios</h2>
          {(cambios ?? []).length === 0 ? (
            <p className="text-sm text-tinta-suave">Sin cambios registrados.</p>
          ) : (
            <ul className="flex flex-col gap-2.5 text-sm">
              {(cambios ?? []).map((k: any) => {
                const campos = camposCambiados(k.antes, k.despues).map((x) => CAMPOS_LEGIBLES[x]);
                return (
                  <li key={k.id} className="flex flex-wrap gap-x-2">
                    <span className="tabular-nums text-tinta-suave">{fechaHora(k.fecha)}</span>
                    <span>
                      <strong className="font-medium">{k.usuario_nombre || (k.usuario_id ? "Usuario" : "Carga inicial")}</strong>{" "}
                      {(ACCIONES[k.accion] ?? k.accion).toLowerCase()} {(TABLAS[k.tabla] ?? k.tabla).toLowerCase()}
                      {campos.length > 0 && <span className="text-tinta-suave"> ({campos.join(", ")})</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {editor && (
        <form action={cambiarActivo} className="mt-6 flex justify-end">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="activo" value={c.activo ? "false" : "true"} />
          <BotonEnviar className={c.activo ? "boton-peligro" : "boton-secundario"} pendiente="Actualizando…">
            {c.activo ? "Dar de baja este cuartel" : "Reactivar cuartel"}
          </BotonEnviar>
        </form>
      )}
    </>
  );
}
