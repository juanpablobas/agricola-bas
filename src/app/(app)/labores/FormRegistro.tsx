"use client";
// Formulario de una labor (nueva o editar): qué y dónde, cuándo y cuánto, quién la hace (propio o contratista) y costos.
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { guardarLabor, type EstadoLaborForm } from "./labor-acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { Aviso } from "@/components/Aviso";
import { CATEGORIAS, COBROS, MOTIVOS, PAGOS, UNIDADES, costos, type EstadoLabor } from "./modelo";
import type { Op, OpX } from "./lib";

export type Inicial = { plan?: string; cuartel?: string; labor?: string; cuadrilla?: string; fiscalizador?: string; personas?: number };
export type Edicion = { id: string; valores: Record<string, string> };

const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const num = (s: string) => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, t.includes(",") ? "" : ".").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const pesos = (s: string) => {
  const d = s.replace(/[^\d]/g, "");
  return d ? Number(d) : null;
};

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-linea pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-tinta-suave">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function Opciones<T extends string>({ valor, cambiar, opciones, nombre }: { valor: T; cambiar: (v: T) => void; opciones: readonly (readonly [T, string, string?])[]; nombre: string }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={nombre}>
      {opciones.map(([v, t, d]) => (
        <button key={v} type="button" role="radio" aria-checked={valor === v} onClick={() => cambiar(v)}
          className={`rounded-xl border-2 px-2.5 py-2 text-left transition ${valor === v ? "border-verde bg-verde-claro" : "border-linea bg-white"}`}>
          <span className={`block text-sm font-semibold ${valor === v ? "text-verde-oscuro" : ""}`}>{t}</span>
          {d && <span className="block text-[11px] leading-tight text-tinta-suave">{d}</span>}
        </button>
      ))}
    </div>
  );
}

