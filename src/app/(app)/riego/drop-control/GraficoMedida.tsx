"use client";
import { useState } from "react";

type Punto = { t: number; v: number };

/** Gráfico simple de las últimas 48 horas de un sensor; se carga solo al tocar el botón */
export function GraficoMedida({ id, unidad }: { id: string; unidad?: string }) {
  const [estado, setEstado] = useState<"idle" | "cargando" | "listo" | "error">("idle");
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [msg, setMsg] = useState("");

  async function cargar() {
    setEstado("cargando");
    try {
      const r = await fetch(`/api/dropcontrol/serie?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = await r.json();
      if (j.puntos?.length) { setPuntos(j.puntos); setEstado("listo"); }
      else { setMsg(`${j.error ?? "Sin datos"}${j.crudo ? ` · ${j.crudo}` : ""}`); setEstado("error"); }
    } catch {
      setMsg("No se pudo cargar. Intenta de nuevo."); setEstado("error");
    }
  }

  if (estado === "idle") return <button type="button" onClick={cargar} className="text-xs text-verde hover:underline">Ver gráfico (48 h)</button>;
  if (estado === "cargando") return <span className="text-xs text-tinta-suave">Cargando…</span>;
  if (estado === "error") return <span className="text-xs text-alerta">{msg}</span>;

  const W = 320, H = 80, P = 4;
  const ts = puntos.map((p) => p.t), vs = puntos.map((p) => p.v);
  const t0 = Math.min(...ts), t1 = Math.max(...ts, t0 + 1);
  const v0 = Math.min(...vs), v1 = Math.max(...vs, v0 + 1e-9);
  const x = (t: number) => P + ((t - t0) / (t1 - t0)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - v0) / (v1 - v0)) * (H - 2 * P);
  const linea = puntos.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const u = unidad ? ` ${unidad}` : "";
  return (
    <div className="mt-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full max-w-xs rounded bg-papel/60" role="img" aria-label="Gráfico de las últimas 48 horas">
        <polyline points={linea} fill="none" stroke="currentColor" strokeWidth="1.6" className="text-verde" />
      </svg>
      <p className="text-xs text-tinta-suave">Mín {v0.toLocaleString("es-CL", { maximumFractionDigits: 1 })}{u} · Máx {v1.toLocaleString("es-CL", { maximumFractionDigits: 1 })}{u} · Último {vs[vs.length - 1].toLocaleString("es-CL", { maximumFractionDigits: 1 })}{u}</p>
    </div>
  );
}
