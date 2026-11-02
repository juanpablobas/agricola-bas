import Link from "next/link";
import { exigirRol } from "@/lib/auth";
import { clp, pct } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";

export const metadata = { title: "Finanzas" };

type Fila = { ceco_id: string | null; ceco_codigo: string | null; ceco_nombre: string; item: string; mes: string; presupuesto: number; real: number };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const etiquetaMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

/** Semáforo del control del administrador: hasta 100 % verde, hasta 110 % ámbar, más de 110 % rojo. */
function clasePct(ppto: number, real: number) {
  if (ppto <= 0) return real > 0 ? "text-ambar" : "text-tinta-suave";
  const p = (real / ppto) * 100;
  return p <= 100 ? "text-verde" : p <= 110 ? "text-ambar" : "text-alerta";
}
const textoPct = (ppto: number, real: number) => (ppto <= 0 ? (real > 0 ? "s/p" : "—") : pct((real / ppto) * 100));

async function traerTodo(supabase: any, temporadaId: string) {
  const filas: Fila[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data } = await supabase
      .from("v_presupuesto_real")
      .select("ceco_id, ceco_codigo, ceco_nombre, item, mes, presupuesto, real")
      .eq("temporada_id", temporadaId)
      .range(desde, desde + 999);
    const lote = (data ?? []) as Fila[];
    filas.push(...lote.map((f) => ({ ...f, presupuesto: Number(f.presupuesto), real: Number(f.real) })));
    if (lote.length < 1000) break;
  }
  return filas;
}

type Grupo = { clave: string; ppto: number; real: number; pptoAnio: number };

function agrupar(filas: Fila[], hasta: string, clave: (f: Fila) => string): Grupo[] {
  const m = new Map<string, Grupo>();
  for (const f of filas) {
    const k = clave(f);
    const g = m.get(k) ?? { clave: k, ppto: 0, real: 0, pptoAnio: 0 };
    g.pptoAnio += f.presupuesto;
    if (f.mes <= hasta) {
      g.ppto += f.presupuesto;
      g.real += f.real;
    }
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.pptoAnio - a.pptoAnio);
}

function TablaGrupos({ titulo, grupos, primera }: { titulo: string; grupos: Grupo[]; primera: string }) {
  const t = grupos.reduce((s, g) => ({ ppto: s.ppto + g.ppto, real: s.real + g.real, pptoAnio: s.pptoAnio + g.pptoAnio }), { ppto: 0, real: 0, pptoAnio: 0 });
  return (
    <section className="tarjeta overflow-x-auto">
      <h2 className="p-5 pb-3 font-semibold">{titulo}</h2>
      <table className="tabla">
        <thead>
          <tr>
            <th>{primera}</th>
            <th className="text-right">Ppto acumulado</th>
            <th className="text-right">Real</th>
            <th className="text-right">Diferencia</th>
            <th className="text-right">% ejec.</th>
            <th className="text-right">Ppto año</th>
            <th className="text-right">% del año</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <tr key={g.clave}>
              <td className="font-medium">{g.clave}</td>
              <td className="text-right">{clp(g.ppto)}</td>
              <td className="text-right">{clp(g.real)}</td>
              <td className={`text-right ${g.ppto - g.real < 0 ? "text-alerta" : ""}`}>{clp(g.ppto - g.real)}</td>
              <td className={`text-right font-medium ${clasePct(g.ppto, g.real)}`}>{textoPct(g.ppto, g.real)}</td>
              <td className="text-right text-tinta-suave">{clp(g.pptoAnio)}</td>
              <td className="text-right text-tinta-suave">{g.pptoAnio > 0 ? pct((g.real / g.pptoAnio) * 100) : "—"}</td>
            </tr>
          ))}
          <tr className="bg-papel/60 font-semibold">
            <td>Total</td>
            <td className="text-right">{clp(t.ppto)}</td>
            <td className="text-right">{clp(t.real)}</td>
            <td className={`text-right ${t.ppto - t.real < 0 ? "text-alerta" : ""}`}>{clp(t.ppto - t.real)}</td>
            <td className={`text-right ${clasePct(t.ppto, t.real)}`}>{textoPct(t.ppto, t.real)}</td>
            <td className="text-right">{clp(t.pptoAnio)}</td>
            <td className="text-right">{t.pptoAnio > 0 ? pct((t.real / t.pptoAnio) * 100) : "—"}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

