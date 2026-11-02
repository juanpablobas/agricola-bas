"use client";
import { useActionState } from "react";
import { cargarInventario } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";

export function FormularioInventario() {
  const [estado, enviar] = useActionState(cargarInventario, null);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <div>
        <label htmlFor="archivo" className="etiqueta-campo">Archivo Excel de inventario</label>
        <input id="archivo" name="archivo" type="file" accept=".xlsx,.xls" required className="entrada file:mr-3 file:rounded-md file:border-0 file:bg-verde-claro file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-verde-oscuro" />
      </div>
      <ResultadoFormulario estado={estado} />
      <div><BotonEnviar pendiente="Cargando, puede tardar unos segundos…">Cargar inventario</BotonEnviar></div>
    </form>
  );
}
