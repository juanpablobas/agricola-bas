import Link from "next/link";
import { exigirRol, puede } from "@/lib/auth";
import { clp, fecha, num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { clave, leerTodo, opcionesDeTexto } from "@/lib/programas";
import { guardarPrecio, usarOpcion } from "./acciones";

export const metadata = { title: "Opciones y precios" };

type L = { id: string; aplicacion_id: string; orden: number; producto: string; unidad: string | null; dosis_ha: number | null; alternativas: string | null; grupo_alt: number | null };
type Opcion = { nombre: string; dosis: number | null; propia: boolean };

export default async function Opciones({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; n?: string; q?: string }> }) {
  const q = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const edita = puede(perfil.rol, "administrador", "enc_administrativo");

  const lineas = await leerTodo<L>((d, h) => supabase.from("programa_linea").select("id, aplicacion_id, orden, producto, unidad, dosis_ha, alternativas, grupo_alt").order("orden").range(d, h));
  const [{ data: prods }, { data: ingresos }, { data: refs }] = await Promise.all([
    supabase.from("producto").select("id, nombre").range(0, 1999),
    supabase.from("mov_inventario").select("producto_id, fecha, valor_unitario").eq("tipo", "ingreso").gt("valor_unitario", 0).order("fecha", { ascending: false }).range(0, 4999),
    supabase.from("precio_referencia").select("nombre_clave, precio, actualizado").range(0, 999),
  ]);

  const idPorClave = new Map<string, string>((prods ?? []).map((p: any) => [clave(p.nombre as string), p.id as string] as [string, string]));
  const ultimo = new Map<string, { precio: number; fecha: string }>();
  for (const m of (ingresos ?? []) as any[]) if (!ultimo.has(m.producto_id)) ultimo.set(m.producto_id, { precio: Number(m.valor_unitario), fecha: m.fecha });
  const ref = new Map<string, { precio: number; fecha: string }>((refs ?? []).map((r: any) => [r.nombre_clave as string, { precio: Number(r.precio), fecha: r.actualizado as string }] as [string, { precio: number; fecha: string }]));
  const precioDe = (nombre: string) => {
    const k = clave(nombre);
    const r = ref.get(k);
    if (r) return { precio: r.precio, fuente: "tuyo" as const, fecha: r.fecha };
    const id = idPorClave.get(k);
    const u = id ? ultimo.get(id) : undefined;
    return u ? { precio: u.precio, fuente: "bodega" as const, fecha: u.fecha } : null;
  };

  // Productos principales con sus opciones (escritas como texto o como líneas con dosis propia)
  const porApp = new Map<string, L[]>();
  for (const l of lineas) porApp.set(l.aplicacion_id, [...(porApp.get(l.aplicacion_id) ?? []), l]);
  const grupos = new Map<string, { nombre: string; unidad: string | null; usos: number; dosis: number | null; opciones: Map<string, Opcion> }>();
  for (const [, ls] of porApp) {
    const ord = [...ls].sort((a, b) => a.orden - b.orden);
    ord.forEach((l, i) => {
      if ((l.grupo_alt ?? 0) !== 0) return;
      const g = grupos.get(clave(l.producto)) ?? { nombre: l.producto, unidad: l.unidad, usos: 0, dosis: l.dosis_ha === null ? null : Number(l.dosis_ha), opciones: new Map<string, Opcion>() };
      g.usos++;
      if (!g.unidad && l.unidad) g.unidad = l.unidad;
      for (const t of opcionesDeTexto(l.alternativas)) if (clave(t) !== clave(l.producto) && !g.opciones.has(clave(t))) g.opciones.set(clave(t), { nombre: t, dosis: null, propia: false });
      for (let j = i + 1; j < ord.length && (ord[j].grupo_alt ?? 0) !== 0; j++) {
        const a = ord[j];
        if (clave(a.producto) !== clave(l.producto)) g.opciones.set(clave(a.producto), { nombre: a.producto, dosis: a.dosis_ha === null ? null : Number(a.dosis_ha), propia: true });
      }
      grupos.set(clave(l.producto), g);
    });
  }
  const filtro = clave(q.q ?? "");
  const lista = [...grupos.values()]
    .filter((g) => g.opciones.size > 0 && (!filtro || clave(g.nombre).includes(filtro) || [...g.opciones.values()].some((o) => clave(o.nombre).includes(filtro))))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <>
      <Encabezado titulo="Opciones y precios" subtitulo="Las alternativas que da el asesor para cada producto. Anota el precio de cada una y usa la más conveniente." volver={{ href: "/programas", texto: "Programas" }} />
      {q.ok === "usada" && <div className="mb-3"><Aviso tipo="ok">Listo: ese producto ahora es el principal en {q.n} {q.n === "1" ? "aplicación" : "aplicaciones"}. “Qué comprar” ya lo toma en cuenta.</Aviso></div>}
      {q.ok === "precio" && <div className="mb-3"><Aviso tipo="ok">Precio guardado.</Aviso></div>}
      {q.error && <div className="mb-3"><Aviso tipo="error">No se pudo guardar. Revisa el valor e intenta de nuevo.</Aviso></div>}
      <div className="mb-3">
        <Aviso>
          Escribe el precio con IVA por kilo o litro. Si no escribes uno, se usa el último precio con que compraste ese producto en bodega (si existe). Las opciones escritas solo con nombre se calculan con la dosis del producto principal: antes de comprar, confirma con el asesor la dosis de la opción que elijas.
        </Aviso>
      </div>

      <form className="tarjeta mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div><label htmlFor="q" className="etiqueta-campo">Buscar producto</label><input id="q" name="q" defaultValue={q.q ?? ""} className="entrada" placeholder="Ej: Thiolux" /></div>
        <button className="boton">Buscar</button>
        {q.q && <Link href="/programas/opciones" className="text-sm underline">Ver todos</Link>}
      </form>

      {lista.length === 0 && <Aviso>No hay productos con opciones{q.q ? " para esa búsqueda" : ""}.</Aviso>}

      <div className="flex flex-col gap-4">
        {lista.map((g) => {
          const todas = [{ nombre: g.nombre, dosis: g.dosis, propia: true, actual: true }, ...[...g.opciones.values()].map((o) => ({ ...o, actual: false }))];
          const costo = (o: { nombre: string; dosis: number | null; propia: boolean }) => {
            const p = precioDe(o.nombre);
            const d = o.propia ? o.dosis : g.dosis;
            return p && d !== null ? p.precio * d : null;
          };
          const costos = todas.map(costo).filter((c): c is number => c !== null);
          const minimo = costos.length > 1 ? Math.min(...costos) : null;
          return (
            <section key={g.nombre} className="tarjeta p-4">
              <h2 className="font-semibold">{g.nombre}{g.unidad ? <span className="text-sm font-normal text-tinta-suave"> · se mide en {g.unidad}</span> : null}</h2>
              <p className="text-sm text-tinta-suave">Principal en {g.usos} {g.usos === 1 ? "aplicación" : "aplicaciones"}{g.dosis !== null ? ` · dosis ${num(g.dosis, 2)} ${g.unidad ?? ""} por ha` : ""}.</p>
              <div className="mt-3 flex flex-col gap-2">
                {todas.map((o) => {
                  const p = precioDe(o.nombre);
                  const c = costo(o);
                  const barata = minimo !== null && c !== null && Math.abs(c - minimo) < 0.5;
                  return (
                    <form key={o.nombre} className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3 ${barata ? "border-verde/60 bg-verde-claro/40" : "border-linea"}`}>
                      <input type="hidden" name="producto" value={g.nombre} />
                      <input type="hidden" name="opcion" value={o.nombre} />
                      <div className="min-w-40 flex-1">
                        <p className="font-medium">{o.nombre}{o.actual && <span className="pastilla ml-1.5 bg-verde-claro text-verde-oscuro">principal ahora</span>}{barata && <span className="pastilla ml-1.5 bg-verde-claro text-verde-oscuro">más barata</span>}</p>
                        <p className="text-xs text-tinta-suave">
                          {p ? `${p.fuente === "tuyo" ? "Precio anotado" : "Última compra"} ${fecha(p.fecha)}: ${clp(p.precio)}` : "Sin precio"}
                          {c !== null ? ` · ${clp(Math.round(c))} por ha${o.propia ? "" : " (dosis supuesta igual)"}` : ""}
                        </p>
                      </div>
                      {edita && (
                        <>
                          <input name="precio" defaultValue={p?.fuente === "tuyo" ? String(p.precio).replace(".", ",") : ""} inputMode="decimal" className="entrada w-28" placeholder="Precio" aria-label={`Precio de ${o.nombre}`} />
                          <button formAction={guardarPrecio} className="boton-secundario">Guardar precio</button>
                          {!o.actual && <button formAction={usarOpcion} className="boton">Usar esta</button>}
                        </>
                      )}
                    </form>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
