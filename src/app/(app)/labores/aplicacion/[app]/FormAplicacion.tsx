"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { marcarAplicacionRealizada, type EstadoAplicacion } from "../../aplicacion-acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { Aviso } from "@/components/Aviso";
import type { VariedadCalc } from "../../aplicacion";

type Prod = { linea_id: string; nombre: string; unidad: string; producto_id: string | null; enBodega: string | null; stock: number | null; porVariedad: Record<string, number> };
const n = (v: number, d = 2) => v.toLocaleString("es-CL", { maximumFractionDigits: d });

export function FormAplicacion({ appId, hoy, variedades, productos, enlaceDetalle, volver = "/labores" }: { appId: string; hoy: string; variedades: VariedadCalc[]; productos: Prod[]; enlaceDetalle: string; volver?: string }) {
  const [estado, enviar] = useActionState<EstadoAplicacion, FormData>(marcarAplicacionRealizada, null);
  const [sel, setSel] = useState<Set<string>>(new Set(variedades.map((v) => v.id)));
  const [descontar, setDescontar] = useState<"si" | "no" | null>(null);
  const [prods, setProds] = useState<Set<string>>(new Set(productos.filter((p) => p.producto_id).map((p) => p.linea_id)));
  const total = (p: Prod) => [...sel].reduce((s, v) => s + (p.porVariedad[v] ?? 0), 0);
  const faltaStock = productos.filter((p) => prods.has(p.linea_id) && p.producto_id && total(p) > (p.stock ?? 0) + 0.0005);

  return (
    <form action={enviar} className="flex flex-col gap-5">
      <input type="hidden" name="app" value={appId} />
      <input type="hidden" name="volver" value={volver} />
      {descontar && <input type="hidden" name="descontar" value={descontar} />}
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="fecha" className="etiqueta-campo">¿Qué día se aplicó?</label>
          <input id="fecha" name="fecha" type="date" defaultValue={hoy} max={hoy} className="entrada" />
        </div>
        <div className="sm:col-span-2">
          <p className="etiqueta-campo">Variedades aplicadas</p>
          <div className="flex flex-col gap-1.5">
            {variedades.map((v) => (
              <label key={v.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${sel.has(v.id) ? "border-verde bg-verde-claro/50" : "border-linea"}`}>
                <input type="checkbox" name="variedad" value={v.id} checked={sel.has(v.id)} onChange={(e) => { const s = new Set(sel); if (e.target.checked) s.add(v.id); else s.delete(v.id); setSel(s); }} className="size-4 accent-verde" />
                <span className="flex-1 font-medium">{v.nombre}</span>
                <span className="text-xs text-tinta-suave">{n(v.ha)} ha{v.litros ? ` · ${n(v.litros, 0)} L/ha${v.litrosReal ? "" : " (del programa)"}` : ""}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 font-semibold">¿Descontar los productos de bodega?</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["si", "Sí, descontar", "Se registra la salida de bodega"], ["no", "No descontar", "Solo queda como realizada"]] as const).map(([v, t, d]) => (
            <button key={v} type="button" onClick={() => setDescontar(v)} aria-pressed={descontar === v}
              className={`rounded-xl border-2 px-3 py-2.5 text-left ${descontar === v ? "border-verde bg-verde-claro" : "border-linea bg-white"}`}>
              <span className={`block font-semibold ${descontar === v ? "text-verde-oscuro" : ""}`}>{t}</span>
              <span className="block text-xs text-tinta-suave">{d}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {descontar === "si" && (
        <div className="rounded-xl border border-linea">
          <p className="border-b border-linea px-3 py-2 text-sm text-tinta-suave">Cantidades según la dosis del programa × mojamiento × hectáreas. Desmarca lo que no se usó.</p>
          <ul className="divide-y divide-linea">
            {productos.map((p) => {
              const t = total(p);
              const on = prods.has(p.linea_id) && !!p.producto_id;
              const falta = on && t > (p.stock ?? 0) + 0.0005;
              return (
                <li key={p.linea_id} className="flex items-center gap-3 px-3 py-2.5">
                  <input type="checkbox" name="producto" value={p.linea_id} checked={on} disabled={!p.producto_id} onChange={(e) => { const s = new Set(prods); if (e.target.checked) s.add(p.linea_id); else s.delete(p.linea_id); setProds(s); }} className="size-4 accent-verde" aria-label={p.nombre} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.nombre}</span>
                    <span className={`block text-xs ${falta ? "text-alerta" : "text-tinta-suave"}`}>
                      {p.producto_id ? `En bodega: ${n(p.stock ?? 0)} ${p.unidad}${falta ? " · no alcanza" : ""}` : "No está unido a un producto de bodega: no se descuenta"}
                    </span>
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${on ? "" : "text-tinta-suave line-through"}`}>{n(t)} {p.unidad}</span>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-linea px-3 py-2 text-xs text-tinta-suave">¿Usaste otra dosis o una alternativa? <Link href={enlaceDetalle} className="text-verde underline">Ajusta cantidades una por una</Link>.</p>
        </div>
      )}
      {descontar === "si" && faltaStock.length > 0 && <Aviso tipo="error">No alcanza el stock de {faltaStock.map((p) => p.nombre).join(", ")}. Desmárcalo o registra sin descontar.</Aviso>}

      <div>
        <label htmlFor="obs" className="etiqueta-campo">Observación (opcional)</label>
        <input id="obs" name="obs" className="entrada" placeholder="Ej: se aplicó con viento bajo, en la mañana" />
      </div>

      {descontar === null ? (
        <p className="text-sm text-tinta-suave">Elige si se descuentan los productos para poder guardar.</p>
      ) : (
        <div><BotonEnviar className="boton w-full sm:w-auto">Guardar como realizada</BotonEnviar></div>
      )}
    </form>
  );
}