export function FormRegistro({
  hoy, cuarteles, variedades = [], labores, cuadrillas, trabajadores, conMonto, inicial, editar, estadoInicial, confirmar = false,
}: {
  hoy: string; cuarteles: OpX[]; variedades?: OpX[]; labores: OpX[]; cuadrillas: OpX[]; trabajadores: Op[]; conMonto: boolean;
  inicial: Inicial; editar?: Edicion; estadoInicial?: EstadoLabor; confirmar?: boolean;
}) {
  const [resultado, enviar] = useActionState<EstadoLaborForm, FormData>(guardarLabor, null);
  const base = resultado?.valores ?? editar?.valores ?? {};
  const v = (k: string, def = "") => base[k] ?? def;

  const estadoActual = (editar?.valores.estado as EstadoLabor | undefined) ?? undefined;
  const [estado, setEstado] = useState<EstadoLabor>(confirmar ? "realizado" : estadoActual ?? estadoInicial ?? "programado");
  const [ejecucion, setEjecucion] = useState<"propio" | "contratista">((v("ejecucion") as "propio" | "contratista") || "propio");
  const [destino, setDestino] = useState(v("cuartel", inicial.cuartel ?? ""));
  const [laborSel, setLaborSel] = useState(v("labor", inicial.labor ?? ""));
  const [fecha, setFecha] = useState(v("fecha", hoy));
  const [unidad, setUnidad] = useState(v("unidad_cantidad", "ha"));
  const [cantPlan, setCantPlan] = useState(v("cantidad_plan"));
  const [cantEj, setCantEj] = useState(v("cantidad_ejecutada"));
  const [modo, setModo] = useState<"dias" | "horas">(v("horas") ? "horas" : "dias");
  const [personas, setPersonas] = useState(v("personas", inicial.personas ? String(inicial.personas) : ""));
  const [dias, setDias] = useState(v("dias", "1"));
  const [horas, setHoras] = useState(v("horas"));
  const [valorJornal, setValorJornal] = useState(v("valor_jornal"));
  const [valorHora, setValorHora] = useState(v("valor_hora"));
  const [cobro, setCobro] = useState(v("cobro", "ha"));
  const [precio, setPrecio] = useState(v("precio_unitario"));
  const [maq, setMaq] = useState(v("costo_maquinaria"));
  const [ins, setIns] = useState(v("costo_insumos"));
  const [estadoPago, setEstadoPago] = useState(v("estado_pago", "pendiente"));
  const [selTrab, setSelTrab] = useState<Set<string>>(new Set(v("trabajadores").split(",").filter(Boolean)));

  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (resultado?.error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [resultado]);

  const destinos = useMemo(() => new Map([...cuarteles, ...variedades].map((d) => [d.id, d])), [cuarteles, variedades]);
  const especieDestino = destinos.get(destino)?.especie ?? null;
  const haDestino = destinos.get(destino)?.ha ?? null;
  // Labores que corresponden a la especie elegida (si la labor no tiene especies configuradas, sirve para todas)
  const laboresVisibles = labores.filter((l) => !especieDestino || !l.especies?.length || l.especies.includes(especieDestino) || l.id === laborSel);
  const porCategoria = CATEGORIAS.map((c) => [c, laboresVisibles.filter((l) => (l.categoria ?? "Otras") === c)] as const).filter(([, ls]) => ls.length);

  const contratistas = cuadrillas.filter((c) => c.tipo !== "propia");
  const propias = cuadrillas.filter((c) => c.tipo === "propia");
  const hecho = estado === "realizado";
  const enCurso = estado === "en_ejecucion";
  const fechaCambio = !!editar && fecha !== editar.valores.fecha;
  const pendiente = estado === "programado" || estado === "reprogramado";

  const personasN = num(personas) ?? (selTrab.size || null);
  const jornadas = personasN ? personasN * (num(dias) ?? 1) : null;
  const c = costos({
    ejecucion, jornadas, horas: modo === "horas" ? num(horas) : null, valor_jornal: pesos(valorJornal), valor_hora: pesos(valorHora),
    cobro, precio_unitario: pesos(precio), cantidad_ejecutada: hecho || enCurso ? num(cantEj) : null, cantidad_plan: num(cantPlan),
    costo_maquinaria: pesos(maq), costo_insumos: pesos(ins),
  });

  const ponerDestino = (d: string) => {
    setDestino(d);
    const ha = destinos.get(d)?.ha;
    if (unidad === "ha" && ha && (!cantPlan || (haDestino && num(cantPlan) === haDestino))) setCantPlan(String(ha).replace(".", ","));
  };

  return (
    <form action={enviar} noValidate className="flex flex-col gap-5">
      {resultado?.error && <div ref={errorRef}><Aviso tipo="error">{resultado.error}</Aviso></div>}
      {inicial.plan && <input type="hidden" name="plan" value={inicial.plan} />}
      {editar && <input type="hidden" name="id" value={editar.id} />}
      {confirmar && <input type="hidden" name="confirmar" value="1" />}
      <input type="hidden" name="estado" value={estado} />
      <input type="hidden" name="ejecucion" value={ejecucion} />

      {!editar && (
        <Opciones nombre="Estado" valor={estado} cambiar={(x) => setEstado(x)} opciones={[
          ["programado", "Pendiente", "Por hacer"],
          ["en_ejecucion", "En ejecución", "Ya empezó"],
          ["realizado", "Realizada", "Terminada"],
        ] as const} />
      )}
      {confirmar && <Aviso tipo="info">Confirma los datos de lo que se hizo y guarda: la labor queda como realizada.</Aviso>}

      <Seccion titulo="Qué y dónde">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cuartel" className="etiqueta-campo">Cuartel o variedad</label>
            <select id="cuartel" name="cuartel" value={destino} onChange={(e) => ponerDestino(e.target.value)} className="entrada">
              <option value="">General del campo</option>
              {variedades.length > 0 && <optgroup label="Variedad completa">{variedades.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}</optgroup>}
              <optgroup label="Un cuartel">{cuarteles.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}</optgroup>
            </select>
          </div>
          <div>
            <label htmlFor="labor" className="etiqueta-campo">Labor</label>
            <select id="labor" name="labor" value={laborSel} onChange={(e) => setLaborSel(e.target.value)} className="entrada">
              <option value="">Elegir…</option>
              {porCategoria.map(([cat, ls]) => <optgroup key={cat} label={cat}>{ls.map((l) => <option key={l.id} value={l.id}>{l.texto}</option>)}</optgroup>)}
            </select>
            {especieDestino && laboresVisibles.length < labores.length && <p className="mt-1 text-xs text-tinta-suave">Se muestran las labores de esta especie.</p>}
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Cuándo y cuánto">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fecha" className="etiqueta-campo">{editar ? "Fecha programada" : hecho ? "Fecha planificada (o del trabajo)" : "Fecha planificada"}</label>
            <input id="fecha" name="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="entrada" />
            {editar && v("fecha_original") && v("fecha_original") !== fecha && <p className="mt-1 text-xs text-tinta-suave">Planificada originalmente para el {v("fecha_original").split("-").reverse().join("-")}.</p>}
          </div>
          {(hecho || enCurso) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="fecha_inicio" className="etiqueta-campo">Inicio real</label>
                <input id="fecha_inicio" name="fecha_inicio" type="date" defaultValue={v("fecha_inicio", fecha <= hoy ? fecha : hoy)} max={hoy} className="entrada px-2" />
              </div>
              {hecho && (
                <div>
                  <label htmlFor="fecha_termino" className="etiqueta-campo">Término real</label>
                  <input id="fecha_termino" name="fecha_termino" type="date" defaultValue={v("fecha_termino", fecha <= hoy ? fecha : hoy)} max={hoy} className="entrada px-2" />
                </div>
              )}
            </div>
          )}
        </div>
        {fechaCambio && pendiente && (
          <div className="grid gap-3 rounded-xl border border-[#6b3fa0]/30 bg-[#efe6f7]/50 p-3 sm:grid-cols-2">
            <p className="text-sm font-medium text-[#6b3fa0] sm:col-span-2">Cambiaste la fecha: queda como reprogramada (se guarda la fecha anterior).</p>
            <div>
              <label htmlFor="motivo_cambio" className="etiqueta-campo">Motivo</label>
              <select id="motivo_cambio" name="motivo_cambio" defaultValue="" className="entrada">
                <option value="">Elegir…</option>
                {MOTIVOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="obs_cambio" className="etiqueta-campo">Observación (opcional)</label>
              <input id="obs_cambio" name="obs_cambio" className="entrada" placeholder="Ej: se movió por la lluvia del jueves" />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="cantidad_plan" className="etiqueta-campo">Cantidad planificada</label>
            <input id="cantidad_plan" name="cantidad_plan" value={cantPlan} onChange={(e) => setCantPlan(e.target.value)} inputMode="decimal" className="entrada" placeholder={haDestino && unidad === "ha" ? String(haDestino).replace(".", ",") : "Ej: 4"} />
          </div>
          <div>
            <label htmlFor="unidad_cantidad" className="etiqueta-campo">Unidad</label>
            <select id="unidad_cantidad" name="unidad_cantidad" value={unidad} onChange={(e) => setUnidad(e.target.value)} className="entrada">
              {UNIDADES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </div>
          {(hecho || enCurso || editar) && (
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="cantidad_ejecutada" className="etiqueta-campo">Cantidad ejecutada</label>
              <input id="cantidad_ejecutada" name="cantidad_ejecutada" value={cantEj} onChange={(e) => setCantEj(e.target.value)} inputMode="decimal" className="entrada" placeholder={hecho ? cantPlan || "Igual a lo planificado" : "Lo avanzado"} />
            </div>
          )}
        </div>
        {num(cantPlan) && num(cantEj) !== null && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-papel"><div className="h-full rounded-full bg-verde" style={{ width: `${Math.min(100, ((num(cantEj) ?? 0) / (num(cantPlan) ?? 1)) * 100)}%` }} /></div>
            <p className="mt-1 text-xs text-tinta-suave">Avance: {Math.min(100, Math.round(((num(cantEj) ?? 0) / (num(cantPlan) ?? 1)) * 100))} %</p>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Quién lo hace">
        <Opciones nombre="Modalidad de ejecución" valor={ejecucion} cambiar={setEjecucion} opciones={[["propio", "Personal propio"], ["contratista", "Contratista"]] as const} />

        {ejecucion === "propio" ? (
          <>
            {trabajadores.length > 0 && (
              <div>
                <p className="etiqueta-campo">Trabajadores (opcional)</p>
                <div className="flex flex-wrap gap-2">
                  {trabajadores.map((t) => {
                    const on = selTrab.has(t.id);
                    return (
                      <label key={t.id} className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${on ? "border-verde bg-verde-claro text-verde-oscuro" : "border-linea bg-white"}`}>
                        <input type="checkbox" name="trabajadores" value={t.id} checked={on} className="sr-only"
                          onChange={(e) => { const s = new Set(selTrab); if (e.target.checked) s.add(t.id); else s.delete(t.id); setSelTrab(s); }} />
                        {t.texto}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label htmlFor="personas" className="etiqueta-campo">Personas</label>
                <input id="personas" name="personas" value={personas} onChange={(e) => setPersonas(e.target.value)} inputMode="numeric" className="entrada" placeholder={selTrab.size ? String(selTrab.size) : "Ej: 8"} />
              </div>
              <div>
                <label className="etiqueta-campo">Se mide en</label>
                <select value={modo} onChange={(e) => setModo(e.target.value as "dias" | "horas")} className="entrada" aria-label="Medir en jornadas u horas">
                  <option value="dias">Días</option>
                  <option value="horas">Horas</option>
                </select>
              </div>
              {modo === "dias" ? (
                <div>
                  <label htmlFor="dias" className="etiqueta-campo">Días</label>
                  <input id="dias" name="dias" value={dias} onChange={(e) => setDias(e.target.value)} inputMode="decimal" className="entrada" />
                </div>
              ) : (
                <div>
                  <label htmlFor="horas" className="etiqueta-campo">Horas en total</label>
                  <input id="horas" name="horas" value={horas} onChange={(e) => setHoras(e.target.value)} inputMode="decimal" className="entrada" placeholder="Ej: 64" />
                </div>
              )}
              {conMonto && (modo === "dias" ? (
                <div>
                  <label htmlFor="valor_jornal" className="etiqueta-campo">Valor jornal</label>
                  <input id="valor_jornal" name="valor_jornal" value={valorJornal} onChange={(e) => setValorJornal(e.target.value)} inputMode="numeric" className="entrada" placeholder="Ej: 30000" />
                </div>
              ) : (
                <div>
                  <label htmlFor="valor_hora" className="etiqueta-campo">Valor hora</label>
                  <input id="valor_hora" name="valor_hora" value={valorHora} onChange={(e) => setValorHora(e.target.value)} inputMode="numeric" className="entrada" placeholder="Ej: 4000" />
                </div>
              ))}
            </div>
            {jornadas && modo === "dias" && <p className="-mt-2 text-xs text-tinta-suave">Son {jornadas.toLocaleString("es-CL")} jornadas (1 jornada = 1 persona por 1 día).</p>}
            {propias.length > 0 && (
              <div className="sm:max-w-sm">
                <label htmlFor="cuadrilla" className="etiqueta-campo">Cuadrilla propia (opcional)</label>
                <select id="cuadrilla" name="cuadrilla" defaultValue={v("cuadrilla", inicial.cuadrilla ?? "")} className="entrada">
                  <option value="">Ninguna</option>
                  {propias.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}
                </select>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="contratista" className="etiqueta-campo">Contratista</label>
                <select id="contratista" name="contratista" defaultValue={v("cuadrilla", inicial.cuadrilla ?? "")} className="entrada">
                  <option value="">Elegir…</option>
                  {contratistas.map((x) => <option key={x.id} value={x.id}>{x.texto}{x.rut ? ` · ${x.rut}` : ""}</option>)}
                </select>
                <p className="mt-1 text-xs text-tinta-suave">Se agregan (con RUT) en <a href="/labores/catalogos" className="underline">Catálogo</a>.</p>
              </div>
              <div>
                <label htmlFor="personas" className="etiqueta-campo">Personas (opcional)</label>
                <input id="personas" name="personas" value={personas} onChange={(e) => setPersonas(e.target.value)} inputMode="numeric" className="entrada" placeholder="Ej: 12" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="cobro" className="etiqueta-campo">Cobra</label>
                <select id="cobro" name="cobro" value={cobro} onChange={(e) => { setCobro(e.target.value); if (["ha", "arbol", "jornada", "unidad"].includes(e.target.value)) setUnidad(e.target.value); }} className="entrada">
                  {COBROS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              </div>
              {conMonto && (
                <div className="col-span-2 sm:col-span-2">
                  <label htmlFor="precio_unitario" className="etiqueta-campo">{cobro === "fijo" ? "Precio total" : "Precio por unidad"}</label>
                  <input id="precio_unitario" name="precio_unitario" value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="numeric" className="entrada" placeholder={cobro === "fijo" ? "Ej: 900000" : "Ej: 120000"} />
                  {cobro !== "fijo" && <p className="mt-1 text-xs text-tinta-suave">Se multiplica por la cantidad {hecho || enCurso ? "ejecutada" : "planificada"}.</p>}
                </div>
              )}
            </div>
            {conMonto && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="estado_pago" className="etiqueta-campo">Pago</label>
                  <select id="estado_pago" name="estado_pago" value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)} className="entrada">
                    {PAGOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                  </select>
                </div>
                {estadoPago !== "pendiente" && (
                  <div>
                    <label htmlFor="monto_pagado" className="etiqueta-campo">Pagado</label>
                    <input id="monto_pagado" name="monto_pagado" defaultValue={v("monto_pagado")} inputMode="numeric" className="entrada" placeholder={c.externa ? String(c.externa) : ""} />
                  </div>
                )}
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="documento" className="etiqueta-campo">Factura o documento</label>
                  <input id="documento" name="documento" defaultValue={v("documento")} className="entrada" placeholder="N° factura" />
                </div>
              </div>
            )}
          </>
        )}

        <div className="sm:max-w-sm">
          <label htmlFor="fiscalizador" className="etiqueta-campo">Encargado que fiscaliza</label>
          <select id="fiscalizador" name="fiscalizador" defaultValue={v("fiscalizador", inicial.fiscalizador ?? "")} className="entrada">
            <option value="">Sin definir</option>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.texto}</option>)}
          </select>
        </div>
      </Seccion>

      {conMonto && (
        <Seccion titulo="Costos">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="costo_maquinaria" className="etiqueta-campo">Maquinaria</label>
              <input id="costo_maquinaria" name="costo_maquinaria" value={maq} onChange={(e) => setMaq(e.target.value)} inputMode="numeric" className="entrada" placeholder="$ (opcional)" />
            </div>
            <div>
              <label htmlFor="costo_insumos" className="etiqueta-campo">Insumos</label>
              <input id="costo_insumos" name="costo_insumos" value={ins} onChange={(e) => setIns(e.target.value)} inputMode="numeric" className="entrada" placeholder="$ (opcional)" />
              <p className="mt-1 text-[11px] text-tinta-suave">Si agregas insumos de bodega en la ficha, se calcula solo.</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="presupuesto" className="etiqueta-campo">Presupuesto</label>
              <input id="presupuesto" name="presupuesto" defaultValue={v("presupuesto")} inputMode="numeric" className="entrada" placeholder="Se calcula si lo dejas vacío" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-papel p-3 text-sm sm:grid-cols-5">
            <p><span className="block text-xs text-tinta-suave">M. obra propia</span>{clp(c.propia)}</p>
            <p><span className="block text-xs text-tinta-suave">M. obra externa</span>{clp(c.externa)}</p>
            <p><span className="block text-xs text-tinta-suave">Maquinaria</span>{clp(c.maquinaria)}</p>
            <p><span className="block text-xs text-tinta-suave">Insumos</span>{clp(c.insumos)}</p>
            <p className="col-span-2 font-semibold sm:col-span-1"><span className="block text-xs font-normal text-tinta-suave">Total</span>{clp(c.total)}</p>
          </div>
        </Seccion>
      )}

      <Seccion titulo="Notas">
        <div>
          <label htmlFor="observacion" className="etiqueta-campo">{hecho ? "Observaciones de la ejecución" : "Instrucciones u observaciones"}</label>
          <textarea id="observacion" name="observacion" defaultValue={v("observacion")} rows={2} className="entrada" placeholder={hecho ? "Ej: faltaron dos personas por lluvia" : "Ej: partir por las hileras de arriba"} />
        </div>
      </Seccion>

      <div className="sticky bottom-16 z-10 -mx-1 bg-white/90 px-1 py-2 backdrop-blur lg:static lg:bg-transparent lg:p-0">
        <BotonEnviar className="boton w-full sm:w-auto">{editar ? (confirmar ? "Guardar como realizada" : "Guardar cambios") : estado === "realizado" ? "Guardar labor realizada" : estado === "en_ejecucion" ? "Guardar en ejecución" : "Guardar pendiente"}</BotonEnviar>
      </div>
    </form>
  );
}
