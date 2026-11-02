"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { crearUsuario } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { Aviso } from "@/components/Aviso";
import { ROLES } from "@/lib/etiquetas";

export function FormularioUsuario() {
  const [estado, enviar] = useActionState(crearUsuario, null);
  const [metodo, setMetodo] = useState("clave");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) ref.current?.reset();
  }, [estado]);

  return (
    <form ref={ref} action={enviar} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="nombre" className="etiqueta-campo">Nombre</label>
          <input id="nombre" name="nombre" required className="entrada" />
        </div>
        <div>
          <label htmlFor="email" className="etiqueta-campo">Correo</label>
          <input id="email" name="email" type="email" required className="entrada" />
        </div>
        <div>
          <label htmlFor="rol" className="etiqueta-campo">Rol</label>
          <select id="rol" name="rol" defaultValue="operario" className="entrada">
            {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
          </select>
        </div>
      </div>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="etiqueta-campo">Cómo entregar el acceso</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="metodo" value="clave" checked={metodo === "clave"} onChange={() => setMetodo("clave")} className="mt-0.5 size-4 accent-verde" />
          <span>Contraseña temporal que le entregas tú <span className="text-tinta-suave">(funciona siempre)</span></span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="metodo" value="correo" checked={metodo === "correo"} onChange={() => setMetodo("correo")} className="mt-0.5 size-4 accent-verde" />
          <span>Invitación por correo <span className="text-tinta-suave">(requiere correo configurado en Supabase)</span></span>
        </label>
      </fieldset>

      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado?.ok && (
        <Aviso tipo="ok">
          {estado.ok}
          {estado.clave && (
            <span className="mt-2 block rounded-md bg-white px-3 py-2 font-mono text-sm text-tinta">
              {estado.email}
              <br />
              {estado.clave}
            </span>
          )}
        </Aviso>
      )}
      <div className="flex justify-end"><BotonEnviar pendiente="Creando…">Crear usuario</BotonEnviar></div>
    </form>
  );
}
