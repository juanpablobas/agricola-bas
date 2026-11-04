// Tarjetas del inicio ("Hoy"). Son componentes de presentación: reciben los datos ya calculados.
import Link from "next/link";
import { Icono } from "@/components/Icono";
import { clp, num } from "@/lib/formato";
import type { Alerta, Dia } from "@/lib/clima";

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const diaCorto = (iso: string) => DIAS_CORTOS[new Date(iso + "T12:00:00Z").getUTCDay()];

/** Millones con una decimal: $302,1 M */
export const millones = (v: number) => `$${num(v / 1_000_000, 1)} M`;

export function Tarjeta({ titulo, icono, href, enlace, children, className = "" }: { titulo: string; icono: string; href?: string; enlace?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`tarjeta flex flex-col p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-verde-claro text-verde"><Icono nombre={icono} className="size-4.5" /></span>
          {titulo}
        </h2>
        {href && (
          <Link href={href} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-lg px-2 text-sm font-medium text-verde hover:bg-verde-claro">
            {enlace ?? "Ver"}<Icono nombre="volver" className="size-4 rotate-180" />
          </Link>
        )}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

/** Número grande con su etiqueta, para destacar lo importante de cada tarjeta */
export function Cifra({ valor, etiqueta, tono = "normal" }: { valor: React.ReactNode; etiqueta: string; tono?: "normal" | "alerta" | "ok" | "suave" }) {
  const color = { normal: "text-tinta", alerta: "text-alerta", ok: "text-verde", suave: "text-tinta-suave" }[tono];
  return (
    <div>
      <p className={`text-2xl font-semibold leading-tight tracking-tight tabular-nums ${color}`}>{valor}</p>
      <p className="text-xs text-tinta-suave">{etiqueta}</p>
    </div>
  );
}

export function Atencion({ items }: { items: { texto: React.ReactNode; href?: string; nivel: "alto" | "medio" }[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-5 overflow-hidden rounded-[var(--radius-tarjeta)] border border-alerta/25 bg-white">
      <h2 className="flex items-center gap-2 bg-alerta-claro px-4 py-2 text-sm font-semibold text-alerta">
        <Icono nombre="alerta" className="size-4" />Para tener en cuenta
      </h2>
      <ul className="divide-y divide-linea">
        {items.map((it, i) => {
          const contenido = (
            <span className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className={`size-2 shrink-0 rounded-full ${it.nivel === "alto" ? "bg-alerta" : "bg-ambar"}`} />
              <span className="flex-1">{it.texto}</span>
              {it.href && <Icono nombre="volver" className="size-4 shrink-0 rotate-180 text-tinta-suave" />}
            </span>
          );
          return <li key={i}>{it.href ? <Link href={it.href} className="block hover:bg-papel">{contenido}</Link> : contenido}</li>;
        })}
      </ul>
    </section>
  );
}

export function AccesosRapidos({ accesos }: { accesos: { href: string; texto: string; icono: string }[] }) {
  if (accesos.length === 0) return null;
  return (
    <nav aria-label="Accesos rápidos" className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {accesos.map((a) => (
        <Link key={a.href} href={a.href} className="tarjeta tocable flex min-h-14 items-center gap-3 px-3 py-2.5 text-sm font-medium hover:border-verde/40 hover:bg-verde-claro/40">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-verde text-white"><Icono nombre={a.icono} className="size-5" /></span>
          <span className="leading-tight">{a.texto}</span>
        </Link>
      ))}
    </nav>
  );
}

export function TarjetaClima({ temp, dias, hoy, alertas }: { temp: number | null; dias: Dia[]; hoy: string; alertas: Alerta[] }) {
  const d = dias.find((x) => x.fecha === hoy);
  const prox = dias.filter((x) => x.fecha > hoy).slice(0, 4);
  const conAlerta = new Set(alertas.map((a) => a.fecha));
  return (
    <Tarjeta titulo="Clima" icono="clima" href="/clima" enlace="Pronóstico">
      {!d ? (
        <p className="text-sm text-tinta-suave">No se pudo leer el pronóstico ahora. Intenta más tarde.</p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-4xl font-semibold leading-none tracking-tight tabular-nums">{temp != null ? `${Math.round(temp)}°` : `${Math.round(d.tmax)}°`}</p>
              <p className="mt-1 text-xs text-tinta-suave">{temp != null ? "Ahora en el campo" : "Máxima de hoy"}</p>
            </div>
            <dl className="grid grid-cols-3 gap-3 text-right text-xs">
              <div><dt className="text-tinta-suave">Hoy</dt><dd className="font-semibold tabular-nums">{Math.round(d.tmin)}° / {Math.round(d.tmax)}°</dd></div>
              <div><dt className="text-tinta-suave">Lluvia</dt><dd className="font-semibold tabular-nums">{num(d.lluvia, 1)} mm</dd></div>
              <div><dt className="text-tinta-suave">Viento</dt><dd className="font-semibold tabular-nums">{Math.round(d.viento)} km/h</dd></div>
            </dl>
          </div>
          <ul className="mt-4 grid grid-cols-4 gap-1.5">
            {prox.map((x) => (
              <li key={x.fecha} className={`rounded-lg px-1 py-2 text-center text-xs ${conAlerta.has(x.fecha) ? "bg-alerta-claro" : "bg-papel"}`}>
                <p className="font-medium">{diaCorto(x.fecha)}</p>
                <p className="mt-0.5 tabular-nums"><span className="text-tinta-suave">{Math.round(x.tmin)}°</span> <span className="font-semibold">{Math.round(x.tmax)}°</span></p>
                <p className={`mt-0.5 tabular-nums ${x.lluvia >= 1 ? "font-semibold text-verde" : "text-tinta-suave"}`}>{x.lluvia >= 0.1 ? `${num(x.lluvia, 1)} mm` : "—"}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Tarjeta>
  );
}

export function TarjetaAplicaciones({ atrasadas, esteMes, lista }: { atrasadas: number; esteMes: number; lista: { texto: string; detalle: string; atrasada: boolean }[] }) {
  return (
    <Tarjeta titulo="Aplicaciones" icono="programas" href="/programas">
      <div className="flex gap-6">
        <Cifra valor={atrasadas} etiqueta={atrasadas === 1 ? "atrasada" : "atrasadas"} tono={atrasadas > 0 ? "alerta" : "suave"} />
        <Cifra valor={esteMes} etiqueta="tocan este mes" />
      </div>
      {lista.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          {lista.map((x, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg bg-papel px-3 py-2">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${x.atrasada ? "bg-alerta" : "bg-ambar"}`} />
              <span className="min-w-0"><span className="font-medium">{x.texto}</span><span className="block truncate text-xs text-tinta-suave">{x.detalle}</span></span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-tinta-suave">Nada pendiente del programa por ahora.</p>
      )}
    </Tarjeta>
  );
}

