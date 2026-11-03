"use client";
import { useEffect, useState, useTransition } from "react";
import { enviarPrueba } from "./acciones";
import { ResultadoFormulario, type EstadoFormulario } from "@/components/Aviso";
import { activarAvisos, desactivarAvisos, leerEstadoAvisos, type EstadoAvisos } from "@/components/avisos-cliente";

export function Notificaciones({ clave }: { clave: string | null }) {
  const [estado, setEstado] = useState<EstadoAvisos | "cargando">("cargando");
  const [msg, setMsg] = useState<EstadoFormulario>(null);
  const [ocupado, empezar] = useTransition();

  useEffect(() => {
    leerEstadoAvisos().then(setEstado).catch(() => setEstado("apagado"));
  }, []);

  const activar = () =>
    empezar(async () => {
      setMsg(null);
      const r = await activarAvisos(clave);
      setMsg(r);
      setEstado(await leerEstadoAvisos());
    });
  const desactivar = () =>
    empezar(async () => {
      setMsg(await desactivarAvisos());
      setEstado(await leerEstadoAvisos());
    });
  const probar = () =>
    empezar(async () => {
      setMsg(null);
      setMsg(await enviarPrueba());
    });

  return (
    <div className="flex flex-col gap-3 text-sm">
      {estado === "cargando" && <p className="text-tinta-suave">Revisando este dispositivo…</p>}
      {estado === "falta_instalar" && (
        <p>En iPhone los avisos solo funcionan con la app instalada. Abre esta página en Safari, toca <strong>Compartir</strong> y luego <strong>Agregar a pantalla de inicio</strong>. Después abre la app desde ese ícono y vuelve aquí.</p>
      )}
      {estado === "no_soportado" && <p>Este navegador no permite avisos. Prueba desde el celular, con la app instalada en la pantalla de inicio.</p>}
      {estado === "bloqueado" && <p>Los avisos están bloqueados para esta app. Actívalos en los Ajustes del celular (Notificaciones → Agrícola BAS) y vuelve a esta pantalla.</p>}
      {estado === "apagado" && (
        <>
          <p className="text-tinta-suave">Recibe en este celular los avisos de aplicaciones atrasadas, plan de la semana y alertas de clima.</p>
          <div><button onClick={activar} disabled={ocupado} className="boton">{ocupado ? "Activando…" : "Activar avisos en este celular"}</button></div>
        </>
      )}
      {estado === "activo" && (
        <>
          <p className="font-medium text-verde">Avisos activados en este celular.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={probar} disabled={ocupado} className="boton-secundario">{ocupado ? "Enviando…" : "Enviarme un aviso de prueba"}</button>
            <button onClick={desactivar} disabled={ocupado} className="boton-secundario">Desactivar</button>
          </div>
        </>
      )}
      <ResultadoFormulario estado={msg} />
    </div>
  );
}
