"use client";
import { useFormStatus } from "react-dom";

export function BotonEnviar({
  children,
  pendiente = "Guardando…",
  className = "boton",
}: {
  children: React.ReactNode;
  pendiente?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendiente : children}
    </button>
  );
}
