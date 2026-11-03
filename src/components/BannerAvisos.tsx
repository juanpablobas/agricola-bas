"use client";
import { useEffect, useState } from "react";
import { Aviso } from "./Aviso";
import { activarAvisos, leerEstadoAvisos, type EstadoAvisos } from "./avisos-cliente";

const CLAVE_LOCAL = "avisos-banner-oculto-hasta";

/** Pide activar los avisos del celular a quien todavía no los tiene (no se puede hacer sin un toque del usuario). */
export function BannerAvisos({ clave }: { clave: string | null }) {
  const [estado, setEstado] = useState<EstadoAvisos | "cargando" | "listo">("cargando");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const hasta = Number(localStorage.getItem(CLAVE_LOCAL) ?? 0);
        const e = await leerEstadoAvisos();
        // Si el permiso ya estaba dado pero este celular no quedó registrado, se registra solo
        if (e === "apagado" && "Notification" in window && Notification.permission === "granted" && clave) {
          const r = await activarAvisos(clave);
          return setEstado(r.ok ? "listo" : "apagado");
        }
        setEstado(Date.now() < hasta ? "listo" : e);
      } catch {
        setEstado("listo");
      }
    })();
  }, [clave]);

  const posponer = () => {
    try { localStorage.setItem(CLAVE_LOCAL, String(Date.now() + 3 * 24 * 3600 * 1000)); } catch { /* sin almacenamiento */ }
    setEstado("listo");
  };

  if (estado !== "apagado" && estado !== "falta_instalar") return null;
  return (
    <div className="mb-4">
      <Aviso tipo="info">
        {estado === "apagado" ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>Activa los avisos en este celular para enterarte de aplicaciones atrasadas, el plan de la semana y alertas de clima.</span>
            <button
              className="boton min-h-9 px-3 py-1.5"
              disabled={ocupado}
              onClick={async () => {
                setOcupado(true);
                const r = await activarAvisos(clave);
                setOcupado(false);
                if (r.ok) setEstado("listo");
                else setError(r.error ?? "No se pudo activar.");
              }}
            >
              {ocupado ? "Activando…" : "Activar avisos"}
            </button>
            <button className="text-sm underline" onClick={posponer}>Ahora no</button>
            {error && <span className="w-full text-alerta">{error}</span>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>Para recibir avisos en el iPhone, instala la app: en Safari toca <strong>Compartir</strong> y <strong>Agregar a pantalla de inicio</strong>, y ábrela desde ese ícono.</span>
            <button className="text-sm underline" onClick={posponer}>Ahora no</button>
          </div>
        )}
      </Aviso>
    </div>
  );
}
