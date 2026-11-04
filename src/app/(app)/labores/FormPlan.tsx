"use client";
import { useActionState } from "react";
import { crearPlan } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";

type Op = { id: string; texto: string };

export function FormPlan({ semana, cuarteles, labores, cuadrillas, trabajadores, editar }: { semana: string; cuarteles: Op[]; labores: Op[]; cuadrillas: Op[]; trabajadores: Op[]; editar?: { id: string; valores: Record<string, string> } }) {
  const [estado, enviar] = useActionState(crearPlan, null);
  const v = editar?.valores ?? {};
  return (
    <form action={enviar} noValidate className="flex flex-col gap-4">
      {editar && <input type="hidden" name="id" value={editar.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="semana" className="etiqueta-campo">Semana (cualquier día de esa semana)</label>
          <input id="semana" name="semana" type="date" defaultValue={v.semana ?? semana} className="entrada" />
        </div>
        <div>
          <label htmlFor="labor" className="etiqueta-campo">Labor</label>
          <select id="labor" name="labor" defaultValue={v.labor ?? ""} className="entrada">
            <option value="">Elegir…</option>
            {labores.map((l) => <option key={l.id} value={l.id}>{l.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cuartel" className="etiqueta-campo">Cuartel</label>
          <select id="cuartel" name="cuartel" defaultValue={v.cuartel ?? ""} className="entrada">
            <option value="">General del campo</option>
            {cuarteles.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cuadrilla" className="etiqueta-campo">Cuadrilla</label>
          <select id="cuadrilla" name="cuadrilla" defaultValue={v.cuadrilla ?? ""} className="entrada">
            <option value="">Por definir</option>
            {cuadrillas.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="fiscalizador" className="etiqueta-campo">Quién fiscaliza (trabajador del campo)</label>
          <select id="fiscalizador" name="fiscalizador" defaultValue={v.fiscalizador ?? ""} className="entrada">
            <option value="">Por definir</option>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="personas" className="etiqueta-campo">Personas previstas (opcional)</label>
          <input id="personas" name="personas" defaultValue={v.personas ?? ""} inputMode="numeric" className="entrada" placeholder="Ej: 8" />
        </div>
        <div>
          <label htmlFor="observacion" className="etiqueta-campo">Instrucciones para la labor (opcional)</label>
          <input id="observacion" name="observacion" defaultValue={v.observacion ?? ""} className="entrada" placeholder="Ej: partir por las hileras de arriba, dejar 2 frutos por racimo" />
        </div>
      </div>
      <ResultadoFormulario estado={estado} />
      <div><BotonEnviar className="boton w-full sm:w-auto">{editar ? "Guardar cambios" : "Agregar al plan"}</BotonEnviar></div>
    </form>
  );
}
