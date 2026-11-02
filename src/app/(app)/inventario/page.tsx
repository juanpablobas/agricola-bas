import Link from "next/link";
import { exigirRol, puede } from "@/lib/auth";
import { clp, fecha, num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";

export const metadata = { title: "Inventario" };

type Fila = {
  producto_id: string; nombre: string; clasificacion: string; unidad: string | null;
  ingresos: number; salidas: number; stock: number; costo_promedio: number | null; ultimo_movimiento: string | null;
};

const CLASES = ["Pesticida", "Herbicida", "Fertilizante", "Insumos"];

export default async function Inventario({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string; ver?: string; ok?: string }> }) {
  const p = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const puedeCargar = puede(perfil.rol, "administrador", "enc_administrativo");
  const puedeSalida = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");

  const filas: Fila[] = [];
  for (let d = 0; ; d += 1000) {
    const { data } = await supabase.from("v_stock").select("*").order("nombre").range(d, d + 999);
    const lote = ((data ?? []) as any[]).map((f) => ({ ...f, ingresos: Number(f.ingresos), salidas: Number(f.salidas), stock: Number(f.stock), costo_promedio: f.costo_promedio === null ? null : Number(f.costo_promedio) }));
    filas.push(...lote);
    if (lote.length < 1000) break;
  }

  const botones = (
    <>
      {puedeSalida && <Link href="/inventario/salida" className="boton"><Icono nombre="mas" className="size-4" />Registrar salida</Link>}
      {puedeCargar && <Link href="/inventario/cargar" className="boton-secundario"><Icono nombre="subir" className="size-4" />Cargar archivo</Link>}
    </>
  );

  if (filas.length === 0) {
    return (
      <>
        <Encabezado titulo="Inventario" acciones={botones} />
        <Aviso>Todavía no hay productos. {puedeCargar ? "Sube el Excel de inventario en “Cargar archivo”." : "Pide al administrador que cargue el archivo."}</Aviso>
      </>
    );
  }

  const q = (p.q ?? "").trim().toLowerCase();
  const visibles = filas.filter(
    (f) => (!q || f.nombre.toLowerCase().includes(q)) && (!p.tipo || f.clasificacion === p.tipo) && (p.ver === "todos" ? true : f.stock > 0.0005),
  );

  const conStock = filas.filter((f) => f.stock > 0.0005);
  const valorStock = conStock.reduce((s, f) => s + (f.costo_promedio ? f.stock * f.costo_promedio : 0), 0);
  const sinCosto = conStock.filter((f) => !f.costo_promedio).length;
  const negativos = filas.filter((f) => f.stock < -0.0005);

  return (
    <>
      <Encabezado titulo="Inventario" subtitulo="Stock de insumos: lo que ha entrado menos lo que ha salido." acciones={botones} />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="tarjeta p-4"><p className="text-xs font-medium uppercase tracking-wide text-tinta-suave">Productos con stock</p><p className="mt-1 text-2xl font-semibold">{num(conStock.length)}</p><p className="text-xs text-tinta-suave">de {num(filas.length)} productos</p></div>
        <div className="tarjeta p-4"><p className="text-xs font-medium uppercase tracking-wide text-tinta-suave">Valor aproximado en stock</p><p className="mt-1 text-2xl font-semibold">{clp(valorStock)}</p><p className="text-xs text-tinta-suave">a costo promedio de compra{sinCosto ? `; ${sinCosto} sin precio` : ""}</p></div>
        {CLASES.slice(0, 2).map((c) => (
          <div key={c} className="tarjeta p-4"><p className="text-xs font-medium uppercase tracking-wide text-tinta-suave">{c}s con stock</p><p className="mt-1 text-2xl font-semibold">{num(conStock.filter((f) => f.clasificacion === c).length)}</p></div>
        ))}
      </section>

      {negativos.length > 0 && (
        <div className="mb-4"><Aviso tipo="error">{negativos.length} productos tienen stock negativo (salió más de lo que entró): {negativos.slice(0, 5).map((n) => n.nombre).join(", ")}{negativos.length > 5 ? "…" : ""}. Revisa el archivo del administrador.</Aviso></div>
      )}

      <form method="get" className="tarjeta mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
        <div><label htmlFor="q" className="etiqueta-campo">Buscar producto</label><input id="q" name="q" defaultValue={p.q ?? ""} className="entrada" placeholder="Nombre" /></div>
        <div><label htmlFor="tipo" className="etiqueta-campo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={p.tipo ?? ""} className="entrada"><option value="">Todos</option>{CLASES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label htmlFor="ver" className="etiqueta-campo">Mostrar</label>
          <select id="ver" name="ver" defaultValue={p.ver ?? ""} className="entrada"><option value="">Solo con stock</option><option value="todos">Todos</option></select></div>
        <div className="flex items-end gap-2"><Link href="/inventario" className="boton-secundario">Limpiar</Link><button className="boton">Filtrar</button></div>
      </form>

      <section className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead><tr><th>Producto</th><th>Tipo</th><th className="text-right">Ingresó</th><th className="text-right">Salió</th><th className="text-right">Stock</th><th>Unidad</th><th className="text-right">Costo prom.</th><th>Último mov.</th></tr></thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-tinta-suave">No hay productos con esos filtros.</td></tr>}
            {visibles.map((f) => (
              <tr key={f.producto_id}>
                <td className="font-medium"><Link href={`/inventario/${f.producto_id}`} className="hover:text-verde hover:underline">{f.nombre}</Link></td>
                <td className="text-tinta-suave">{f.clasificacion}</td>
                <td className="text-right">{num(f.ingresos, 2)}</td>
                <td className="text-right">{num(f.salidas, 2)}</td>
                <td className={`text-right font-semibold ${f.stock < -0.0005 ? "text-alerta" : ""}`}>{num(f.stock, 2)}</td>
                <td className="text-tinta-suave">{f.unidad ?? <span className="text-ambar">por definir</span>}</td>
                <td className="text-right text-tinta-suave">{f.costo_promedio ? clp(f.costo_promedio) : "—"}</td>
                <td className="whitespace-nowrap text-xs text-tinta-suave">{fecha(f.ultimo_movimiento)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="mt-3 text-xs text-tinta-suave">El archivo del administrador no indica la unidad de cada producto: entra al producto para definirla (Kg, L u otra).</p>
    </>
  );
}
