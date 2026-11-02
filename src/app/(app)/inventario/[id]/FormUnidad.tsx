"use client";
import { useActionState } from "react";
import { guardarUnidad } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";

export function FormUnidad({ id, unidad }: { id: string; unidad: string | null }) {
  const [estado, enviar] = useActionState(guardarUnidad, null);
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="unidad" className="etiqueta-campo">Unidad del producto</label>
        <select id="unidad" name="unidad" defaultValue={unidad ?? ""} className="entrada py-2 text-sm">
          <option value="" disabled>Elegir…</option>
          <option value="Kg">Kg</option><option value="L">L</option><option value="un">Unidades</option><option value="m">Metros</option><option value="rollo">Rollos</option>
        </select>
      </div>
      <BotonEnviar className="boton-secundario">Guardar</BotonEnviar>
      <div className="w-full sm:w-auto"><ResultadoFormulario estado={estado} /></div>
    </form>
  );
}
