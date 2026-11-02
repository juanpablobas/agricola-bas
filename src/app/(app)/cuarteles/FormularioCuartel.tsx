"use client";
import { useActionState, useState } from "react";
import { crearCuartel, editarCuartel, cambiarPlantacion } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";
import { ESTADOS } from "@/lib/etiquetas";

export type EspecieConVariedades = { id: string; nombre: string; variedades: { id: string; nombre: string }[] };
export type SectorOpcion = { id: string; codigo: string; equipo: number };

export type ValoresCuartel = {
  id?: string;
  periodo_id?: string | null;
  codigo?: string;
  nombre?: string | null;
  superficie_ha?: number | null;
  estado_productivo?: string;
  sistema_riego?: string | null;
  observaciones?: string | null;
  especie_id?: string | null;
  variedad_id?: string | null;
  portainjerto?: string | null;
  anio_plantacion?: number | null;
  distancia_hileras_m?: number | null;
  distancia_plantas_m?: number | null;
  plantas?: number | null;
  sectores?: string[];
};

const aTexto = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

function Campo({ id, etiqueta, ayuda, children }: { id: string; etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta-campo">{etiqueta}</label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-tinta-suave">{ayuda}</p>}
    </div>
  );
}

export function FormularioCuartel({
  modo,
  valores = {},
  especies,
  sectores,
}: {
  modo: "nuevo" | "editar" | "plantacion";
  valores?: ValoresCuartel;
  especies: EspecieConVariedades[];
  sectores: SectorOpcion[];
}) {
  const accion = modo === "nuevo" ? crearCuartel : modo === "editar" ? editarCuartel : cambiarPlantacion;
  const [estado, enviar] = useActionState(accion, null);

  const seleccionInicial =
    modo === "plantacion"
      ? ""
      : valores.variedad_id
        ? `var:${valores.variedad_id}`
        : valores.especie_id
          ? `esp:${valores.especie_id}`
          : "";
  const [plantacion, setPlantacion] = useState(seleccionInicial);
  const sinVariedad = plantacion.startsWith("esp:");

  const datosPlantacion = (
    <fieldset className="tarjeta grid gap-4 p-4 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">
        {modo === "plantacion" ? "Nueva plantación" : "Plantación vigente"}
      </legend>

      {modo === "plantacion" && (
        <>
          <Campo id="desde" etiqueta="Rige desde" ayuda="La plantación anterior queda cerrada el día previo.">
            <input id="desde" name="desde" type="date" required className="entrada" />
          </Campo>
          <Campo id="motivo" etiqueta="Motivo">
            <select id="motivo" name="motivo" className="entrada" defaultValue="Reinjerto">
              <option>Reinjerto</option>
              <option>Replante</option>
              <option>Arranque y nueva plantación</option>
              <option>Corrección de registro</option>
            </select>
          </Campo>
        </>
      )}

      <Campo id="plantacion" etiqueta="Especie y variedad">
        <select
          id="plantacion"
          name="plantacion"
          required
          value={plantacion}
          onChange={(e) => setPlantacion(e.target.value)}
          className="entrada"
        >
          <option value="" disabled>Elegir…</option>
          {especies.map((e) => (
            <optgroup key={e.id} label={e.nombre}>
              {e.variedades.map((v) => (
                <option key={v.id} value={`var:${v.id}`}>{e.nombre} · {v.nombre}</option>
              ))}
              <option value={`esp:${e.id}`}>{e.nombre} · variedad sin definir o nueva</option>
            </optgroup>
          ))}
        </select>
      </Campo>

      {sinVariedad ? (
        <Campo id="variedad_nueva" etiqueta="Variedad nueva (opcional)" ayuda="Si la escribes, queda disponible para otros cuarteles.">
          <input id="variedad_nueva" name="variedad_nueva" className="entrada" placeholder="Ej. Dapple Dandy" />
        </Campo>
      ) : (
        <div className="hidden sm:block" />
      )}

      <Campo id="portainjerto" etiqueta="Portainjerto">
        <input id="portainjerto" name="portainjerto" defaultValue={modo === "plantacion" ? "" : (valores.portainjerto ?? "")} className="entrada" />
      </Campo>
      <Campo id="anio_plantacion" etiqueta="Año de plantación">
        <input
          id="anio_plantacion"
          name="anio_plantacion"
          inputMode="numeric"
          defaultValue={modo === "plantacion" ? "" : aTexto(valores.anio_plantacion)}
          className="entrada"
          placeholder="Ej. 2025"
        />
      </Campo>
      <Campo id="distancia_hileras_m" etiqueta="Distancia entre hileras (m)">
        <input
          id="distancia_hileras_m"
          name="distancia_hileras_m"
          inputMode="decimal"
          defaultValue={aTexto(valores.distancia_hileras_m)}
          className="entrada"
        />
      </Campo>
      <Campo id="distancia_plantas_m" etiqueta="Distancia entre plantas (m)">
        <input
          id="distancia_plantas_m"
          name="distancia_plantas_m"
          inputMode="decimal"
          defaultValue={aTexto(valores.distancia_plantas_m)}
          className="entrada"
        />
      </Campo>
      <Campo id="plantas" etiqueta="Plantas (conteo real)" ayuda="Déjalo vacío si no hay conteo; se muestran las teóricas por marco.">
        <input id="plantas" name="plantas" inputMode="numeric" defaultValue={modo === "plantacion" ? "" : aTexto(valores.plantas)} className="entrada" />
      </Campo>
    </fieldset>
  );

  return (
    <form action={enviar} className="flex flex-col gap-5">
      {valores.id && <input type="hidden" name="id" value={valores.id} />}
      {valores.periodo_id && <input type="hidden" name="periodo_id" value={valores.periodo_id} />}

      {modo !== "plantacion" && (
        <fieldset className="tarjeta grid gap-4 p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Cuartel</legend>
          <Campo id="codigo" etiqueta="Código" ayuda="Equipo y sector, por ejemplo 4-4b.">
            <input id="codigo" name="codigo" required defaultValue={valores.codigo ?? ""} className="entrada" />
          </Campo>
          <Campo id="nombre" etiqueta="Nombre (opcional)">
            <input id="nombre" name="nombre" defaultValue={valores.nombre ?? ""} className="entrada" placeholder="Ej. Cerezos del tranque" />
          </Campo>
          <Campo id="superficie_ha" etiqueta="Superficie (ha)">
            <input id="superficie_ha" name="superficie_ha" required inputMode="decimal" defaultValue={aTexto(valores.superficie_ha)} className="entrada" />
          </Campo>
          <Campo id="estado_productivo" etiqueta="Estado productivo">
            <select id="estado_productivo" name="estado_productivo" defaultValue={valores.estado_productivo ?? "en_formacion"} className="entrada">
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
              ))}
            </select>
          </Campo>
          <Campo id="sistema_riego" etiqueta="Sistema de riego">
            <input id="sistema_riego" name="sistema_riego" defaultValue={valores.sistema_riego ?? ""} className="entrada" placeholder="Ej. Goteo, doble línea" />
          </Campo>
          {modo === "nuevo" && (
            <Campo id="desde" etiqueta="Fecha de plantación (si se conoce)">
              <input id="desde" name="desde" type="date" className="entrada" />
            </Campo>
          )}
          <div className="sm:col-span-2">
            <p className="etiqueta-campo">Sectores de riego</p>
            <div className="flex flex-wrap gap-2">
              {sectores.map((s) => (
                <label key={s.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-linea px-3 text-sm has-[:checked]:border-verde has-[:checked]:bg-verde-claro">
                  <input type="checkbox" name="sectores" value={s.id} defaultChecked={valores.sectores?.includes(s.id)} className="size-4 accent-verde" />
                  {s.codigo}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Campo id="observaciones" etiqueta="Observaciones">
              <textarea id="observaciones" name="observaciones" rows={3} defaultValue={valores.observaciones ?? ""} className="entrada" />
            </Campo>
          </div>
        </fieldset>
      )}

      {datosPlantacion}

      <ResultadoFormulario estado={estado} />
      <div className="flex justify-end gap-2">
        <BotonEnviar>{modo === "plantacion" ? "Registrar cambio de plantación" : "Guardar"}</BotonEnviar>
      </div>
    </form>
  );
}
