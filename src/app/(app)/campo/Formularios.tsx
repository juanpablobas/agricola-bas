"use client";
import { useActionState, useEffect, useRef } from "react";
import { guardarCampo, crearTemporada, crearCentroCosto, crearEspecie, crearVariedad } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario, type EstadoFormulario } from "@/components/Aviso";

function useLimpiarAlGuardar(estado: EstadoFormulario) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) ref.current?.reset();
  }, [estado]);
  return ref;
}

const t = (v: unknown) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

export function FormularioCampo({ campo, editable }: { campo: any; editable: boolean }) {
  const [estado, enviar] = useActionState(guardarCampo, null);
  const campos: [string, string, string?][] = [
    ["nombre", "Nombre del campo"],
    ["razon_social", "Razón social"],
    ["rut", "RUT"],
    ["comuna", "Comuna"],
    ["region", "Región"],
    ["direccion", "Dirección o acceso"],
    ["superficie_total_ha", "Superficie total del predio (ha)", "decimal"],
  ];
  return (
    <form action={enviar} className="grid gap-4 sm:grid-cols-2">
      {campo?.id && <input type="hidden" name="id" value={campo.id} />}
      {campos.map(([k, e, modo]) => (
        <div key={k}>
          <label htmlFor={k} className="etiqueta-campo">{e}</label>
          <input
            id={k}
            name={k}
            defaultValue={k === "superficie_total_ha" ? t(campo?.[k]) : (campo?.[k] ?? "")}
            inputMode={modo as any}
            disabled={!editable}
            className="entrada disabled:bg-papel"
          />
        </div>
      ))}
      {[
        ["infraestructura", "Infraestructura y construcciones"],
        ["instalaciones_riego", "Instalaciones de riego"],
        ["observaciones", "Observaciones"],
      ].map(([k, e]) => (
        <div key={k} className="sm:col-span-2">
          <label htmlFor={k} className="etiqueta-campo">{e}</label>
          <textarea id={k} name={k} rows={2} defaultValue={campo?.[k] ?? ""} disabled={!editable} className="entrada disabled:bg-papel" />
        </div>
      ))}
      {editable && (
        <div className="flex flex-col gap-3 sm:col-span-2">
          <ResultadoFormulario estado={estado} />
          <div className="flex justify-end"><BotonEnviar>Guardar datos del campo</BotonEnviar></div>
        </div>
      )}
    </form>
  );
}

export function FormularioTemporada() {
  const [estado, enviar] = useActionState(crearTemporada, null);
  const ref = useLimpiarAlGuardar(estado);
  return (
    <form ref={ref} action={enviar} className="grid gap-3 sm:grid-cols-4">
      <input name="nombre" placeholder="2027-28" required className="entrada" aria-label="Nombre" />
      <input name="inicio" type="date" required className="entrada" aria-label="Inicio" />
      <input name="termino" type="date" required className="entrada" aria-label="Término" />
      <BotonEnviar pendiente="Creando…">Agregar temporada</BotonEnviar>
      <div className="sm:col-span-4"><ResultadoFormulario estado={estado} /></div>
    </form>
  );
}

export function FormularioCentroCosto() {
  const [estado, enviar] = useActionState(crearCentroCosto, null);
  const ref = useLimpiarAlGuardar(estado);
  return (
    <form ref={ref} action={enviar} className="grid gap-3 sm:grid-cols-4">
      <input name="codigo" placeholder="Código, ej. BOD" required className="entrada" aria-label="Código" />
      <input name="nombre" placeholder="Nombre" required className="entrada sm:col-span-2" aria-label="Nombre" />
      <BotonEnviar pendiente="Creando…">Agregar centro</BotonEnviar>
      <div className="sm:col-span-4"><ResultadoFormulario estado={estado} /></div>
    </form>
  );
}

export function FormularioEspecie() {
  const [estado, enviar] = useActionState(crearEspecie, null);
  const ref = useLimpiarAlGuardar(estado);
  return (
    <form ref={ref} action={enviar} className="grid gap-3 sm:grid-cols-3">
      <input name="nombre" placeholder="Especie, ej. Manzano" required className="entrada" aria-label="Especie" />
      <input name="grupo" placeholder="Grupo, ej. Pomácea" className="entrada" aria-label="Grupo" />
      <BotonEnviar pendiente="Creando…">Agregar especie</BotonEnviar>
      <div className="sm:col-span-3"><ResultadoFormulario estado={estado} /></div>
    </form>
  );
}

export function FormularioVariedad({ especies }: { especies: { id: string; nombre: string }[] }) {
  const [estado, enviar] = useActionState(crearVariedad, null);
  const ref = useLimpiarAlGuardar(estado);
  return (
    <form ref={ref} action={enviar} className="grid gap-3 sm:grid-cols-3">
      <select name="especie_id" required className="entrada" aria-label="Especie" defaultValue="">
        <option value="" disabled>Especie…</option>
        {especies.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
      </select>
      <input name="nombre" placeholder="Variedad" required className="entrada" aria-label="Variedad" />
      <BotonEnviar pendiente="Creando…">Agregar variedad</BotonEnviar>
      <div className="sm:col-span-3"><ResultadoFormulario estado={estado} /></div>
    </form>
  );
}
