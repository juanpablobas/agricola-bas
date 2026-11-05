"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { registrarLabor, type EstadoRegistro } from "./acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { Aviso } from "@/components/Aviso";

type Op = { id: string; texto: string };
export type Inicial = { plan?: string; cuartel?: string; labor?: string; cuadrilla?: string; fiscalizador?: string; personas?: number };

export type Edicion = { id: string; valores: Record<string, string> };

export function FormRegistro({ hoy, cuarteles, variedades = [], labores, cuadrillas, trabajadores, conMonto, inicial, editar, estadoInicial }: { hoy: string; cuarteles: Op[]; variedades?: Op[]; labores: Op[]; cuadrillas: Op[]; trabajadores: Op[]; conMonto: boolean; inicial: Inicial; editar?: Edicion; estadoInicial?: "programado" | "realizado" }) {
  const [estado, enviar] = useActionState<EstadoRegistro, FormData>(registrarLabor, null);
  // Si algo falla, el formulario vuelve con lo que se había escrito (no hay que llenarlo de nuevo)
  const v = estado?.valores ?? editar?.valores ?? {};
  const [personas, setPersonas] = useState(editar?.valores.personas ?? (inicial.personas ? String(inicial.personas) : ""));
  const [dias, setDias] = useState(editar?.valores.dias ?? "1");
  const [cual, setCual] = useState<"programado" | "realizado">(estadoInicial ?? (editar?.valores.estado as "programado" | "realizado") ?? "realizado");
  const porHacer = cual === "programado";
  const error = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!estado?.error) return;
    if (v.personas !== undefined) setPersonas(v.personas);
    if (v.dias !== undefined) setDias(v.dias);
    if (v.estado === "programado" || v.estado === "realizado") setCual(v.estado);
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
      {editar && <input type="hidden" name="id" value={editar.id} />}
      <input type="hidden" name="estado" value={cual} />
      <fieldset>
        <legend className="etiqueta-campo">¿Ya se hizo?</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["realizado", "Ya se hizo", "Trabajo terminado"], ["programado", "Por hacer", "Acordado o planificado"]] as const).map(([valor, titulo, detalle]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setCual(valor)}
              aria-pressed={cual === valor}
              className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${cual === valor ? (valor === "realizado" ? "border-verde bg-verde-claro" : "border-agua bg-agua-claro") : "border-linea bg-white"}`}
            >
              <span className={`block font-semibold ${cual === valor ? (valor === "realizado" ? "text-verde-oscuro" : "text-agua") : ""}`}>{titulo}</span>
              <span className="block text-xs text-tinta-suave">{detalle}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fecha" className="etiqueta-campo">{porHacer ? "¿Qué día se hará?" : "¿Qué día se hizo?"}</label>
          <input id="fecha" name="fecha" type="date" defaultValue={v.fecha ?? hoy} onChange={(e) => { if (e.target.value > hoy) setCual("programado"); }} className="entrada" />
        </div>
        <div>
          <label htmlFor="labor" className="etiqueta-campo">Labor</label>
          <select id="labor" name="labor" defaultValue={v.labor ?? inicial.labor ?? ""} className="entrada">
            <option value="">Elegir…</option>
            {labores.map((l) => <option key={l.id} value={l.id}>{l.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cuartel" className="etiqueta-campo">Cuartel o variedad</label>
          <select id="cuartel" name="cuartel" defaultValue={v.cuartel ?? inicial.cuartel ?? ""} className="entrada">
            <option value="">General del campo</option>
            {variedades.length > 0 && (
              <optgroup label="Variedad completa (todos sus cuarteles)">
                {variedades.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}
              </optgroup>
            )}
            <optgroup label="Un cuartel">
              {cuarteles.map((c) => <option key={c.id} value={c.id}>{c.texto}</option>)}
            </optgroup>
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
          <label htmlFor="fiscalizador" className="etiqueta-campo">{porHacer ? "Quién fiscaliza" : "Quién fiscalizó"}</label>
          <select id="fiscalizador" name="fiscalizador" defaultValue={v.fiscalizador ?? inicial.fiscalizador ?? ""} className="entrada">
            <option value="">Nadie / sin definir</option>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="personas" className="etiqueta-campo">{porHacer ? "Personas (si ya sabes)" : "Personas que trabajaron"}</label>
          <input id="personas" name="personas" value={personas} onChange={(e) => setPersonas(e.target.value)} inputMode="numeric" className="entrada" placeholder="Ej: 8" />
        </div>
        <div>
          <label htmlFor="dias" className="etiqueta-campo">{porHacer ? "Días" : "Días trabajados"}</label>
          <input id="dias" name="dias" value={dias} onChange={(e) => setDias(e.target.value)} inputMode="decimal" className="entrada" />
          <p className="mt-1 text-xs text-tinta-suave">{jornadas ? `Son ${jornadas.toLocaleString("es-CL")} jornadas (1 jornada = 1 persona por 1 día).` : "1 si es un día completo, 0,5 si es medio día."}</p>
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
            <label htmlFor="monto" className="etiqueta-campo">{porHacer ? "Monto acordado en pesos (opcional)" : "Monto pagado en pesos (opcional)"}</label>
            <input id="monto" name="monto" defaultValue={v.monto ?? ""} inputMode="numeric" className="entrada" placeholder="Ej: 480000" />
          </div>
        )}
      </div>
      <div>
        <label htmlFor="observacion" className="etiqueta-campo">{porHacer ? "Instrucciones (opcional)" : "Observación (opcional)"}</label>
        <input id="observacion" name="observacion" defaultValue={v.observacion ?? ""} className="entrada" placeholder={porHacer ? "Ej: partir por las hileras de arriba" : "Ej: faltaron dos personas por lluvia"} />
      </div>
      <div><BotonEnviar className="boton w-full sm:w-auto">{editar ? "Guardar cambios" : porHacer ? "Guardar por hacer" : "Guardar trabajo hecho"}</BotonEnviar></div>
    </form>
  );
}
