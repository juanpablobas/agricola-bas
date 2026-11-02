"use client";
import { useActionState, useMemo, useState } from "react";
import { registrarSalida } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";

type Prod = { id: string; nombre: string; unidad: string | null; stock: number };
type Ceco = { id: string; codigo: string; nombre: string };

export function FormularioSalida({ productos, cecos, hoy, inicial }: { productos: Prod[]; cecos: Ceco[]; hoy: string; inicial?: string }) {
  const [estado, enviar] = useActionState(registrarSalida, null);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState(inicial ?? "");
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const f = q ? productos.filter((p) => p.nombre.toLowerCase().includes(q)) : productos;
    return f.slice(0, 200);
  }, [busca, productos]);
  const actual = productos.find((p) => p.id === sel);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <div>
        <label htmlFor="busca" className="etiqueta-campo">Buscar producto</label>
        <input id="busca" value={busca} onChange={(e) => setBusca(e.target.value)} className="entrada" placeholder="Escribe parte del nombre" autoComplete="off" />
      </div>
      <div>
        <label htmlFor="producto" className="etiqueta-campo">Producto (solo los que tienen stock)</label>
        <select id="producto" name="producto" value={sel} onChange={(e) => setSel(e.target.value)} required className="entrada">
          <option value="" disabled>Elegir…</option>
          {lista.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre} — stock {p.stock.toLocaleString("es-CL", { maximumFractionDigits: 2 })} {p.unidad ?? ""}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cantidad" className="etiqueta-campo">Cantidad que salió {actual?.unidad ? `(${actual.unidad})` : ""}</label>
          <input id="cantidad" name="cantidad" inputMode="decimal" required className="entrada" placeholder="Ej: 12,5" />
          {actual && <p className="mt-1 text-xs text-tinta-suave">Disponible: {actual.stock.toLocaleString("es-CL", { maximumFractionDigits: 2 })} {actual.unidad ?? ""}</p>}
        </div>
        <div>
          <label htmlFor="fecha" className="etiqueta-campo">Fecha</label>
          <input id="fecha" name="fecha" type="date" defaultValue={hoy} max={hoy} required className="entrada" />
        </div>
      </div>
      <div>
        <label htmlFor="ceco" className="etiqueta-campo">¿A qué variedad o centro de costo?</label>
        <select id="ceco" name="ceco" required defaultValue="" className="entrada">
          <option value="" disabled>Elegir…</option>
          {cecos.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="observacion" className="etiqueta-campo">Observación (opcional)</label>
        <input id="observacion" name="observacion" className="entrada" placeholder="Ej: aplicación de emergencia, herbicida cuartel 3" />
      </div>
      <ResultadoFormulario estado={estado} />
      <div><BotonEnviar>Registrar salida</BotonEnviar></div>
    </form>
  );
}
