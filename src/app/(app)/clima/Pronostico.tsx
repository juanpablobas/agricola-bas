// Pronóstico día por día, pensado para leerse en el celular sin mover la pantalla hacia el lado.
import { num } from "@/lib/formato";
import { Icono } from "@/components/Icono";
import { UMBRALES, type Dia } from "@/lib/clima";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const diaDe = (iso: string) => DIAS[new Date(iso + "T12:00:00Z").getUTCDay()];

function Fila({ d, hoy, tmin, tmax }: { d: Dia; hoy: string; tmin: number; tmax: number }) {
  const rango = Math.max(1, tmax - tmin);
  const izq = ((d.tmin - tmin) / rango) * 100;
  const ancho = Math.max(6, ((d.tmax - d.tmin) / rango) * 100);
  const helada = d.tmin <= UMBRALES.heladaMedia;
  const llueve = d.lluvia >= UMBRALES.lluvia;
  const ventoso = d.viento >= UMBRALES.vientoMedio;
  const esHoy = d.fecha === hoy;
  return (
    <li className={`grid grid-cols-[3rem_1fr_5.5rem_3rem] items-center gap-2 px-3 py-2.5 sm:grid-cols-[4.5rem_1fr_6rem_5rem] sm:gap-4 sm:px-4 ${esHoy ? "bg-verde-claro/60" : ""}`}>
      <div className="leading-tight">
        <p className={`text-sm ${esHoy ? "font-semibold text-verde-oscuro" : "font-medium"}`}>{esHoy ? "Hoy" : diaDe(d.fecha)}</p>
        <p className="text-[11px] tabular-nums text-tinta-suave">{d.fecha.slice(8, 10)}-{d.fecha.slice(5, 7)}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-6 text-right text-sm tabular-nums ${helada ? "font-semibold text-agua" : "text-tinta-suave"}`}>{Math.round(d.tmin)}°</span>
        <div className="relative h-2 flex-1 rounded-full bg-papel" aria-hidden="true">
          <div
            className="absolute inset-y-0 rounded-full"
            style={{ left: `${izq}%`, width: `${ancho}%`, background: "linear-gradient(90deg, #6aa3cf, #e7b04a 60%, #d9772b)" }}
          />
        </div>
        <span className="w-6 text-sm font-semibold tabular-nums">{Math.round(d.tmax)}°</span>
      </div>
      <div className={`flex items-center justify-end gap-1 rounded-md px-1.5 py-1 text-sm tabular-nums ${llueve ? "bg-agua-claro font-semibold text-agua" : "text-tinta-suave"}`}>
        <Icono nombre="gota" className="size-3.5 shrink-0" />
        <span className="leading-tight">
          {d.lluvia >= 0.1 ? `${num(d.lluvia, 1)}` : "0"}
          <span className="text-[11px] font-normal"> mm</span>
          {d.probLluvia != null && d.fecha >= hoy && d.probLluvia > 0 && <span className="block text-right text-[10px] font-normal">{d.probLluvia}%</span>}
        </span>
      </div>
      <div className={`flex items-center justify-end gap-1 text-sm tabular-nums ${ventoso ? "font-semibold text-ambar" : "text-tinta-suave"}`}>
        <Icono nombre="viento" className="size-3.5 shrink-0" />
        {Math.round(d.viento)}
      </div>
    </li>
  );
}

export function Pronostico({ dias, hoy }: { dias: Dia[]; hoy: string }) {
  const proximos = dias.filter((d) => d.fecha >= hoy);
  const pasados = dias.filter((d) => d.fecha < hoy);
  const tmin = Math.min(...dias.map((d) => d.tmin));
  const tmax = Math.max(...dias.map((d) => d.tmax));
  return (
    <section className="tarjeta mb-4 overflow-hidden">
      <div className="flex items-end justify-between gap-2 p-4 pb-2">
        <h2 className="font-semibold">Próximos días</h2>
        <p className="text-[11px] text-tinta-suave">Temperatura · lluvia · viento km/h</p>
      </div>
      <ul className="divide-y divide-linea border-t border-linea">
        {proximos.map((d) => <Fila key={d.fecha} d={d} hoy={hoy} tmin={tmin} tmax={tmax} />)}
      </ul>
      {pasados.length > 0 && (
        <details className="group border-t border-linea">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 px-4 text-sm text-tinta-suave">
            <Icono nombre="volver" className="size-4 -rotate-90 transition group-open:rotate-90" />
            Ver los últimos {pasados.length} días (lo que llovió)
          </summary>
          <ul className="divide-y divide-linea border-t border-linea opacity-75">
            {pasados.map((d) => <Fila key={d.fecha} d={d} hoy={hoy} tmin={tmin} tmax={tmax} />)}
          </ul>
        </details>
      )}
      <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-linea px-4 py-2.5 text-[11px] text-tinta-suave">
        <span><strong className="text-agua">Azul</strong>: helada (≤ {UMBRALES.heladaMedia} °C) o lluvia (≥ {UMBRALES.lluvia} mm)</span>
        <span><strong className="text-ambar">Ámbar</strong>: viento ≥ {UMBRALES.vientoMedio} km/h</span>
      </p>
    </section>
  );
}
