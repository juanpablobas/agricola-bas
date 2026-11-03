"use client";
import { useEffect, useState, useTransition } from "react";
import { guardarSuscripcion, quitarSuscripcion, enviarPrueba } from "./acciones";
import { ResultadoFormulario, type EstadoFormulario } from "@/components/Aviso";

function aBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function Notificaciones({ clave }: { clave: string | null }) {
  const [estado, setEstado] = useState<"cargando" | "no_soportado" | "falta_instalar" | "bloqueado" | "apagado" | "activo">("cargando");
  const [msg, setMsg] = useState<EstadoFormulario>(null);
  const [ocupado, empezar] = useTransition();

  useEffect(() => {
    (async () => {
      const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const esIphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      if (!soporta) return setEstado(esIphone && !instalada ? "falta_instalar" : "no_soportado");
      if (Notification.permission === "denied") return setEstado("bloqueado");
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        setEstado(sub && Notification.permission === "granted" ? "activo" : "apagado");
      } catch {
        setEstado("apagado");
      }
    })();
  }, []);

  const activar = () =>
    empezar(async () => {
      setMsg(null);
      try {
        if (!clave) return setMsg({ error: "Los avisos todavía no están configurados en el servidor." });
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
          setEstado(permiso === "denied" ? "bloqueado" : "apagado");
          return setMsg({ error: "No diste permiso para los avisos." });
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) });
        const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const r = await guardarSuscripcion({ endpoint: j.endpoint, keys: j.keys }, navigator.userAgent);
        setMsg(r);
        if (r?.ok) setEstado("activo");
      } catch {
        setMsg({ error: "No se pudo activar. Cierra la app, ábrela de nuevo desde el ícono e intenta otra vez." });
      }
    });

  const desactivar = () =>
    empezar(async () => {
      setMsg(null);
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await quitarSuscripcion(sub.endpoint);
          await sub.unsubscribe();
        }
        setEstado("apagado");
        setMsg({ ok: "Avisos desactivados en este celular." });
      } catch {
        setMsg({ error: "No se pudo desactivar." });
      }
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
          <p className="text-tinta-suave">Recibe en este celular los avisos de aplicaciones atrasadas y del plan de la semana.</p>
          <div><button onClick={activar} disabled={ocupado} className="boton">{ocupado ? "Activando…" : "Activar avisos en este celular"}</button></div>
        </>
      )}
      {estado === "activo" && (
        <>
          <p className="font-medium text-verde">Avisos activados en este celular.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={probar} disabled={ocupado} className="boton-secundario">Enviarme un aviso de prueba</button>
            <button onClick={desactivar} disabled={ocupado} className="boton-secundario">Desactivar</button>
          </div>
        </>
      )}
      <ResultadoFormulario estado={msg} />
    </div>
  );
}
