import Link from "next/link";
import { obtenerSesion, puede } from "@/lib/auth";
import { ha, num } from "@/lib/formato";
import { colorEspecie, ESTADOS, etiquetaEstado } from "@/lib/etiquetas";
import { Encabezado } from "@/components/Encabezado";
import { Icono } from "@/components/Icono";

export const metadata = { title: "Cuarteles" };

type Fila = {
  id: string;
  codigo: string;
  superficie_ha: number;
  estado_productivo: string;
  especie: string | null;
  variedad: string | null;
  anio_plantacion: number | null;
  distancia_hileras_m: number | null;
  distancia_plantas_m: number | null;
  plantas: number | null;
  plantas_teoricas: number | null;
  sectores: string | null;
  equipo: number | null;
  activo: boolean;
};

type Filtros = { q?: string; especie?: string; equipo?: string; estado?: string; inactivos?: string };

export default async function Cuarteles({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams;
  const { supabase, perfil } = await obtenerSesion();
  const editor = puede(perfil.rol, "administrador", "enc_agricola");

  let consulta = supabase
    .from("v_cuartel")
    .select(
      "id, codigo, superficie_ha, estado_productivo, especie, variedad, anio_plantacion, distancia_hileras_m, distancia_plantas_m, plantas, plantas_teoricas, sectores, equipo, activo",
    )
    .order("codigo");
  if (!f.inactivos) consulta = consulta.eq("activo", true);
  if (f.especie) consulta = consulta.eq("especie", f.especie);
  if (f.equipo) consulta = consulta.eq("equipo", Number(f.equipo));
  if (f.estado) consulta = consulta.eq("estado_productivo", f.estado);
  if (f.q) consulta = consulta.or(`codigo.ilike.%${f.q.replace(/[%,()]/g, "")}%,variedad.ilike.%${f.q.replace(/[%,()]/g, "")}%`);

  const [{ data }, { data: especies }] = await Promise.all([
    consulta.returns<Fila[]>(),
    supabase.from("especie").select("nombre").order("nombre"),
  ]);
  const filas = data ?? [];
  const total = filas.reduce((s, x) => s + Number(x.superficie_ha), 0);
  const hayFiltro = Boolean(f.q || f.especie || f.equipo || f.estado || f.inactivos);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <Encabezado
        titulo="Cuarteles"
        subtitulo={`${filas.length} cuarteles · ${ha(total)}`}
        acciones={
          <>
            <a href={`/cuarteles/exportar${qs ? `?${qs}` : ""}`} className="boton-secundario">
              Descargar planilla
            </a>
            {editor && (
              <Link href="/cuarteles/nuevo" className="boton">
                <Icono nombre="mas" className="size-4" />
                Nuevo cuartel
              </Link>
            )}
          </>
        }
      />

      <form className="tarjeta mb-4 grid grid-cols-2 gap-3 p-3 sm:grid-cols-5" method="get">
        <div className="col-span-2 sm:col-span-2">
          <label htmlFor="q" className="sr-only">Buscar</label>
          <input id="q" name="q" defaultValue={f.q} placeholder="Buscar cuartel o variedad" className="entrada" />
        </div>
        <select name="especie" defaultValue={f.especie ?? ""} className="entrada" aria-label="Especie">
          <option value="">Todas las especies</option>
          {(especies ?? []).map((e) => (
            <option key={e.nombre} value={e.nombre}>{e.nombre}</option>
          ))}
        </select>
        <select name="equipo" defaultValue={f.equipo ?? ""} className="entrada" aria-label="Equipo de riego">
          <option value="">Todos los equipos</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>Equipo {n}</option>
          ))}
        </select>
        <select name="estado" defaultValue={f.estado ?? ""} className="entrada" aria-label="Estado productivo">
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
          ))}
        </select>
        <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-5">
          <label className="flex items-center gap-2 text-sm text-tinta-suave">
            <input type="checkbox" name="inactivos" value="1" defaultChecked={Boolean(f.inactivos)} className="size-4 accent-verde" />
            Incluir cuarteles dados de baja
          </label>
          <div className="flex gap-2">
            {hayFiltro && <Link href="/cuarteles" className="boton-secundario">Limpiar</Link>}
            <button className="boton">
              <Icono nombre="buscar" className="size-4" />
              Filtrar
            </button>
          </div>
        </div>
      </form>

      {/* Celular: tarjetas */}
      <ul className="flex flex-col gap-2 md:hidden">
        {filas.map((c) => (
          <li key={c.id}>
            <Link href={`/cuarteles/${c.id}`} className="tarjeta flex items-center gap-3 p-3.5 active:bg-papel">
              <span
                className="grid size-12 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
                style={{ background: colorEspecie(c.especie) }}
              >
                {c.codigo}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {c.especie} {c.variedad ?? <span className="text-ambar">· sin variedad</span>}
                </span>
                <span className="block text-sm text-tinta-suave">
                  {ha(c.superficie_ha)} · {etiquetaEstado(c.estado_productivo)}
                  {!c.activo && " · dado de baja"}
                </span>
              </span>
              <Icono nombre="volver" className="size-4 rotate-180 text-tinta-suave" />
            </Link>
          </li>
        ))}
      </ul>

      {/* Computador: tabla */}
      <div className="tarjeta hidden overflow-x-auto md:block">
        <table className="tabla">
          <thead>
            <tr>
              <th>Cuartel</th>
              <th>Especie</th>
              <th>Variedad</th>
              <th className="text-right">Superficie</th>
              <th>Marco</th>
              <th className="text-right">Plantas</th>
              <th>Sector</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((c) => (
              <tr key={c.id} className="hover:bg-papel/60">
                <td>
                  <Link href={`/cuarteles/${c.id}`} className="inline-flex items-center gap-2 font-semibold text-verde hover:underline">
                    <span className="size-2.5 rounded-full" style={{ background: colorEspecie(c.especie) }} />
                    {c.codigo}
                  </Link>
                </td>
                <td>{c.especie ?? "—"}</td>
                <td>{c.variedad ?? <span className="text-ambar">Sin variedad</span>}</td>
                <td className="text-right tabular-nums">{ha(c.superficie_ha)}</td>
                <td className="tabular-nums text-tinta-suave">
                  {c.distancia_hileras_m && c.distancia_plantas_m ? `${num(c.distancia_hileras_m, 1)} × ${num(c.distancia_plantas_m, 1)} m` : "—"}
                </td>
                <td className="text-right tabular-nums">
                  {c.plantas !== null ? num(c.plantas) : <span className="text-tinta-suave" title="Teóricas según marco">≈ {num(c.plantas_teoricas)}</span>}
                </td>
                <td className="text-tinta-suave">{c.sectores ?? "—"}</td>
                <td>
                  <span className={`pastilla ${c.activo ? "bg-papel" : "bg-alerta-claro text-alerta"}`}>
                    {c.activo ? etiquetaEstado(c.estado_productivo) : "Dado de baja"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filas.length === 0 && <p className="mt-6 text-center text-sm text-tinta-suave">Ningún cuartel coincide con el filtro.</p>}
    </>
  );
}
