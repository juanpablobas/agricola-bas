"use client";
import { useActionState } from "react";
import { crearCuadrilla, crearLabor } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";

export function FormCuadrilla() {
  const [estado, enviar] = useActionState(crearCuadrilla, null);
  return (
    <form action={enviar} className="grid gap-3 sm:grid-cols-2">
      <div><label htmlFor="c-nombre" className="etiqueta-campo">Nombre de la cuadrilla</label><input id="c-nombre" name="nombre" required className="entrada" placeholder="Ej: Cuadrilla Pérez" /></div>
      <div><label htmlFor="c-jefe" className="etiqueta-campo">Jefe de cuadrilla (el gato)</label><input id="c-jefe" name="jefe" className="entrada" /></div>
      <div><label htmlFor="c-tipo" className="etiqueta-campo">Tipo</label><select id="c-tipo" name="tipo" defaultValue="contratista" className="entrada"><option value="contratista">Contratista</option><option value="propia">Personal propio</option></select></div>
      <div><label htmlFor="c-tel" className="etiqueta-campo">Teléfono (opcional)</label><input id="c-tel" name="telefono" inputMode="tel" className="entrada" /></div>
      <div className="sm:col-span-2"><ResultadoFormulario estado={estado} /></div>
      <div><BotonEnviar>Agregar cuadrilla</BotonEnviar></div>
    </form>
  );
}

export function FormLabor() {
  const [estado, enviar] = useActionState(crearLabor, null);
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1"><label htmlFor="l-nombre" className="etiqueta-campo">Nueva labor</label><input id="l-nombre" name="nombre" required className="entrada" placeholder="Ej: Control de maleza" /></div>
      <BotonEnviar>Agregar labor</BotonEnviar>
      <div className="w-full"><ResultadoFormulario estado={estado} /></div>
    </form>
  );
}
