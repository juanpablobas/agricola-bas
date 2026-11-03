"use client";
import { useState } from "react";
import { Icono } from "./Icono";

/** Copia un texto al portapapeles (para pegarlo en un correo o mensaje) */
export function BotonCopiar({ texto, etiqueta = "Copiar" }: { texto: string; etiqueta?: string }) {
  const [listo, setListo] = useState(false);
  return (
    <button
      type="button"
      className="boton-secundario"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setListo(true);
          setTimeout(() => setListo(false), 2000);
        } catch {
          /* el navegador no dejó copiar */
        }
      }}
    >
      <Icono nombre={listo ? "ok" : "archivo"} className="size-4" />
      {listo ? "Copiado" : etiqueta}
    </button>
  );
}
