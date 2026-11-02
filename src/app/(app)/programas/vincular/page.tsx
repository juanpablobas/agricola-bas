import { exigirRol } from "@/lib/auth";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { leerTodo } from "@/lib/programas";
import { vincularProducto } from "../acciones";

export const metadata = { title: "Unir productos" };

export default async function Vincular({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const p = await searchParams;
  const { supabase } = await exigirRol("administrador", "enc_administrativo");

  const lineas = await leerTodo<{ producto: string; producto_id: string | null; ingrediente_activo: string | null }>((d, h) =>
    supabase.from("programa_linea").select("producto, producto_id, ingrediente_activo").order("id").range(d, h));
  const bodega = await leerTodo<{ producto_id: string; nombre: string; unidad: string | null; clasificacion: string }>((d, h) =>
    supabase.from("v_stock").select("producto_id, nombre, unidad, clasificacion").in("clasificacion", ["Pesticida", "Herbicida", "Fertilizante", "Insumos"]).order("nombre").range(d, h));

  const por = new Map<string, { nombre: string; id: string | null; ia: string | null; veces: number }>();
  for (const l of lineas) {
    const f = por.get(l.producto) ?? { nombre: l.producto, id: l.producto_id, ia: l.ingrediente_activo, veces: 0 };
    f.veces++;
    por.set(l.producto, f);
  }
  const todos = [...por.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const sin = todos.filter((t) => !t.id);
  const unidos = todos.filter((t) => t.id);

  const fila = (t: (typeof todos)[number]) => (
    <form key={t.nombre} action={vincularProducto} className="flex flex-wrap items-center gap-2 border-t border-linea px-4 py-2.5 first:border-t-0">
      <input type="hidden" name="nombre" value={t.nombre} />
      <div className="min-w-48 flex-1">
        <p className="font-medium">{t.nombre}</p>
        <p className="text-xs text-tinta-suave">{t.ia ? `${t.ia} · ` : ""}en {t.veces} {t.veces === 1 ? "línea" : "líneas"}</p>
      </div>
      <select name="producto" defaultValue={t.id ?? ""} className="entrada w-full sm:w-72" aria-label={`Producto de bodega para ${t.nombre}`}>
        <option value="">— No está en bodega —</option>
        {bodega.map((b) => <option key={b.producto_id} value={b.producto_id}>{b.nombre}{b.unidad ? ` (${b.unidad})` : ""}</option>)}
      </select>
      <button className="boton-secundario">Guardar</button>
    </form>
  );

  return (
    <>
      <Encabezado titulo="Unir productos" subtitulo="Une cada producto de los programas con el mismo producto de la bodega, para conocer el stock y descontarlo al aplicar." volver={{ href: "/programas", texto: "Programas" }} />
      {p.ok && <div className="mb-3"><Aviso tipo="ok">Guardado.</Aviso></div>}
      {p.error && <div className="mb-3"><Aviso tipo="error">No se pudo guardar.</Aviso></div>}
      <div className="mb-3"><Aviso>Une solo el mismo producto comercial. Si el programa pide “Envidor” y en bodega hay otro con el mismo ingrediente pero distinta marca, es mejor dejarlo sin unir: el asesor recomienda una marca específica.</Aviso></div>

      <section className="tarjeta mb-4">
        <h2 className="p-4 pb-2 font-semibold">Sin unir ({sin.length})</h2>
        {sin.length === 0 ? <p className="px-4 pb-4 text-sm text-tinta-suave">Todo está unido.</p> : sin.map(fila)}
      </section>

      <details className="tarjeta">
        <summary className="cursor-pointer p-4 font-semibold">Ya unidos ({unidos.length}) — para revisar</summary>
        {unidos.map(fila)}
      </details>
    </>
  );
}
