"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { registrarLabor, type EstadoRegistro } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { Aviso } from "@/components/Aviso";

type Op = { id: string; texto: string };
export type Inicial = { plan?: string; cuartel?: string; labor?: string; cuadrilla?: string; fiscalizador?: string; personas?: number };

export function FormRegistro({ hoy, cuarteles, labores, cuadrillas, trabajadores, conMonto, inicial }: { hoy: string; cuarteles: Op[]; labores: Op[]; cuadrillas: Op[]; trabajadores: Op[]; conMonto: boolean; inicial: Inicial }) {
  const [estado, enviar] = useActionState<EstadoRegistro, FormData>(registrarLabor, null);
  // Si algo falla, el formulario vuelve con lo que se había escrito (no hay que llenarlo de nuevo)
  const v = estado?.valores ?? {};
  const [personas, setPersonas] = useState(inicial.personas ? String(inicial.personas) : "");
  const [dias, setDias] = useState("1");
  const error = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!estado?.error) return;
    if (v.personas !== undefined) setPersonas(v.personas);
    if (v.dias !== undefined) setDias(v.dias);
    error.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
  const p = Number(personas.replace(",", "."));
  const d = Number(dias.replace(",", "."));
  const jornadas = Number.isFinite(p * d) && p > 0 && d > 0 ? Math.round(p * d * 100) / 100 : null;

  return (
    <form action={enviar} noValidate className="flex flex-col gap-4">
      {estado?.error && <div ref={error}><Aviso tipo="error">{estado.error}</Aviso></div>}
      {inicial.plan && <input type="hidden" name="plan" value={inicial.plan} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fecha" className="etiqueta-campo">Fecha</label>
          <input id="fecha" name="fecha" type="date" defaultValue={v.fecha ?? hoy} max={hoy} className="entrada" />
        </div>
        <div>
          <label htmlFor="labor" className="etiqueta-campo">Labor</label>
          <select id="labor" name="labor" defaultValue={v.labor ?? inicial.labor ?? ""} className="entrada">
            <option value="">Elegir…</option>
            {labores.map((l) => <option key={l.id} value={l.id}>{l.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cuartel" className="etiqueta-campo">Cuartel</label>
          <select id="cuartel" name="cuartel" defaultValue={v.cuartel ?? inicial.cuartel ?? ""} className="entrada">
            <option value="">General del campo</option>
            {cuarteles.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cuadrilla" className="etiqueta-campo">Cuadrilla (el gato)</label>
          <select id="cuadrilla" name="cuadrilla" defaultValue={v.cuadrilla ?? inicial.cuadrilla ?? ""} className="entrada">
            <option value="">Personal propio / sin cuadrilla</option>
            {cuadrillas.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="fiscalizador" className="etiqueta-campo">Quién fiscalizó</label>
          <select id="fiscalizador" name="fiscalizador" defaultValue={v.fiscalizador ?? inicial.fiscalizador ?? ""} className="entrada">
            <option value="">Nadie / sin definir</option>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="personas" className="etiqueta-campo">Personas que trabajaron</label>
          <input id="personas" name="personas" value={personas} onChange={(e) => setPersonas(e.target.value)} inputMode="numeric" className="entrada" placeholder="Ej: 8" />
        </div>
        <div>
          <label htmlFor="dias" className="etiqueta-campo">Días trabajados</label>
          <input id="dias" name="dias" value={dias} onChange={(e) => setDias(e.target.value)} inputMode="decimal" className="entrada" />
          <p className="mt-1 text-xs text-tinta-suave">{jornadas ? `Son ${jornadas.toLocaleString("es-CL")} jornadas (1 jornada = 1 persona por 1 día).` : "1 si fue un día completo, 0,5 si fue medio día."}</p>
        </div>
        <div>
          <label htmlFor="modalidad" className="etiqueta-campo">Cómo se paga</label>
          <select id="modalidad" name="modalidad" defaultValue={v.modalidad ?? "dia"} className="entrada">
            <option value="dia">Por día</option>
            <option value="trato">Por trato</option>
          </select>
        </div>
        {conMonto && (
          <div>
            <label htmlFor="monto" className="etiqueta-campo">Monto pagado en pesos (opcional)</label>
            <input id="monto" name="monto" defaultValue={v.monto ?? ""} inputMode="numeric" className="entrada" placeholder="Ej: 480000" />
          </div>
        )}
      </div>
      <div>
        <label htmlFor="observacion" className="etiqueta-campo">Observación (opcional)</label>
        <input id="observacion" name="observacion" defaultValue={v.observacion ?? ""} className="entrada" placeholder="Ej: faltaron dos personas por lluvia" />
      </div>
      <div><BotonEnviar className="boton w-full sm:w-auto">Guardar registro</BotonEnviar></div>
    </form>
  );
}
