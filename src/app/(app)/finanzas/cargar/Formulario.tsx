"use client";
import { useActionState } from "react";
import { cargarArchivo } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";

export function FormularioCarga({ hayPresupuesto, hayGastos }: { hayPresupuesto: boolean; hayGastos: boolean }) {
  const [estado, enviar] = useActionState(cargarArchivo, null);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <div>
        <label htmlFor="archivo" className="etiqueta-campo">Archivo Excel del administrador</label>
        <input id="archivo" name="archivo" type="file" accept=".xlsx,.xls" required className="entrada file:mr-3 file:rounded-md file:border-0 file:bg-verde-claro file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-verde-oscuro" />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="etiqueta-campo">¿Qué quieres cargar de ese archivo?</legend>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="gastos" defaultChecked className="size-5 accent-verde" />
          Gastos reales (hoja Remesa)
          {hayGastos && <span className="text-xs text-tinta-suave">· reemplaza los gastos cargados antes</span>}
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="presupuesto" defaultChecked={!hayPresupuesto} className="size-5 accent-verde" />
          Presupuesto (hoja Ppto)
          {hayPresupuesto && <span className="text-xs text-tinta-suave">· reemplaza el presupuesto cargado antes</span>}
        </label>
      </fieldset>
      <ResultadoFormulario estado={estado} />
      <div><BotonEnviar pendiente="Cargando, puede tardar unos segundos…">Cargar archivo</BotonEnviar></div>
    </form>
  );
}
