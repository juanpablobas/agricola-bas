"use client";
import { useState } from "react";

/** Rellena latitud y longitud con la ubicación del celular (conviene tocarlo estando en el campo) */
export function BotonUbicacion() {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="boton-secundario"
        onClick={() => {
          setMsg("Buscando ubicación…");
          navigator.geolocation?.getCurrentPosition(
            (p) => {
              (document.getElementById("lat") as HTMLInputElement).value = p.coords.latitude.toFixed(5);
              (document.getElementById("lng") as HTMLInputElement).value = p.coords.longitude.toFixed(5);
              setMsg("Listo: revisa los números y toca Guardar.");
            },
            () => setMsg("No se pudo leer la ubicación. Puedes escribirla a mano."),
            { enableHighAccuracy: true, timeout: 15000 },
          );
        }}
      >
        Usar la ubicación de este celular
      </button>
      {msg && <p className="mt-1 text-xs text-tinta-suave">{msg}</p>}
    </div>
  );
}
