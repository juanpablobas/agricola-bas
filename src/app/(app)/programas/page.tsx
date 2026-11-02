import Link from "next/link";
import { exigirRol, puede } from "@/lib/auth";
import { num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";
import { NOMBRE_MES, MESES_TEMPORADA } from "@/lib/programas";

export const metadata = { title: "Programas" };

export default async function Programas() {
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const aplica = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");

  const [{ data: programas }, { data: apps }, { data: pv }, { data: cuarteles }, { data: lineas }] = await Promise.all([
    supabase.from("programa").select("id, nombre, asesor, archivo, temporada(nombre)").eq("activo", true).order("nombre"),
    supabase.from("programa_aplicacion").select("programa_id, mes").range(0, 999),
    supabase.from("programa_variedad").select("programa_id, variedad_id, variedad(nombre)").range(0, 999),
    supabase.from("v_cuartel").select("variedad_id, superficie_ha, activo").eq("activo", true).range(0, 999),
    supabase.from("programa_linea").select("producto_id").range(0, 1999),
  ]);

  const haPorVariedad = new Map<string, number>();
  for (const c of cuarteles ?? []) if (c.variedad_id) haPorVariedad.set(c.variedad_id, (haPorVariedad.get(c.variedad_id) ?? 0) + Number(c.superficie_ha ?? 0));
  const sinVincular = (lineas ?? []).filter((l: any) => !l.producto_id).length;

  const botones = (
    <>
      <Link href="/programas/compra" className="boton"><Icono nombre="inventario" className="size-4" />Qué comprar</Link>
      {aplica && <Link href="/programas/aplicar" className="boton-secundario"><Icono nombre="ok" className="size-4" />Registrar aplicación</Link>}
      <Link href="/programas/mojamiento" className="boton-secundario"><Icono nombre="riego" className="size-4" />Mojamiento</Link>
      <Link href="/programas/historial" className="boton-secundario"><Icono nombre="historia" className="size-4" />Historial</Link>
    </>
  );

  return (
    <>
      <Encabezado titulo="Programas" subtitulo="Programas fitosanitarios y de nutrición de los asesores, por especie." acciones={botones} />

      {(programas ?? []).length === 0 && <Aviso>Todavía no hay programas cargados.</Aviso>}

      <section className="grid gap-4 md:grid-cols-2">
        {(programas ?? []).map((p: any) => {
          const misApps = (apps ?? []).filter((a: any) => a.programa_id === p.id);
          const meses = misApps.map((a: any) => a.mes).filter(Boolean) as number[];
          const ordenados = [...meses].sort((x, y) => MESES_TEMPORADA.indexOf(x) - MESES_TEMPORADA.indexOf(y));
          const variedades = (pv ?? []).filter((v: any) => v.programa_id === p.id) as any[];
          const haTotal = variedades.reduce((s, v) => s + (haPorVariedad.get(v.variedad_id) ?? 0), 0);
          return (
            <Link key={p.id} href={`/programas/${p.id}`} className="tarjeta block p-5 transition hover:border-verde/50">
              <h2 className="font-semibold">{p.nombre}</h2>
              <p className="mt-0.5 text-sm text-tinta-suave">
                {p.asesor ? `Asesor: ${p.asesor}` : "Asesor sin indicar"}
                {p.temporada?.nombre ? ` · Temporada ${p.temporada.nombre}` : ""}
              </p>
              <p className="mt-3 text-sm">
                <strong>{misApps.length}</strong> aplicaciones
                {meses.length > 0 && <> · de {NOMBRE_MES[ordenados[0]]} a {NOMBRE_MES[ordenados[ordenados.length - 1]]}</>}
              </p>
              <p className="mt-1 text-sm text-tinta-suave">
                {variedades.map((v) => v.variedad?.nombre).join(", ")} · {num(haTotal, 2)} ha
              </p>
            </Link>
          );
        })}
      </section>

      {sinVincular > 0 && (
        <div className="mt-4">
          <Aviso>
            Hay {sinVincular} líneas de los programas cuyo producto no está unido a la bodega, así que no se les puede calcular stock ni descontar.{" "}
            {puede(perfil.rol, "administrador", "enc_administrativo") ? <Link href="/programas/vincular" className="font-medium underline">Unirlos ahora</Link> : "Pide al administrador de la app que los una."}
          </Aviso>
        </div>
      )}
    </>
  );
}
