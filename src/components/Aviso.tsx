import { Icono } from "./Icono";

export function Aviso({ tipo = "info", children }: { tipo?: "info" | "error" | "ok"; children: React.ReactNode }) {
  const estilos = {
    info: "border-linea bg-ambar-claro/60 text-tinta",
    error: "border-alerta/30 bg-alerta-claro text-alerta",
    ok: "border-verde/25 bg-verde-claro text-verde-oscuro",
  }[tipo];
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${estilos}`} role={tipo === "error" ? "alert" : "status"}>
      <Icono nombre={tipo === "error" ? "alerta" : tipo === "ok" ? "ok" : "alerta"} className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/** Mensaje de resultado de una acción de formulario */
export type EstadoFormulario = { error?: string; ok?: string } | null;

export function ResultadoFormulario({ estado }: { estado: EstadoFormulario }) {
  if (!estado) return null;
  if (estado.error) return <Aviso tipo="error">{estado.error}</Aviso>;
  if (estado.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return null;
}
