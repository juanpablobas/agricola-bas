"use client";
import { useActionState } from "react";
import { editarEquipo } from "../acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";

const t = (v: unknown) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

export function FormularioEquipo({ equipo, sectores }: { equipo: any; sectores: any[] }) {
  const [estado, enviar] = useActionState(editarEquipo, null);
  return (
    <form action={enviar} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={equipo.id} />
      <fieldset className="tarjeta grid gap-4 p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Equipo</legend>
        {[
          ["nombre", "Nombre"],
          ["origen", "Origen del agua"],
          ["emisor", "Emisor"],
          ["filtro", "Filtro"],
          ["bomba", "Bomba"],
        ].map(([k, e]) => (
          <div key={k}>
            <label htmlFor={k} className="etiqueta-campo">{e}</label>
            <input id={k} name={k} defaultValue={equipo[k] ?? ""} className="entrada" />
          </div>
        ))}
        <div className="sm:col-span-2">
          <label htmlFor="observaciones" className="etiqueta-campo">Observaciones</label>
          <textarea id="observaciones" name="observaciones" rows={2} defaultValue={equipo.observaciones ?? ""} className="entrada" />
        </div>
      </fieldset>

      <fieldset className="tarjeta overflow-x-auto p-4">
        <legend className="px-1 text-sm font-semibold">Sectores</legend>
        <table className="tabla min-w-[760px]">
          <thead>
            <tr>
              <th>Sector</th>
              <th>Superficie (ha)</th>
              <th>Líneas/hilera</th>
              <th>Emisor (l/h)</th>
              <th>Entre emisores (m)</th>
              <th>Precip. (mm/h)</th>
              <th>Turno (h)</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {sectores.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">
                  {s.codigo}
                  <input type="hidden" name="sector_id" value={s.id} />
                </td>
                <td><input name={`superficie_${s.id}`} defaultValue={t(s.superficie_ha)} inputMode="decimal" className="entrada w-24 py-1.5" /></td>
                <td><input name={`lineas_${s.id}`} defaultValue={t(s.lineas_por_hilera)} inputMode="numeric" className="entrada w-20 py-1.5" /></td>
                <td><input name={`caudal_${s.id}`} defaultValue={t(s.caudal_emisor_lh)} inputMode="decimal" className="entrada w-20 py-1.5" /></td>
                <td><input name={`distancia_${s.id}`} defaultValue={t(s.distancia_emisores_m)} inputMode="decimal" className="entrada w-20 py-1.5" /></td>
                <td><input name={`precipitacion_${s.id}`} defaultValue={t(s.precipitacion_mmh)} inputMode="decimal" className="entrada w-20 py-1.5" /></td>
                <td><input name={`horas_${s.id}`} defaultValue={t(s.horas_turno)} inputMode="decimal" className="entrada w-20 py-1.5" /></td>
                <td><input name={`obs_${s.id}`} defaultValue={s.observaciones ?? ""} className="entrada min-w-48 py-1.5" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>

      <ResultadoFormulario estado={estado} />
      <div className="flex justify-end"><BotonEnviar>Guardar</BotonEnviar></div>
    </form>
  );
}