export function TarjetaLabores({ planificadas, hechas, registros, puedePlanificar, semana }: { planificadas: number; hechas: number; registros: number; puedePlanificar: boolean; semana: string }) {
  const total = planificadas + hechas;
  return (
    <Tarjeta titulo="Labores de la semana" icono="labores" href="/labores">
      {total === 0 && registros === 0 ? (
        <div className="flex flex-1 flex-col justify-between gap-3">
          <p className="text-sm text-tinta-suave">Todavía no hay labores planificadas ni registradas esta semana.</p>
          {puedePlanificar && (
            <Link href={`/labores/plan?semana=${semana}`} className="boton-secundario self-start"><Icono nombre="mas" className="size-4" />Planificar la semana</Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-6">
            <Cifra valor={planificadas} etiqueta="por hacer" tono={planificadas > 0 ? "normal" : "suave"} />
            <Cifra valor={hechas} etiqueta="hechas" tono="ok" />
            <Cifra valor={registros} etiqueta="registros" tono="suave" />
          </div>
          {total > 0 && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-papel" role="img" aria-label={`${hechas} de ${total} labores planificadas hechas`}>
                <div className="h-full rounded-full bg-verde" style={{ width: `${(hechas / total) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-tinta-suave">{hechas} de {total} planificadas</p>
            </div>
          )}
        </>
      )}
    </Tarjeta>
  );
}

/** Gasto real contra presupuesto por mes (barras finas, una al lado de la otra) */
export function TarjetaFinanzas({ meses, temporada }: { meses: { mes: string; presupuesto: number; real: number }[]; temporada: string }) {
  const conReal = meses.filter((m) => m.real > 0);
  const ultimo = conReal.at(-1)?.mes;
  if (!ultimo) {
    return (
      <Tarjeta titulo="Gastos" icono="finanzas" href="/finanzas">
        <p className="text-sm text-tinta-suave">Todavía no hay gastos cargados en la temporada {temporada}.</p>
      </Tarjeta>
    );
  }
  const hasta = meses.filter((m) => m.mes <= ultimo);
  const real = hasta.reduce((s, m) => s + m.real, 0);
  const ppto = hasta.reduce((s, m) => s + m.presupuesto, 0);
  const dif = ppto > 0 ? ((real - ppto) / ppto) * 100 : null;
  const nombreMes = (iso: string) => MESES_CORTOS[Number(iso.slice(5, 7)) - 1];

  const W = 320, H = 120, base = H - 18, alto = base - 8;
  const max = Math.max(...meses.map((m) => Math.max(m.real, m.presupuesto)), 1);
  const paso = W / meses.length;
  const ancho = Math.min(9, paso / 2 - 3);
  return (
    <Tarjeta titulo="Gastos de la temporada" icono="finanzas" href="/finanzas">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Cifra valor={millones(real)} etiqueta={`gastado hasta ${nombreMes(ultimo)}`} />
        <Cifra valor={millones(ppto)} etiqueta="presupuesto a esa fecha" tono="suave" />
        {dif !== null && (
          <Cifra valor={`${dif > 0 ? "+" : ""}${num(dif, 0)} %`} etiqueta={dif > 0 ? "sobre lo presupuestado" : "bajo lo presupuestado"} tono={dif > 5 ? "alerta" : "ok"} />
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label="Gasto real y presupuesto por mes">
        <line x1={0} x2={W} y1={base} y2={base} stroke="var(--color-linea)" />
        {meses.map((m, i) => {
          const cx = i * paso + paso / 2;
          const hp = (m.presupuesto / max) * alto;
          const hr = (m.real / max) * alto;
          const futuro = m.mes > ultimo;
          return (
            <g key={m.mes}>
              <title>{`${nombreMes(m.mes)}: real ${clp(Math.round(m.real))} · presupuesto ${clp(Math.round(m.presupuesto))}`}</title>
              <rect x={i * paso} y={0} width={paso} height={H} fill="transparent" />
              {hp > 0 && <path d={barra(cx - ancho - 1, base, ancho, hp)} fill={futuro ? "#e9e4d8" : "#d9c9a3"} />}
              {hr > 0 && <path d={barra(cx + 1, base, ancho, hr)} fill="var(--color-verde)" />}
              <text x={cx} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--color-tinta-suave)">{nombreMes(m.mes)}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 flex flex-wrap gap-4 text-xs text-tinta-suave">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-verde" />Real (con IVA)</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "#d9c9a3" }} />Presupuesto</span>
      </p>
    </Tarjeta>
  );
}

/** Barra con la punta redondeada (4 px) y la base recta sobre el eje */
function barra(x: number, base: number, w: number, h: number) {
  const r = Math.min(3, w / 2, h);
  return `M${x},${base}V${base - h + r}Q${x},${base - h} ${x + r},${base - h}H${x + w - r}Q${x + w},${base - h} ${x + w},${base - h + r}V${base}Z`;
}

export function TarjetaRecomendacion({ texto }: { texto: string }) {
  return (
    <Tarjeta titulo="Recomendación del día" icono="ok" href="/clima">
      <p className="line-clamp-5 whitespace-pre-line text-sm leading-relaxed text-tinta">{texto.replace(/[#*]/g, "").trim()}</p>
      <p className="mt-2 text-xs text-tinta-suave">Generada con IA según el clima y lo pendiente. Confírmala con tu criterio y el del asesor.</p>
    </Tarjeta>
  );
}

export function TarjetaCosecha({ kilos, bins, registros }: { kilos: number; bins: number; registros: number }) {
  return (
    <Tarjeta titulo="Cosecha" icono="cosecha" href="/cosecha">
      <div className="flex gap-6">
        <Cifra valor={kilos > 0 ? num(kilos) : "—"} etiqueta="kilos esta temporada" />
        <Cifra valor={bins > 0 ? num(bins) : "—"} etiqueta="bins" tono="suave" />
        <Cifra valor={registros} etiqueta="registros" tono="suave" />
      </div>
    </Tarjeta>
  );
}
