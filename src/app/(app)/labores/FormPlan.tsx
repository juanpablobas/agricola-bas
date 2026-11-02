"use client";
import { useActionState } from "react";
import { crearPlan } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";

type Op = { id: string; texto: string };

export function FormPlan({ semana, cuarteles, labores, cuadrillas }: { semana: string; cuarteles: Op[]; labores: Op[]; cuadrillas: Op[] }) {
  const [estado, enviar] = useActionState(crearPlan, null);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="semana" className="etiqueta-campo">Semana (cualquier día de esa semana)</label>
          <input id="semana" name="semana" type="date" defaultValue={semana} required className="entrada" />
        </div>
        <div>
          <label htmlFor="labor" className="etiqueta-campo">Labor</label>
          <select id="labor" name="labor" required defaultValue="" className="entrada">
            <option value="" disabled>Elegir…</option>
            {labores.map((l) => <option key={l.id} value={l.id}>{l.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cuartel" className="etiqueta-campo">Cuartel</label>
          <select id="cuartel" name="cuartel" defaultValue="" className="entrada">
            <option value="">General del campo</option>
            {cuarteles.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cuadrilla" className="etiqueta-campo">Cuadrilla</label>
          <select id="cuadrilla" name="cuadrilla" defaultValue="" className="entrada">
            <option value="">Por definir</option>
            {cuadrillas.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="personas" className="etiqueta-campo">Personas previstas (opcional)</label>
          <input id="personas" name="personas" inputMode="numeric" className="entrada" placeholder="Ej: 8" />
        </div>
        <div>
          <label htmlFor="observacion" className="etiqueta-campo">Observación (opcional)</label>
          <input id="observacion" name="observacion" className="entrada" placeholder="Ej: partir por las hileras de arriba" />
        </div>
      </div>
      <ResultadoFormulario estado={estado} />
      <div><BotonEnviar>Agregar al plan</BotonEnviar></div>
    </form>
  );
}
