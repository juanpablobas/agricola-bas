import Link from "next/link";
import { exigirRol } from "@/lib/auth";
import { clp, fecha, num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";

export const metadata = { title: "Gastos" };

const POR_PAGINA = 100;

type Params = { mes?: string; item?: string; ceco?: string; q?: string; sinppto?: string; pagina?: string };

export default async function Gastos({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const { supabase } = await exigirRol("administrador", "enc_administrativo", "propietario");
  const pagina = Math.max(1, Number(p.pagina) || 1);

  const [{ data: cecos }, { data: items }] = await Promise.all([
    supabase.from("ceco").select("id, codigo, nombre").order("codigo"),
    supabase.from("gasto").select("item").limit(5000),
  ]);
  const listaItems = [...new Set((items ?? []).map((i) => i.item as string))].sort();

  let q = supabase
    .from("gasto")
    .select("id, fecha, item, sublabor_ppto, tipo_documento, numero_documento, detalle, total, sin_presupuesto, ceco_original, ceco(codigo, nombre), proveedor(nombre, rut)", { count: "exact" })
    .order("fecha", { ascending: false })
    .order("id")
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);

  if (p.mes && /^\d{4}-\d{2}$/.test(p.mes)) {
    const [y, m] = p.mes.split("-").map(Number);
    const fin = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    q = q.gte("fecha", `${p.mes}-01`).lt("fecha", fin);
  }
  if (p.item) q = q.eq("item", p.item);
  if (p.ceco) q = q.eq("ceco_id", p.ceco);
  if (p.sinppto === "1") q = q.eq("sin_presupuesto", true);
  if (p.q?.trim()) {
    const t = p.q.trim().replace(/[%,()]/g, " ");
    q = q.or(`detalle.ilike.%${t}%,sublabor_ppto.ilike.%${t}%,numero_documento.ilike.%${t}%`);
  }

  const { data, count, error } = await q;
  const filas = (data ?? []) as any[];
  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));
  const suma = filas.reduce((s, f) => s + Number(f.total), 0);

  const enlace = (nuevo: Partial<Params>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...p, ...nuevo })) if (v) sp.set(k, String(v));
    const s = sp.toString();
    return `/finanzas/gastos${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <Encabezado titulo="Gastos" subtitulo="Cada documento del archivo del administrador, con IVA." volver={{ href: "/finanzas", texto: "Finanzas" }} />

      <form className="tarjeta mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5" method="get">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="etiqueta-campo">Buscar</label>
          <input id="q" name="q" defaultValue={p.q ?? ""} placeholder="Detalle, labor o N° de documento" className="entrada" />
        </div>
        <div>
          <label htmlFor="mes" className="etiqueta-campo">Mes</label>
          <input id="mes" name="mes" type="month" defaultValue={p.mes ?? ""} className="entrada" />
        </div>
        <div>
          <label htmlFor="item" className="etiqueta-campo">Ítem</label>
          <select id="item" name="item" defaultValue={p.item ?? ""} className="entrada">
            <option value="">Todos</option>
            {listaItems.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ceco" className="etiqueta-campo">Centro de costo</label>
          <select id="ceco" name="ceco" defaultValue={p.ceco ?? ""} className="entrada">
            <option value="">Todos</option>
            {(cecos ?? []).map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
          <input type="checkbox" name="sinppto" value="1" defaultChecked={p.sinppto === "1"} className="size-5 accent-verde" />
          Solo gastos sin presupuesto
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
          <Link href="/finanzas/gastos" className="boton-secundario">Limpiar</Link>
          <button className="boton">Filtrar</button>
        </div>
      </form>

      {error && <Aviso tipo="error">No se pudieron leer los gastos.</Aviso>}

      <section className="tarjeta overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-2 text-sm text-tinta-suave">
          <span>{num(count ?? 0)} documentos · esta página suma {clp(suma)}</span>
          <span>Página {pagina} de {totalPaginas}</span>
        </div>
        <table className="tabla">
          <thead>
            <tr><th>Fecha</th><th>Proveedor</th><th>Detalle</th><th>Centro de costo</th><th>Ítem</th><th>Documento</th><th className="text-right">Total</th></tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-tinta-suave">No hay gastos con esos filtros.</td></tr>
            )}
            {filas.map((f) => (
              <tr key={f.id}>
                <td className="whitespace-nowrap">{fecha(f.fecha)}</td>
                <td className="max-w-56">{f.proveedor?.nombre ?? <span className="text-tinta-suave">—</span>}</td>
                <td className="min-w-48">
                  {f.detalle ?? "—"}
                  {f.sublabor_ppto && <span className={`block text-xs ${f.sin_presupuesto ? "text-ambar" : "text-tinta-suave"}`}>{f.sin_presupuesto ? "Sin presupuesto" : f.sublabor_ppto}</span>}
                </td>
                <td className="whitespace-nowrap">{f.ceco ? `${f.ceco.codigo} · ${f.ceco.nombre}` : <span className="text-ambar">{f.ceco_original ?? "Sin asignar"}</span>}</td>
                <td>{f.item}</td>
                <td className="whitespace-nowrap text-xs text-tinta-suave">{f.tipo_documento ?? ""}<br />{f.numero_documento ?? ""}</td>
                <td className="whitespace-nowrap text-right font-medium">{clp(Number(f.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPaginas > 1 && (
          <div className="flex justify-between gap-2 p-4">
            {pagina > 1 ? <Link href={enlace({ pagina: String(pagina - 1) })} className="boton-secundario">Anterior</Link> : <span />}
            {pagina < totalPaginas ? <Link href={enlace({ pagina: String(pagina + 1) })} className="boton-secundario">Siguiente</Link> : <span />}
          </div>
        )}
      </section>
    </>
  );
}
