"use client";
/** Botón de borrar que pide confirmación, para no perder datos por un toque sin querer. */
export function BotonBorrar({ pregunta = "¿Seguro que quieres borrarlo? No se puede deshacer.", className = "text-sm text-alerta hover:underline", children = "Borrar" }: { pregunta?: string; className?: string; children?: React.ReactNode }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!window.confirm(pregunta)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
