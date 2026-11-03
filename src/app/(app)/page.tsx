import Link from "next/link";
import { obtenerSesion } from "@/lib/auth";
import { ha, num, pct, fecha } from "@/lib/formato";
import { colorEspecie, etiquetaEstado } from "@/lib/etiquetas";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";
import { cargarSeguimiento } from "@/lib/seguimiento";

export const metadata = { title: "Inicio" };

type FilaCuartel = {
  id: string;
  codigo: string;
  superficie_ha: number;
  estado_productivo: string;
  especie: string | null;
  grupo: string | null;
  variedad: string | null;
  anio_plantacion: number | null;
  portainjerto: string | null;
  plantas: number | null;
  plantas_teoricas: number | null;
  equipo: number | null;
};

function agrupar<T>(filas: T[], clave: (f: T) => string) {
  const m = new Map<string, T[]>();
  for (const f of filas) {
    const k = clave(f);
    m.set(k, [...(m.get(k) ?? []), f]);
  }
  return m;
}

const suma = (fs: FilaCuartel[]) => fs.reduce((s, f) => s + Number(f.superficie_ha), 0);

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-tinta-suave">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-tinta">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-tinta-suave">{detalle}</p>}
    </div>
  );
}

export default async function Inicio({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase, perfil } = await obtenerSesion();

  const hoy = new Date().toISOString().slice(0, 10);
  const [{ data: cuarteles }, { data: campo }, { count: nSectores }, { data: temporada }] = await Promise.all([
    supabase
      .from("v_cuartel")
      .select(
        "id, codigo, superficie_ha, estado_productivo, especie, grupo, variedad, anio_plantacion, portainjerto, plantas, plantas_teoricas, equipo",
      )
      .eq("activo", true)
      .order("codigo")
      .returns<FilaCuartel[]>(),
    supabase.from("campo").select("nombre, superficie_total_ha").maybeSingle(),
    supabase.from("sector_riego").select("id", { count: "exact", head: true }),
    supabase.from("temporada").select("nombre, inicio, termino").lte("inicio", hoy).gte("termino", hoy).maybeSingle(),
  ]);

  const filas = (cuarteles ?? []) as FilaCuartel[];
  const total = suma(filas);
  const noPlantado = (f: FilaCuartel) => f.estado_productivo === "sin_plantar" || f.estado_productivo === "eliminado";
  const plantados = filas.filter((f) => !noPlantado(f));
  const porPlantar = filas.filter(noPlantado);
  const totalPlantado = suma(plantados);
  const totalPredio = campo?.superficie_total_ha ? Number(campo.superficie_total_ha) : null;
  const plantasTeoricas = filas.reduce((s, f) => s + (f.plantas ?? f.plantas_teoricas ?? 0), 0);

  const porGrupo = [...agrupar(plantados, (f) => f.grupo ?? "Sin especie")].map(([g, fs]) => ({ g, ha: suma(fs), n: fs.length }));
  const porEspecie = [...agrupar(filas, (f) => f.especie ?? "Sin especie")]
    .map(([especie, fs]) => ({ especie, ha: suma(fs), n: fs.length }))
    .sort((a, b) => b.ha - a.ha);
  const porVariedad = [...agrupar(filas, (f) => `${f.especie ?? "Sin especie"}|${f.variedad ?? "Sin variedad"}`)]
    .map(([k, fs]) => {
      const [especie, variedad] = k.split("|");
      return { especie, variedad, ha: suma(fs), cuarteles: fs.map((f) => f.codigo) };
    })
    .sort((a, b) => b.ha - a.ha);
  const porEquipo = [...agrupar(filas, (f) => String(f.equipo ?? "—"))]
    .map(([equipo, fs]) => ({ equipo, ha: suma(fs), n: fs.length, especies: [...new Set(fs.map((f) => f.especie))].join(", ") }))
    .sort((a, b) => a.equipo.localeCompare(b.equipo));
  const porEstado = [...agrupar(filas, (f) => f.estado_productivo)].map(([e, fs]) => ({ e, ha: suma(fs), n: fs.length }));

  const pendientes = [
    { texto: "sin variedad", n: plantados.filter((f) => !f.variedad).length },
    { texto: "sin año de plantación", n: plantados.filter((f) => !f.anio_plantacion).length },
    { texto: "sin portainjerto", n: plantados.filter((f) => !f.portainjerto).length },
    { texto: "sin conteo real de plantas", n: plantados.filter((f) => f.plantas === null).length },
  ].filter((p) => p.n > 0);

  // Aviso de aplicaciones atrasadas o que tocan este mes (solo para quienes ven los programas)
  let atrasadas = 0;
  let esteMes = 0;
  if (["administrador", "enc_administrativo", "enc_agricola", "propietario"].includes(perfil.rol)) {
    try {
      const hoyChile = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
      const { pendientes } = await cargarSeguimiento(supabase, hoyChile);
      atrasadas = new Set(pendientes.filter((x) => x.situacion === "atrasada").map((x) => x.app_id)).size;
      esteMes = new Set(pendientes.filter((x) => x.situacion === "este_mes" || x.situacion === "reprogramada").map((x) => x.app_id)).size;
    } catch {
      /* si falla, el inicio se muestra igual */
    }
  }

  const maxEspecie = Math.max(...porEspecie.map((e) => e.ha), 1);

  return (
    <>
      <header className="mb-5">
        <p className="text-sm text-tinta-suave">Hola{perfil.nombre ? `, ${perfil.nombre.split(" ")[0]}` : ""}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{campo?.nombre ?? "Fundo La Morera"}</h1>
        <p className="text-sm text-tinta-suave">
          {temporada
            ? `Temporada ${temporada.nombre} · ${fecha(temporada.inicio)} al ${fecha(temporada.termino)}`
            : "Sin temporada vigente: créala en Campo"}
        </p>
      </header>

      {error === "permiso" && (
        <div className="mb-4">
          <Aviso tipo="error">No tienes permiso para entrar a esa sección.</Aviso>
        </div>
      )}

      {(atrasadas > 0 || esteMes > 0) && (
        <div className="mb-4">
          <Aviso tipo={atrasadas > 0 ? "error" : "info"}>
            {atrasadas > 0 && <>Hay <strong>{atrasadas}</strong> {atrasadas === 1 ? "aplicación atrasada" : "aplicaciones atrasadas"}. </>}
            {esteMes > 0 && <>{esteMes} {esteMes === 1 ? "aplicación toca" : "aplicaciones tocan"} este mes o están reprogramadas. </>}
            <Link href="/programas" className="font-medium underline">Ver aplicaciones por hacer</Link>
          </Aviso>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          titulo="Superficie plantada"
          valor={ha(totalPlantado)}
          detalle={
            porPlantar.length
              ? `${ha(suma(porPlantar))} por plantar (${porPlantar.map((f) => f.codigo).join(", ")})`
              : totalPredio
                ? `${pct((totalPlantado / totalPredio) * 100)} del predio`
                : undefined
          }
        />
        {porGrupo.map((g) => (
          <Indicador key={g.g} titulo={g.g === "Nogal" ? "Nogales" : g.g === "Carozo" ? "Carozos plantados" : g.g} valor={ha(g.ha)} detalle={`${g.n} cuarteles`} />
        ))}
        <Indicador
          titulo="Cuarteles · sectores"
          valor={`${filas.length} · ${nSectores ?? 0}`}
          detalle={`${ha(total)} en cuarteles${totalPredio ? ` de ${ha(totalPredio)} del predio` : ""} · ${num(plantasTeoricas)} plantas`}
        />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <section className="tarjeta p-5 lg:col-span-2">
          <h2 className="font-semibold">Superficie por especie</h2>
          <ul className="mt-4 flex flex-col gap-3.5">
            {porEspecie.map((e) => (
              <li key={e.especie}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-medium">{e.especie}</span>
                  <span className="tabular-nums text-tinta-suave">
                    {ha(e.ha)} · {pct((e.ha / total) * 100)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-papel">
                  <div className="h-full rounded-full" style={{ width: `${(e.ha / maxEspecie) * 100}%`, background: colorEspecie(e.especie) }} />
                </div>
              </li>
            ))}
          </ul>

          <h3 className="mt-6 text-sm font-semibold">Estado productivo</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {porEstado.map((e) => (
              <li key={e.e} className="pastilla bg-papel text-tinta">
                {etiquetaEstado(e.e)}: {ha(e.ha)}
              </li>
            ))}
          </ul>
        </section>

        <section className="tarjeta overflow-hidden lg:col-span-3">
          <h2 className="px-5 pt-5 font-semibold">Superficie por variedad</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Variedad</th>
                  <th className="text-right">Superficie</th>
                  <th className="hidden sm:table-cell">Cuarteles</th>
                </tr>
              </thead>
              <tbody>
                {porVariedad.map((v) => (
                  <tr key={`${v.especie}-${v.variedad}`}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorEspecie(v.especie) }} />
                        <span>
                          <span className={v.variedad === "Sin variedad" ? "text-ambar" : "font-medium"}>{v.variedad}</span>
                          <span className="text-tinta-suave"> · {v.especie}</span>
                        </span>
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{ha(v.ha)}</td>
                    <td className="hidden text-tinta-suave sm:table-cell">{v.cuarteles.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="tarjeta overflow-hidden">
          <h2 className="px-5 pt-5 font-semibold">Equipos de riego</h2>
          <table className="tabla mt-2">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Especies</th>
                <th className="text-right">Superficie</th>
              </tr>
            </thead>
            <tbody>
              {porEquipo.map((e) => (
                <tr key={e.equipo}>
                  <td className="font-medium">Equipo {e.equipo}</td>
                  <td className="text-tinta-suave">{e.especies}</td>
                  <td className="text-right tabular-nums">{ha(e.ha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="tarjeta p-5">
          <h2 className="font-semibold">Fichas por completar</h2>
          {pendientes.length === 0 ? (
            <p className="mt-2 text-sm text-tinta-suave">Todas las fichas de cuartel están completas.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-tinta-suave">Datos que el plano no trae y conviene cargar para los costos por planta y la historia de cada cuartel.</p>
              <ul className="mt-3 flex flex-col gap-2">
                {pendientes.map((p) => (
                  <li key={p.texto} className="flex items-center justify-between rounded-lg bg-papel px-3 py-2 text-sm">
                    <span>
                      <span className="font-semibold tabular-nums">{p.n}</span> cuarteles {p.texto}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href="/cuarteles" className="boton-secundario mt-4">
                <Icono nombre="cuarteles" className="size-4" />
                Ir a cuarteles
              </Link>
            </>
          )}
        </section>
      </div>

      <p className="mt-6 text-xs text-tinta-suave">
        Producción, gastos, presupuesto y cuentas por pagar se suman a este tablero en las etapas 2 a 4.
      </p>
    </>
  );
}
