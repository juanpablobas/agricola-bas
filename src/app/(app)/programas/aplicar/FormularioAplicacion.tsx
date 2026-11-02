"use client";
import { useActionState, useState } from "react";
import { registrarAplicacion } from "../acciones";
import { BotonEnviar } from "@/components/BotonEnviar";
import { ResultadoFormulario } from "@/components/Aviso";

export type LineaForm = {
  id: string;
  producto: string;
  unidad: string;
  conc: number | null;
  escala: boolean; // true: la cantidad crece con los litros; false: dosis fija por ha
  fijaHa: number; // cantidad por ha con repeticiones (cuando no escala)
  rep: number;
  principal: boolean;
  caracter: string | null;
  vinculado: boolean;
  stock: number | null;
  stockUnidad: string | null;
  alternativas: string | null;
};

const redondea = (x: number) => Math.round(x * 100) / 100;
const fmt = (x: number, d = 2) => x.toLocaleString("es-CL", { maximumFractionDigits: d });

export function FormularioAplicacion({
  variedad, progApp, titulo, hoy, litrosInicial, haInicial, lineas,
}: {
  variedad: string; progApp: string; titulo: string; hoy: string; litrosInicial: number; haInicial: number; lineas: LineaForm[];
}) {
  const [estado, enviar] = useActionState(registrarAplicacion, null);
  const [litros, setLitros] = useState(String(litrosInicial));
  const [ha, setHa] = useState(String(haInicial).replace(".", ","));
  const [manual, setManual] = useState<Record<string, string>>({});
  const [marcas, setMarcas] = useState<Record<string, boolean>>(() => Object.fromEntries(lineas.map((l) => [l.id, l.principal])));

  const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  const L = num(litros);
  const H = num(ha);
  const calculada = (l: LineaForm) => redondea((l.escala && l.conc !== null ? ((l.conc * L) / 100) * l.rep : l.fijaHa) * H);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="variedad" value={variedad} />
      <input type="hidden" name="prog_app" value={progApp} />
      <input type="hidden" name="titulo" value={titulo} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="fecha" className="etiqueta-campo">Fecha</label>
          <input id="fecha" name="fecha" type="date" defaultValue={hoy} max={hoy} required className="entrada" />
        </div>
        <div>
          <label htmlFor="litros" className="etiqueta-campo">Litros por hectárea</label>
          <input id="litros" name="litros" value={litros} onChange={(e) => setLitros(e.target.value)} inputMode="numeric" required className="entrada" />
        </div>
        <div>
          <label htmlFor="ha" className="etiqueta-campo">Hectáreas aplicadas</label>
          <input id="ha" name="ha" value={ha} onChange={(e) => setHa(e.target.value)} inputMode="decimal" required className="entrada" />
        </div>
      </div>
      <p className="-mt-2 text-xs text-tinta-suave">Si aplicaste solo una parte de la variedad, cambia las hectáreas: las cantidades se recalculan. También puedes corregir cada cantidad a mano.</p>

      <div className="overflow-x-auto rounded-xl border border-linea">
        <table className="tabla">
          <thead><tr><th className="w-10">Usé</th><th>Producto</th><th className="text-right">Cantidad</th><th>En bodega</th></tr></thead>
          <tbody>
            {lineas.map((l) => {
              const valor = manual[l.id] ?? String(calculada(l)).replace(".", ",");
              const q = num(valor);
              const falta = l.stock !== null && q > l.stock + 0.0005;
              return (
                <tr key={l.id} className={l.principal ? "" : "text-tinta-suave"}>
                  <td>
                    <input type="hidden" name="linea" value={l.id} />
                    <input type="checkbox" name={`usar_${l.id}`} checked={!!marcas[l.id]} onChange={(e) => setMarcas({ ...marcas, [l.id]: e.target.checked })} className="size-5 accent-verde" aria-label={`Usé ${l.producto}`} />
                  </td>
                  <td className="min-w-44">
                    <span className={l.principal ? "font-medium" : ""}>{l.producto}</span>
                    {!l.principal && <span className="pastilla ml-1.5 bg-linea/60">alternativa</span>}
                    {l.caracter === "Variable" && <span className="pastilla ml-1.5 bg-ambar-claro text-ambar">variable</span>}
                    {!l.vinculado && <span className="block text-xs text-alerta">Sin unir a la bodega: no descuenta stock</span>}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <input name={`cant_${l.id}`} value={valor} onChange={(e) => setManual({ ...manual, [l.id]: e.target.value })} inputMode="decimal" className="entrada w-24 text-right" aria-label={`Cantidad de ${l.producto}`} /> <span className="text-sm">{l.unidad}</span>
                  </td>
                  <td className="whitespace-nowrap text-sm">
                    {l.stock === null ? "—" : <span className={falta ? "font-semibold text-alerta" : ""}>{fmt(l.stock, 1)} {l.stockUnidad ?? ""}{falta ? " · no alcanza" : ""}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <label htmlFor="obs" className="etiqueta-campo">Observación (opcional)</label>
        <input id="obs" name="obs" className="entrada" placeholder="Ej: se aplicó con viento suave, equipo 2" />
      </div>
      <ResultadoFormulario estado={estado} />
      <div><BotonEnviar>Registrar aplicación y descontar de bodega</BotonEnviar></div>
    </form>
  );
}
