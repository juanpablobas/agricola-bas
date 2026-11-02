import { notFound } from "next/navigation";
import { exigirRol, puede } from "@/lib/auth";
import { clp, fecha, num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { FormUnidad } from "./FormUnidad";
import { borrarMovimiento } from "./acciones";

export const metadata = { title: "Producto" };

export default async function Producto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const editor = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");
  const borrador = puede(perfil.rol, "administrador", "enc_administrativo");

  const { data: p } = await supabase.from("v_stock").select("*").eq("producto_id", id).maybeSingle();
  if (!p) notFound();
  const { data: movs } = await supabase
    .from("mov_inventario")
    .select("id, tipo, fecha, cantidad, valor_total, proveedor, factura, destino_original, observacion, origen, creado_por, ceco(codigo, nombre)")
    .eq("producto_id", id)
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(300);

  const ids = [...new Set((movs ?? []).map((m: any) => m.creado_por).filter(Boolean))] as string[];
  const { data: perfiles } = ids.length ? await supabase.from("perfil").select("id, nombre").in("id", ids) : { data: [] as { id: string; nombre: string }[] };
  const nombrePor = new Map((perfiles ?? []).map((x) => [x.id, x.nombre]));

  const stock = Number(p.stock);
  return (
    <>
      <Encabezado titulo={p.nombre} subtitulo={`${p.clasificacion} · ${p.unidad ? `en ${p.unidad}` : "unidad por definir"}`} volver={{ href: "/inventario", texto: "Inventario" }} />
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Stock</p><p className={`mt-1 text-2xl font-semibold ${stock < -0.0005 ? "text-alerta" : ""}`}>{num(stock, 2)} {p.unidad ?? ""}</p></div>
        <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Ha entrado</p><p className="mt-1 text-2xl font-semibold">{num(Number(p.ingresos), 2)}</p></div>
        <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Ha salido</p><p className="mt-1 text-2xl font-semibold">{num(Number(p.salidas), 2)}</p></div>
        <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Costo promedio</p><p className="mt-1 text-2xl font-semibold">{p.costo_promedio ? clp(Number(p.costo_promedio)) : "—"}</p></div>
      </section>
      {editor && <section className="tarjeta mb-4 p-4"><FormUnidad id={p.producto_id} unidad={p.unidad} /></section>}

      <section className="tarjeta overflow-x-auto">
        <h2 className="p-5 pb-3 font-semibold">Movimientos</h2>
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Movimiento</th><th className="text-right">Cantidad</th><th>Detalle</th><th className="text-right">Valor</th>{borrador && <th />}</tr></thead>
          <tbody>
            {(movs ?? []).map((m: any) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{fecha(m.fecha)}</td>
                <td><span className={`pastilla ${m.tipo === "ingreso" ? "bg-verde-claro text-verde-oscuro" : "bg-ambar-claro text-ambar"}`}>{m.tipo === "ingreso" ? "Ingreso" : "Salida"}</span>{m.origen === "manual" && <span className="ml-1 text-xs text-tinta-suave">hecha en la app</span>}</td>
                <td className="text-right font-medium">{m.tipo === "ingreso" ? "+" : "−"}{num(Number(m.cantidad), 2)}</td>
                <td className="min-w-48 text-sm">
                  {m.tipo === "ingreso" ? (m.proveedor ?? "—") : m.ceco ? `${m.ceco.codigo} · ${m.ceco.nombre}` : m.destino_original ?? "Sin destino"}
                  <span className="block text-xs text-tinta-suave">{[m.factura && `Factura ${m.factura}`, m.observacion, m.creado_por && nombrePor.get(m.creado_por) && `por ${nombrePor.get(m.creado_por)}`].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="text-right text-tinta-suave">{m.valor_total ? clp(Number(m.valor_total)) : "—"}</td>
                {borrador && (
                  <td className="text-right">
                    {m.origen === "manual" && (
                      <form action={borrarMovimiento}>
                        <input type="hidden" name="id" value={m.id} /><input type="hidden" name="producto" value={id} />
                        <button className="text-sm text-alerta hover:underline">Borrar</button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
