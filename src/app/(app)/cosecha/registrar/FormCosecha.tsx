"use client";
import { useActionState } from "react";
import { registrarCosecha } from "../acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";

type Op = { id: string; texto: string };

export function FormCosecha({ hoy, cuarteles, cuadrillas }: { hoy: string; cuarteles: Op[]; cuadrillas: Op[] }) {
  const [estado, enviar] = useActionState(registrarCosecha, null);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fecha" className="etiqueta-campo">Fecha</label>
          <input id="fecha" name="fecha" type="date" defaultValue={hoy} max={hoy} required className="entrada" />
        </div>
        <div>
          <label htmlFor="cuartel" className="etiqueta-campo">Cuartel</label>
          <select id="cuartel" name="cuartel" required defaultValue="" className="entrada">
            <option value="" disabled>Elegir…</option>
            {cuarteles.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cuadrilla" className="etiqueta-campo">Contratista o cuadrilla</label>
          <select id="cuadrilla" name="cuadrilla" defaultValue="" className="entrada">
            <option value="">Personal propio / sin definir</option>
            {cuadrillas.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="destino" className="etiqueta-campo">Destino</label>
          <select id="destino" name="destino" defaultValue="exportadora" className="entrada">
            <option value="exportadora">Exportadora</option>
            <option value="mercado_nacional">Mercado nacional</option>
            <option value="proceso">Proceso</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label htmlFor="kilos" className="etiqueta-campo">Kilos cosechados (si los sabes)</label>
          <input id="kilos" name="kilos" inputMode="decimal" className="entrada" placeholder="Ej: 1.250" />
        </div>
        <div>
          <label htmlFor="cantidad" className="etiqueta-campo">Cantidad (si la cuentas en bins, cajas…)</label>
          <div className="flex gap-2">
            <input id="cantidad" name="cantidad" inputMode="decimal" className="entrada w-28" placeholder="Ej: 12" />
            <select name="unidad" defaultValue="bins" className="entrada" aria-label="Unidad">
              <option value="bins">bins</option>
              <option value="cajas">cajas</option>
              <option value="bandejas">bandejas</option>
              <option value="tarros">tarros</option>
              <option value="baldes">baldes</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="baldes" className="etiqueta-campo">Baldes por persona (nogales; opcional)</label>
        <textarea id="baldes" name="baldes" rows={5} className="entrada" placeholder={"Una persona por línea con su número, por ejemplo:\nJuan 25\nMaría 31"} />
      </div>
      <div>
        <label htmlFor="obs" className="etiqueta-campo">Observación (opcional)</label>
        <input id="obs" name="obs" className="entrada" placeholder="Ej: fruta con lluvia, se cosechó solo la mitad" />
      </div>
      <ResultadoFormulario estado={estado} />
      <div><BotonEnviar>Guardar cosecha</BotonEnviar></div>
    </form>
  );
}