export default async function Finanzas() {
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "propietario");
  const puedeCargar = perfil.rol === "administrador" || perfil.rol === "enc_administrativo";

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: temporadas } = await supabase.from("temporada").select("id, nombre, inicio, termino").order("inicio", { ascending: false });
  const temporada = (temporadas ?? []).find((t) => t.inicio <= hoy && t.termino >= hoy) ?? (temporadas ?? [])[0];

  const botones = (
    <>
      <Link href="/finanzas/gastos" className="boton-secundario"><Icono nombre="archivo" className="size-4" />Ver gastos</Link>
      {puedeCargar && <Link href="/finanzas/cargar" className="boton"><Icono nombre="subir" className="size-4" />Cargar archivo</Link>}
    </>
  );

  if (!temporada) {
    return (<><Encabezado titulo="Finanzas" /><Aviso>No hay temporada creada. Créala en Campo.</Aviso></>);
  }

  const filas = await traerTodo(supabase, temporada.id);
  const conReal = filas.filter((f) => f.real > 0).map((f) => f.mes).sort();

  if (filas.length === 0 || conReal.length === 0) {
    return (
      <>
        <Encabezado titulo="Finanzas" subtitulo={`Temporada ${temporada.nombre}`} acciones={botones} />
        <Aviso>
          Todavía no hay datos de esta temporada. {puedeCargar ? "Sube el Excel del administrador en “Cargar archivo”." : "Pide al administrador que cargue el archivo."}
        </Aviso>
      </>
    );
  }

  const hasta = conReal[conReal.length - 1];
  const porItem = agrupar(filas, hasta, (f) => f.item);
  const porCeco = agrupar(filas, hasta, (f) => f.ceco_nombre);
  const pptoAnio = filas.reduce((s, f) => s + f.presupuesto, 0);
  const pptoAcum = filas.filter((f) => f.mes <= hasta).reduce((s, f) => s + f.presupuesto, 0);
  const real = filas.reduce((s, f) => s + f.real, 0);
  const sinAsignar = filas.filter((f) => f.ceco_id === null).reduce((s, f) => s + f.real, 0);

  const porMes = new Map<string, { ppto: number; real: number }>();
  for (const f of filas) {
    const m = porMes.get(f.mes) ?? { ppto: 0, real: 0 };
    m.ppto += f.presupuesto;
    m.real += f.real;
    porMes.set(f.mes, m);
  }
  const meses = [...porMes].sort(([a], [b]) => a.localeCompare(b));
  const maxMes = Math.max(...meses.map(([, m]) => Math.max(m.ppto, m.real)), 1);

  const Indicador = ({ titulo, valor, detalle, clase = "" }: { titulo: string; valor: string; detalle?: string; clase?: string }) => (
    <div className="tarjeta p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-tinta-suave">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${clase}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-tinta-suave">{detalle}</p>}
    </div>
  );

  return (
    <>
      <Encabezado
        titulo="Finanzas"
        subtitulo={`Temporada ${temporada.nombre} · presupuesto contra gasto real, con IVA · acumulado hasta ${etiquetaMes(hasta)}`}
        acciones={botones}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador titulo="Presupuesto de la temporada" valor={clp(pptoAnio)} />
        <Indicador titulo={`Presupuesto hasta ${etiquetaMes(hasta)}`} valor={clp(pptoAcum)} />
        <Indicador titulo="Gasto real" valor={clp(real)} detalle={`${pct((real / pptoAnio) * 100)} del presupuesto del año`} />
        <Indicador
          titulo="Ejecución del acumulado"
          valor={textoPct(pptoAcum, real)}
          clase={clasePct(pptoAcum, real)}
          detalle={`${pptoAcum - real >= 0 ? "Bajo" : "Sobre"} el presupuesto por ${clp(Math.abs(pptoAcum - real))}`}
        />
      </section>

      {sinAsignar > 0 && (
        <div className="mt-4">
          <Aviso>Hay {clp(sinAsignar)} de gasto sin centro de costo asignado (por ejemplo “Distribuir” o “Desuso” en el Excel). Se muestra como “Sin asignar”.</Aviso>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-5">
        <TablaGrupos titulo="Por ítem" grupos={porItem} primera="Ítem" />
        <TablaGrupos titulo="Por centro de costo (variedad)" grupos={porCeco} primera="Centro de costo" />

        <section className="tarjeta p-5">
          <h2 className="mb-3 font-semibold">Mes a mes</h2>
          <div className="flex flex-col gap-2.5">
            {meses.map(([m, v]) => (
              <div key={m} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="text-tinta-suave">{etiquetaMes(m)}</span>
                <div className="flex flex-col gap-1">
                  <div className="h-2 rounded-full bg-linea/60" title={`Presupuesto ${clp(v.ppto)}`}>
                    <div className="h-2 rounded-full bg-tinta-suave/40" style={{ width: `${(v.ppto / maxMes) * 100}%` }} />
                  </div>
                  <div className="h-2 rounded-full bg-linea/60" title={`Real ${clp(v.real)}`}>
                    <div className={`h-2 rounded-full ${v.real > v.ppto * 1.1 ? "bg-alerta" : v.real > v.ppto ? "bg-ambar" : "bg-verde"}`} style={{ width: `${(v.real / maxMes) * 100}%` }} />
                  </div>
                </div>
                <span className="w-40 text-right text-xs text-tinta-suave">
                  {clp(v.real)} de {clp(v.ppto)}
                  {v.real > 0 && <span className={`ml-1 font-medium ${clasePct(v.ppto, v.real)}`}>({textoPct(v.ppto, v.real)})</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-tinta-suave">Barra gris: presupuesto. Barra de color: gasto real (verde hasta 100 %, ámbar hasta 110 %, rojo sobre 110 %).</p>
        </section>
      </div>
      <p className="mt-4 text-xs text-tinta-suave">Las cifras vienen del archivo del administrador externo, tal como se cargaron.</p>
    </>
  );
}
