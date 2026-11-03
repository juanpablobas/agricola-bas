import { exigirRol, puede } from "@/lib/auth";
import { fecha, num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { borrarAplicacion } from "../acciones";

export const metadata = { title: "Aplicaciones realizadas" };

export default async function Historial({ searchParams }: { searchParams: Promise<{ ok?: string; sin?: string; borrada?: string }> }) {
  const p = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const borrador = puede(perfil.rol, "administrador", "enc_administrativo");

  const { data: apps } = await supabase
    .from("aplicacion_realizada")
    .select("id, fecha, variedad_id, titulo, litros_ha, ha, observacion, creado_por, creado_en")
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(200);
  const ids = (apps ?? []).map((a: any) => a.id);

  const [{ data: movs }, { data: variedades }] = await Promise.all([
    ids.length ? supabase.from("mov_inventario").select("aplicacion_id, producto_id, cantidad").in("aplicacion_id", ids).limit(2000) : Promise.resolve({ data: [] as any[] }),
    supabase.from("variedad").select("id, nombre").range(0, 999),
  ]);
  const prodIds = [...new Set((movs ?? []).map((m: any) => m.producto_id))] as string[];
  const quienIds = [...new Set((apps ?? []).map((a: any) => a.creado_por).filter(Boolean))] as string[];
  const [{ data: prods }, { data: quienes }] = await Promise.all([
    prodIds.length ? supabase.from("v_stock").select("producto_id, nombre, unidad").in("producto_id", prodIds) : Promise.resolve({ data: [] as any[] }),
    quienIds.length ? supabase.from("perfil").select("id, nombre").in("id", quienIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const nomVar = new Map((variedades ?? []).map((v: any) => [v.id as string, v.nombre as string]));
  const nomProd = new Map((prods ?? []).map((x: any) => [x.producto_id as string, x as any]));
  const nomQuien = new Map((quienes ?? []).map((x: any) => [x.id as string, x.nombre as string]));

  return (
    <>
      <Encabezado titulo="Aplicaciones realizadas" subtitulo="Lo que se aplicó y lo que se descontó de bodega." volver={{ href: "/programas", texto: "Programas" }} />
      {p.ok && <div className="mb-3"><Aviso tipo="ok">Aplicación registrada y descontada de la bodega.{p.sin ? ` ${p.sin} producto(s) marcados no están unidos a la bodega y no se descontaron.` : ""}</Aviso></div>}
      {p.borrada && <div className="mb-3"><Aviso tipo="ok">Aplicación borrada. Los productos volvieron a la bodega.</Aviso></div>}

      {(apps ?? []).length === 0 ? (
        <Aviso>Todavía no hay aplicaciones registradas.</Aviso>
      ) : (
        <div className="flex flex-col gap-3">
          {(apps ?? []).map((a: any) => {
            const usados = (movs ?? []).filter((m: any) => m.aplicacion_id === a.id);
            return (
              <section key={a.id} className="tarjeta p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{a.titulo ?? "Aplicación"}</p>
                    <p className="text-sm text-tinta-suave">
                      {fecha(a.fecha)} · {nomVar.get(a.variedad_id) ?? "—"} · {num(Number(a.ha), 2)} ha{a.litros_ha != null ? ` · ${num(Number(a.litros_ha))} L/ha` : ""}
                      {nomQuien.get(a.creado_por) ? ` · por ${nomQuien.get(a.creado_por)}` : ""}
                    </p>
                    {a.observacion && <p className="text-sm text-tinta-suave">{a.observacion}</p>}
                  </div>
                  {borrador && (
                    <form action={borrarAplicacion}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="text-sm text-alerta hover:underline">Borrar</button>
                    </form>
                  )}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {usados.map((m: any, i: number) => {
                    const pr: any = nomProd.get(m.producto_id);
                    return <li key={i}><span className="font-medium">{pr?.nombre ?? "Producto"}</span> {num(Number(m.cantidad), 2)} {pr?.unidad ?? ""}</li>;
                  })}
                  {usados.length === 0 && <li className="text-tinta-suave">Sin salidas de bodega asociadas.</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
