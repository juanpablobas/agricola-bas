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
const COLOR_CLASE: Record<string, string> = { Pesticida: "bg-alerta", Herbicida: "bg-ambar", Fertilizante: "bg-verde", Insumos: "bg-agua" };

function enlace(p: { q?: string; tipo?: string; ver?: string }) {
  const u = new URLSearchParams();
  if (p.q) u.set("q", p.q);
  if (p.tipo) u.set("tipo", p.tipo);
  if (p.ver) u.set("ver", p.ver);
  const s = u.toString();
  return s ? `/inventario?${s}` : "/inventario";
}

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

      <form method="get" className="tarjeta mb-3 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor="q" className="etiqueta-campo">Buscar producto</label>
          <input id="q" name="q" type="search" defaultValue={p.q ?? ""} className="entrada" placeholder="Nombre del producto" />
        </div>
        {p.tipo && <input type="hidden" name="tipo" value={p.tipo} />}
        {p.ver && <input type="hidden" name="ver" value={p.ver} />}
        <button className="boton">Buscar</button>
      </form>

      <nav aria-label="Filtrar por tipo" className="mb-4 flex flex-wrap gap-2">
        {[{ v: "", t: "Todos" }, ...CLASES.map((c) => ({ v: c, t: c }))].map(({ v, t }) => {
          const activo = (p.tipo ?? "") === v;
          const n = (v ? conStock.filter((f) => f.clasificacion === v) : conStock).length;
          return (
            <Link
              key={t}
              href={enlace({ ...p, tipo: v || undefined })}
              aria-current={activo ? "true" : undefined}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition ${activo ? "border-verde bg-verde text-white" : "border-linea bg-white text-tinta hover:border-verde/40"}`}
            >
              {t}<span className={`text-xs tabular-nums ${activo ? "text-white/75" : "text-tinta-suave"}`}>{n}</span>
            </Link>
          );
        })}
        <Link
          href={enlace({ ...p, ver: p.ver === "todos" ? undefined : "todos" })}
          className="inline-flex min-h-9 items-center rounded-full px-3 text-sm text-tinta-suave underline-offset-2 hover:underline"
        >
          {p.ver === "todos" ? "Ocultar sin stock" : "Ver también sin stock"}
        </Link>
      </nav>

      <p className="mb-2 text-xs text-tinta-suave">{num(visibles.length)} {visibles.length === 1 ? "producto" : "productos"}{q ? ` con “${p.q}”` : ""}</p>

      {/* Celular: lista fácil de leer, sin deslizar hacia el lado */}
      <ul className="tarjeta divide-y divide-linea overflow-hidden sm:hidden">
        {visibles.length === 0 && <li className="px-4 py-8 text-center text-sm text-tinta-suave">No hay productos con esos filtros.</li>}
        {visibles.map((f) => (
          <li key={f.producto_id}>
            <Link href={`/inventario/${f.producto_id}`} className="flex items-center gap-3 px-4 py-3 active:bg-papel">
              <span className={`size-2 shrink-0 rounded-full ${COLOR_CLASE[f.clasificacion] ?? "bg-linea"}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{f.nombre}</span>
                <span className="block truncate text-xs text-tinta-suave">
                  {f.clasificacion}{f.costo_promedio ? ` · ${clp(f.costo_promedio)} c/u` : ""}{f.ultimo_movimiento ? ` · ${fecha(f.ultimo_movimiento)}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-right leading-tight">
                <span className={`block font-semibold tabular-nums ${f.stock < -0.0005 ? "text-alerta" : f.stock <= 0.0005 ? "text-tinta-suave" : ""}`}>{num(f.stock, 2)}</span>
                <span className="block text-xs text-tinta-suave">{f.unidad ?? "sin unidad"}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="tarjeta hidden overflow-x-auto sm:block">
        <table className="tabla">
          <thead><tr><th>Producto</th><th>Tipo</th><th className="text-right">Ingresó</th><th className="text-right">Salió</th><th className="text-right">Stock</th><th>Unidad</th><th className="text-right">Costo prom.</th><th>Último mov.</th></tr></thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-tinta-suave">No hay productos con esos filtros.</td></tr>}
            {visibles.map((f) => (
              <tr key={f.producto_id} className="transition hover:bg-papel/60">
                <td className="font-medium"><Link href={`/inventario/${f.producto_id}`} className="hover:text-verde hover:underline">{f.nombre}</Link></td>
                <td className="text-tinta-suave"><span className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-full ${COLOR_CLASE[f.clasificacion] ?? "bg-linea"}`} />{f.clasificacion}</span></td>
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
