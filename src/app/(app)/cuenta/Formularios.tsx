"use client";
import { useActionState } from "react";
import { guardarNombre, cambiarClave } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";

export function FormularioNombre({ nombre }: { nombre: string }) {
  const [estado, enviar] = useActionState(guardarNombre, null);
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <div>
        <label htmlFor="nombre" className="etiqueta-campo">Nombre</label>
        <input id="nombre" name="nombre" defaultValue={nombre} required className="entrada" />
      </div>
      <ResultadoFormulario estado={estado} />
      <div><BotonEnviar>Guardar nombre</BotonEnviar></div>
    </form>
  );
}

export function FormularioClave() {
  const [estado, enviar] = useActionState(cambiarClave, null);
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <div>
        <label htmlFor="clave" className="etiqueta-campo">Nueva contraseña</label>
        <input id="clave" name="clave" type="password" autoComplete="new-password" minLength={10} required className="entrada" />
      </div>
      <div>
        <label htmlFor="repetir" className="etiqueta-campo">Repítela</label>
        <input id="repetir" name="repetir" type="password" autoComplete="new-password" minLength={10} required className="entrada" />
      </div>
      <ResultadoFormulario estado={estado} />
      <div><BotonEnviar>Cambiar contraseña</BotonEnviar></div>
    </form>
  );
}
