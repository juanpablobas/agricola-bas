"use client";
import { useActionState, useState } from "react";
import { ingresar, recuperarClave } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";

export function FormularioIngreso() {
  const [modo, setModo] = useState<"ingreso" | "recuperar">("ingreso");
  const [estadoIngreso, accionIngreso] = useActionState(ingresar, null);
  const [estadoRecuperar, accionRecuperar] = useActionState(recuperarClave, null);

  if (modo === "recuperar") {
    return (
      <form action={accionRecuperar} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="etiqueta-campo">Correo</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="entrada" />
        </div>
        <ResultadoFormulario estado={estadoRecuperar} />
        <BotonEnviar pendiente="Enviando…">Enviar enlace</BotonEnviar>
        <button type="button" onClick={() => setModo("ingreso")} className="text-sm text-verde hover:underline">
          Volver al ingreso
        </button>
      </form>
    );
  }

  return (
    <form action={accionIngreso} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="etiqueta-campo">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="entrada" />
      </div>
      <div>
        <label htmlFor="clave" className="etiqueta-campo">Contraseña</label>
        <input id="clave" name="clave" type="password" autoComplete="current-password" required className="entrada" />
      </div>
      <ResultadoFormulario estado={estadoIngreso} />
      <BotonEnviar pendiente="Ingresando…">Ingresar</BotonEnviar>
      <button type="button" onClick={() => setModo("recuperar")} className="text-sm text-verde hover:underline">
        Olvidé mi contraseña
      </button>
    </form>
  );
}
