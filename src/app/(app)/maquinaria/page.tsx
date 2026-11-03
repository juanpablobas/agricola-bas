import Link from "next/link";
import { exigirRol, puede } from "@/lib/auth";
import { clp, fecha, num } from "@/lib/formato";
import { hoyChile } from "@/lib/semana";
import { leerTodo } from "@/lib/programas";
import { colorEspecie } from "@/lib/etiquetas";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";

export const metadata = { title: "Maquinaria y petróleo" };

type Mov = {
  id: string; fecha: string; tipo: "entrada" | "salida" | "saldo"; maquina_id: string | null; operario: string | null; cuartel_codigo: string | null;
  especie: string | null; labor: string | null; sublabor: string | null; litros: number; precio_lt: number | null; horometro: number | null; km: number | null;
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const bonito = (s: string | null) => (s ?? "Sin indicar").replace(/_/g, " ");
/** Nombres de especie de la planilla → nombre del catálogo (para el color) */
const especieCatalogo = (s: string) => (/nogal/i.test(s) ? "Nogal" : /cerez/i.test(s) ? "Cerezo" : /ciruel/i.test(s) ? "Ciruelo" : /nectar/i.test(s) ? "Nectarín" : /durazn/i.test(s) ? "Durazno" : s);

function Barras({ filas, total, color }: { filas: { nombre: string; litros: number; detalle?: string; color?: string }[]; total: number; color?: string }) {
  const max = Math.max(...filas.map((f) => f.litros), 1);
  return (
    <ul className="flex flex-col gap-3">
      {filas.map((f) => (
        <li key={f.nombre}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-medium">{f.nombre}</span>
            <span className="shrink-0 tabular-nums text-tinta-suave">{num(f.litros)} L · {num((f.litros / (total || 1)) * 100)} %</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-papel">
            <div className="h-full rounded-full" style={{ width: `${(f.litros / max) * 100}%`, background: f.color ?? color ?? "var(--color-verde)" }} />
          </div>
          {f.detalle && <p className="mt-0.5 text-xs text-tinta-suave">{f.detalle}</p>}
        </li>
      ))}
    </ul>
  );
}

export default async function Maquinaria() {
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const carga = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");
  const hoy = hoyChile();
  const { data: temporada } = await supabase.from("temporada").select("nombre, inicio, termino").lte("inicio", hoy).gte("termino", hoy).maybeSingle();

  const [movs, { data: maquinas }, { data: ultimaCarga }] = await Promise.all([
    leerTodo<Mov>((d, h) => {
      let q = supabase.from("mov_petroleo").select("id, fecha, tipo, maquina_id, operario, cuartel_codigo, especie, labor, sublabor, litros, precio_lt, horometro, km");
      if (temporada) q = q.gte("fecha", temporada.inicio).lte("fecha", temporada.termino);
      return q.order("fecha").order("creado_en").range(d, h);
    }),
    supabase.from("maquina").select("id, nombre, tipo, marca, propia, activo").order("nombre"),
    supabase.from("carga_petroleo").select("archivo, hasta, creado_en").eq("estado", "vigente").order("creado_en", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const botones = carga ? <Link href="/maquinaria/cargar" className="boton"><Icono nombre="subir" className="size-4" />Cargar planilla</Link> : undefined;
  if (movs.length === 0) {
    return (
      <>
        <Encabezado titulo="Maquinaria y petróleo" subtitulo="Consumo de petróleo por máquina, labor y cuartel." acciones={botones} />
        <Aviso>Todavía no hay datos de petróleo. {carga ? "Sube el Excel “Control Petróleo” del administrador con “Cargar planilla”." : "Pide que suban la planilla del control de petróleo."}</Aviso>
      </>
    );
  }

  const n = (v: unknown) => Number(v ?? 0);
  const entradas = movs.filter((m) => m.tipo === "entrada");
  const salidas = movs.filter((m) => m.tipo === "salida");
  const saldos = movs.filter((m) => m.tipo === "saldo");

  // Precio de cada salida: el de la última carga al estanque antes de esa fecha
  const precioEn = (f: string) => {
    let p: number | null = null;
    for (const e of entradas) if (e.fecha <= f && e.precio_lt) p = n(e.precio_lt);
    return p ?? (entradas.find((e) => e.precio_lt) ? n(entradas.find((e) => e.precio_lt)!.precio_lt) : null);
  };
  const conCosto = salidas.map((s) => ({ ...s, litros: n(s.litros), precio: precioEn(s.fecha) })).map((s) => ({ ...s, costo: s.precio !== null ? s.litros * s.precio : 0 }));
  const litrosTotal = conCosto.reduce((s, m) => s + m.litros, 0);
  const costoTotal = conCosto.reduce((s, m) => s + m.costo, 0);

  // Saldo del estanque: último saldo informado + cargas − salidas desde esa fecha
  const ultSaldo = saldos.at(-1);
  const desde = ultSaldo?.fecha ?? "0000";
  const saldoActual = (ultSaldo ? n(ultSaldo.litros) : 0) + entradas.filter((e) => e.fecha >= desde).reduce((s, e) => s + n(e.litros), 0) - salidas.filter((x) => x.fecha >= desde).reduce((s, x) => s + n(x.litros), 0);
  const ultimaEntrada = entradas.at(-1);

  // Por mes
  const porMes = new Map<string, { litros: number; costo: number }>();
  for (const s of conCosto) {
    const k = s.fecha.slice(0, 7);
    const g = porMes.get(k) ?? { litros: 0, costo: 0 };
    g.litros += s.litros;
    g.costo += s.costo;
    porMes.set(k, g);
  }
  const meses = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b));
  const mesActual = hoy.slice(0, 7);
  const esteMes = porMes.get(mesActual);
  const mesesCompletos = meses.filter(([k]) => k < mesActual);
  const promedioMes = mesesCompletos.length ? mesesCompletos.reduce((s, [, g]) => s + g.litros, 0) / mesesCompletos.length : null;

  // Por máquina (horómetro y km para rendimiento)
  const nombreMaq = new Map<string, any>(((maquinas ?? []) as any[]).map((m) => [m.id as string, m] as [string, any]));
  const porMaq = new Map<string, { litros: number; costo: number; horas: number[]; km: number[]; ultima: string; usos: number }>();
  for (const s of conCosto) {
    const k = s.maquina_id ?? "—";
    const g = porMaq.get(k) ?? { litros: 0, costo: 0, horas: [], km: [], ultima: "", usos: 0 };
    g.litros += s.litros;
    g.costo += s.costo;
    g.usos++;
    if (s.horometro) g.horas.push(n(s.horometro));
    if (s.km) g.km.push(n(s.km));
    if (s.fecha > g.ultima) g.ultima = s.fecha;
    porMaq.set(k, g);
  }
  const filasMaq = [...porMaq.entries()]
    .map(([id, g]) => {
      const m = nombreMaq.get(id);
      const horas = g.horas.length > 1 ? Math.max(...g.horas) - Math.min(...g.horas) : null;
      const km = g.km.length > 1 ? Math.max(...g.km) - Math.min(...g.km) : null;
      return { id, nombre: m?.nombre ?? "Sin máquina", tipo: m?.tipo ?? "otro", propia: m?.propia ?? true, marca: m?.marca ?? null, ...g, horasTrab: horas, horometro: g.horas.length ? Math.max(...g.horas) : null, kmRec: km, kmActual: g.km.length ? Math.max(...g.km) : null };
    })
    .sort((a, b) => b.litros - a.litros);

  const agrupar = (clave: (m: (typeof conCosto)[number]) => string) => {
    const r = new Map<string, number>();
    for (const s of conCosto) r.set(clave(s), (r.get(clave(s)) ?? 0) + s.litros);
    return [...r.entries()].map(([nombre, litros]) => ({ nombre, litros })).sort((a, b) => b.litros - a.litros);
  };
  const porLabor = agrupar((s) => bonito(s.labor));
  const porEspecie = agrupar((s) => (s.especie && s.especie !== "-" ? s.especie : "Sin indicar")).map((f) => ({ ...f, color: colorEspecie(especieCatalogo(f.nombre)) }));
  const porOperario = agrupar((s) => s.operario ?? "Sin indicar").slice(0, 8);

  // Gráfico de litros por mes
  const W = 360, H = 150, base = H - 20, alto = base - 18;
  const maxMes = Math.max(...meses.map(([, g]) => g.litros), 1);
  const paso = W / Math.max(meses.length, 1);
  const ancho = Math.min(28, paso * 0.55);
  const iMax = meses.reduce((im, [, g], i, a) => (g.litros > a[im][1].litros ? i : im), 0);

  return (
    <>
      <Encabezado
        titulo="Maquinaria y petróleo"
        subtitulo={`Consumo de petróleo ${temporada ? `de la temporada ${temporada.nombre}` : ""}${ultimaCarga ? ` · datos hasta el ${fecha(ultimaCarga.hasta)}` : ""}.`}
        acciones={botones}
      />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="tarjeta p-4">
          <p className="text-xs text-tinta-suave">Petróleo usado</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{num(litrosTotal)} L</p>
          <p className="text-xs text-tinta-suave">{salidas.length} cargas a máquinas</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs text-tinta-suave">Costo aprox.</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">${num(costoTotal / 1_000_000, 1)} M</p>
          <p className="text-xs text-tinta-suave">{litrosTotal > 0 ? `${clp(Math.round(costoTotal / litrosTotal))} por litro promedio` : ""}</p>
        </div>
        <div className={`tarjeta p-4 ${saldoActual < 300 ? "border-alerta/40 bg-alerta-claro/40" : ""}`}>
          <p className="text-xs text-tinta-suave">Queda en el estanque</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${saldoActual < 300 ? "text-alerta" : ""}`}>{num(Math.max(0, saldoActual))} L</p>
          <p className="text-xs text-tinta-suave">{ultimaEntrada ? `Última carga ${fecha(ultimaEntrada.fecha)}: ${num(n(ultimaEntrada.litros))} L a ${clp(n(ultimaEntrada.precio_lt))}` : "Sin cargas registradas"}</p>
        </div>
        <div className="tarjeta p-4">
          <p className="text-xs text-tinta-suave">Promedio por mes</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{promedioMes !== null ? `${num(promedioMes)} L` : "—"}</p>
          <p className="text-xs text-tinta-suave">{esteMes ? `Este mes van ${num(esteMes.litros)} L` : "Este mes aún sin datos"}</p>
        </div>
      </section>
      {saldoActual < 300 && <div className="-mt-2 mb-5"><Aviso tipo="error">Quedan pocos litros en el estanque según la planilla. Revisa si hay que pedir petróleo.</Aviso></div>}

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="tarjeta p-4 sm:p-5 lg:col-span-3">
          <h2 className="font-semibold">Litros por mes</h2>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Litros de petróleo usados por mes">
            <line x1={0} x2={W} y1={base} y2={base} stroke="var(--color-linea)" />
            {meses.map(([k, g], i) => {
              const cx = i * paso + paso / 2;
              const h = (g.litros / maxMes) * alto;
              const r = Math.min(4, ancho / 2, h);
              const x = cx - ancho / 2;
              const etiqueta = i === iMax || i === meses.length - 1;
              return (
                <g key={k}>
                  <title>{`${MESES[Number(k.slice(5, 7)) - 1]}: ${num(g.litros)} L · ${clp(Math.round(g.costo))}`}</title>
                  <rect x={i * paso} y={0} width={paso} height={H} fill="transparent" />
                  <path d={`M${x},${base}V${base - h + r}Q${x},${base - h} ${x + r},${base - h}H${x + ancho - r}Q${x + ancho},${base - h} ${x + ancho},${base - h + r}V${base}Z`} fill={k === mesActual ? "var(--color-ambar)" : "var(--color-verde)"} />
                  {etiqueta && <text x={cx} y={base - h - 5} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-tinta)">{num(g.litros)}</text>}
                  <text x={cx} y={H - 5} textAnchor="middle" fontSize="10" fill="var(--color-tinta-suave)">{MESES[Number(k.slice(5, 7)) - 1]}</text>
                </g>
              );
            })}
          </svg>
          <p className="mt-1 text-xs text-tinta-suave">Toca o pasa el mouse sobre una barra para ver litros y costo. {porMes.has(mesActual) ? "El mes en curso va en ámbar." : ""}</p>
        </section>

        <section className="tarjeta p-4 sm:p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">¿En qué se usa?</h2>
          <Barras filas={porLabor} total={litrosTotal} />
        </section>
      </div>

      <section className="tarjeta mt-4 overflow-hidden">
        <h2 className="p-4 pb-1 font-semibold sm:px-5">Por máquina</h2>
        <p className="px-4 pb-3 text-sm text-tinta-suave sm:px-5">Las horas y kilómetros salen del horómetro y el cuentakilómetros anotados al cargar.</p>
        <ul className="divide-y divide-linea border-t border-linea">
          {filasMaq.map((m) => (
            <li key={m.id} className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:px-5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <Icono nombre="maquinaria" className="size-4 text-verde" />
                  {m.nombre}
                  {!m.propia && <span className="pastilla bg-ambar-claro text-ambar">Arrendado</span>}
                  {m.marca && m.marca.toLowerCase() !== m.nombre.toLowerCase() && <span className="text-sm font-normal text-tinta-suave">{m.marca}</span>}
                </p>
                <p className="mt-0.5 text-xs text-tinta-suave">
                  {m.usos} cargas · última {fecha(m.ultima)}
                  {m.horometro ? ` · horómetro ${num(m.horometro)} h` : ""}
                  {m.horasTrab ? ` · ${num(m.horasTrab)} h trabajadas` : ""}
                  {m.horasTrab ? ` · ${num(m.litros / m.horasTrab, 1)} L/h` : ""}
                  {m.kmActual ? ` · ${num(m.kmActual)} km` : ""}
                  {m.kmRec ? ` · ${num(m.kmRec / m.litros, 1)} km/L` : ""}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-papel sm:max-w-md">
                  <div className="h-full rounded-full bg-verde" style={{ width: `${(m.litros / (filasMaq[0]?.litros || 1)) * 100}%` }} />
                </div>
              </div>
              <div className="flex items-baseline gap-3 sm:block sm:text-right">
                <p className="text-lg font-semibold tabular-nums">{num(m.litros)} L</p>
                <p className="text-xs tabular-nums text-tinta-suave">{clp(Math.round(m.costo))}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="tarjeta p-4 sm:p-5">
          <h2 className="mb-1 font-semibold">Por especie o destino</h2>
          <p className="mb-4 text-xs text-tinta-suave">Como viene en la planilla. “Plantación de Carozos” es lo que se reparte entre los carozos.</p>
          <Barras filas={porEspecie} total={litrosTotal} />
        </section>
        <section className="tarjeta p-4 sm:p-5">
          <h2 className="mb-4 font-semibold">Por operario</h2>
          <Barras filas={porOperario} total={litrosTotal} color="var(--color-agua)" />
        </section>
      </div>

      <section className="tarjeta mt-4 overflow-hidden">
        <h2 className="p-4 pb-2 font-semibold sm:px-5">Últimas cargas a máquinas</h2>
        <ul className="divide-y divide-linea border-t border-linea">
          {[...conCosto].reverse().slice(0, 12).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
              <div className="min-w-0">
                <p className="truncate"><span className="font-medium">{nombreMaq.get(s.maquina_id ?? "")?.nombre ?? "—"}</span> <span className="text-tinta-suave">· {fecha(s.fecha)}</span></p>
                <p className="truncate text-xs text-tinta-suave">{bonito(s.labor)}{s.sublabor ? ` · ${s.sublabor}` : ""}{s.cuartel_codigo ? ` · ${s.cuartel_codigo}` : ""}{s.operario ? ` · ${s.operario}` : ""}</p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">{num(s.litros)} L</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-4 text-xs text-tinta-suave">
        El costo usa el precio por litro de la última carga al estanque antes de cada fecha. El saldo del estanque parte del último “saldo mes anterior” de la planilla y suma las cargas y resta las salidas desde ahí.
      </p>
    </>
  );
}
