"use client";
// Calculadora de tiempo de riego por goteo: ET0 × Kc ÷ eficiencia = lámina; lámina ÷ precipitación del equipo = horas.
import { useMemo, useState } from "react";

export type SectorCalc = {
  id: string; codigo: string; ha: number; cuarteles: string; especie: string | null; variedad: string | null; nogal: boolean;
  entreHileras: number | null; sobreHilera: number | null; lineas: number | null; caudal: number | null; goteros: number | null; precipitacionDiseno: number | null;
};

const leer = (s: string) => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const txt = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
const f = (n: number, d = 1) => n.toLocaleString("es-CL", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const horas = (h: number) => {
  if (!Number.isFinite(h) || h <= 0) return "—";
  const t = Math.round(h * 60);
  const hh = Math.floor(t / 60), mm = t % 60;
  return hh ? `${hh} h${mm ? ` ${mm} min` : ""}` : `${mm} min`;
};
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const diaCorto = (iso: string, i: number) => (i === 0 ? "Hoy" : DIAS[new Date(iso + "T12:00:00Z").getUTCDay()]);

/** Referencias FAO-56 (tabla 12). Son de referencia: el Kc real lo ajusta el asesor según estado y cobertura. */
const KC_REF = {
  nogal: [["Inicio", 0.5], ["Pleno desarrollo", 1.1], ["Final", 0.65]],
  carozo: [["Inicio", 0.45], ["Pleno desarrollo", 0.9], ["Final", 0.65]],
} as const;

function Campo({ id, label, valor, cambiar, sufijo, ayuda, placeholder }: { id: string; label: string; valor: string; cambiar: (v: string) => void; sufijo?: string; ayuda?: string; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta-campo">{label}</label>
      <div className="relative">
        <input id={id} value={valor} onChange={(e) => cambiar(e.target.value)} inputMode="decimal" placeholder={placeholder} className={`entrada ${sufijo ? "pr-14" : ""}`} />
        {sufijo && <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-tinta-suave">{sufijo}</span>}
      </div>
      {ayuda && <p className="mt-1 text-xs text-tinta-suave">{ayuda}</p>}
    </div>
  );
}

export function Calculadora({ sectores, dias }: { sectores: SectorCalc[]; dias: { fecha: string; et0: number }[] }) {
  const primero = sectores.find((s) => s.nogal) ?? sectores[0];
  const [sectorId, setSectorId] = useState(primero?.id ?? "");
  const [et0, setEt0] = useState(dias[0] ? txt(Math.round(dias[0].et0 * 10) / 10) : "");
  const [kc, setKc] = useState(primero?.nogal ? "1,1" : "0,9");
  const [ef, setEf] = useState("90");
  const [entre, setEntre] = useState(txt(primero?.entreHileras));
  const [sobre, setSobre] = useState(txt(primero?.sobreHilera));
  const [supManual, setSupManual] = useState("");
  const [lineas, setLineas] = useState(txt(primero?.lineas ?? (primero?.nogal ? 4 : 2)));
  const [dGot, setDGot] = useState(txt(primero?.goteros));
  const [caudal, setCaudal] = useState(txt(primero?.caudal));
  const [kcNogal, setKcNogal] = useState("1,1");
  const [kcCarozo, setKcCarozo] = useState("0,9");

  const sector = sectores.find((s) => s.id === sectorId) ?? null;
  const cargar = (id: string) => {
    setSectorId(id);
    const s = sectores.find((x) => x.id === id);
    if (!s) return;
    setEntre(txt(s.entreHileras));
    setSobre(txt(s.sobreHilera));
    setSupManual("");
    setLineas(txt(s.lineas ?? (s.nogal ? 4 : 2)));
    setDGot(txt(s.goteros));
    setCaudal(txt(s.caudal));
    setKc(s.nogal ? kcNogal : kcCarozo);
  };

  const r = useMemo(() => {
    const E = leer(et0), K = leer(kc), EF = leer(ef), A = leer(entre), B = leer(sobre), L = leer(lineas), D = leer(dGot), Q = leer(caudal);
    const sup = leer(supManual) ?? (A && B ? A * B : null);
    const etc = E !== null && K !== null ? E * K : null;
    const lamina = etc !== null && EF ? etc / (EF / 100) : null;
    const aguaArbol = lamina !== null && sup ? lamina * sup : null;
    const goterosArbol = B && D && L ? (B / D) * L : null;
    const caudalArbol = goterosArbol && Q ? goterosArbol * Q : null;
    const pp = caudalArbol && sup ? caudalArbol / sup : null;
    const t = aguaArbol !== null && caudalArbol ? aguaArbol / caudalArbol : null;
    return { sup, etc, lamina, aguaArbol, goterosArbol, caudalArbol, pp, t };
  }, [et0, kc, ef, entre, sobre, supManual, lineas, dGot, caudal]);

  const tabla = useMemo(() => {
    const E = leer(et0), EF = leer(ef), KN = leer(kcNogal), KC = leer(kcCarozo);
    return sectores.map((s) => {
      const k = s.nogal ? KN : KC;
      const sup = s.entreHileras && s.sobreHilera ? s.entreHileras * s.sobreHilera : null;
      const pp = sup && s.sobreHilera && s.goteros && s.lineas && s.caudal ? ((s.sobreHilera / s.goteros) * s.lineas * s.caudal) / sup : s.precipitacionDiseno;
      const lamina = E !== null && k !== null && EF ? (E * k) / (EF / 100) : null;
      return { s, k, pp, lamina, t: lamina !== null && pp ? lamina / pp : null, m3: lamina !== null ? lamina * 10 * s.ha : null };
    });
  }, [sectores, et0, ef, kcNogal, kcCarozo]);

  const ref = sector?.nogal ? KC_REF.nogal : KC_REF.carozo;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col gap-4 lg:col-span-3">
        <section className="tarjeta p-4 sm:p-5">
          <h2 className="mb-3 font-semibold">1. Demanda del día</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Campo id="et0" label="ET0 (evapotranspiración de referencia)" valor={et0} cambiar={setEt0} sufijo="mm/día" placeholder="Ej: 5,2" />
              {dias.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="ET0 del pronóstico">
                  {dias.map((d, i) => {
                    const v = txt(Math.round(d.et0 * 10) / 10);
                    return (
                      <button key={d.fecha} type="button" onClick={() => setEt0(v)} className={`rounded-full border px-2.5 py-1 text-xs tabular-nums ${et0 === v ? "border-verde bg-verde-claro text-verde-oscuro" : "border-linea bg-white"}`}>
                        {diaCorto(d.fecha, i)} <strong>{v}</strong>
                      </button>
                    );
                  })}
                  <span className="self-center text-[11px] text-tinta-suave">Pronóstico Open-Meteo. Si tienes el dato de la estación, úsalo.</span>
                </div>
              )}
            </div>
            <div>
              <Campo id="kc" label="Kc del cultivo" valor={kc} cambiar={setKc} placeholder="Ej: 1,1" />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {ref.map(([t, v]) => (
                  <button key={t} type="button" onClick={() => setKc(txt(v))} className="rounded-full border border-linea bg-white px-2 py-0.5 text-[11px]">{t} {txt(v)}</button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-tinta-suave">Referencia FAO-56 para {sector?.nogal ? "nogal" : "carozos"}; el asesor lo ajusta.</p>
            </div>
            <Campo id="ef" label="Eficiencia del riego" valor={ef} cambiar={setEf} sufijo="%" ayuda="Goteo: 85 a 95 %." />
          </div>
        </section>

        <section className="tarjeta p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">2. Equipo y plantación</h2>
            <select value={sectorId} onChange={(e) => cargar(e.target.value)} className="entrada w-auto py-2 text-sm" aria-label="Cargar datos de un sector">
              <option value="">A mano</option>
              {sectores.map((s) => <option key={s.id} value={s.id}>Sector {s.codigo} · {s.especie ?? ""} {s.variedad ?? ""}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Campo id="entre" label="Entre hileras" valor={entre} cambiar={(v) => { setEntre(v); setSupManual(""); }} sufijo="m" />
            <Campo id="sobre" label="Sobre hilera (entre árboles)" valor={sobre} cambiar={(v) => { setSobre(v); setSupManual(""); }} sufijo="m" />
            <Campo id="sup" label="Superficie por árbol" valor={supManual || (r.sup ? txt(Math.round(r.sup * 100) / 100) : "")} cambiar={setSupManual} sufijo="m²" ayuda="Se calcula con el marco; puedes cambiarla." />
            <div className="col-span-2 sm:col-span-1">
              <p className="etiqueta-campo">Líneas por hilera</p>
              <div className="flex gap-2">
                {[["2", "2 (carozos)"], ["4", "4 (nogales)"]].map(([v, t]) => (
                  <button key={v} type="button" onClick={() => setLineas(v)} className={`flex-1 rounded-lg border-2 px-2 py-2 text-sm font-medium ${lineas === v ? "border-verde bg-verde-claro text-verde-oscuro" : "border-linea bg-white"}`}>{t}</button>
                ))}
              </div>
              {lineas !== "2" && lineas !== "4" && <input value={lineas} onChange={(e) => setLineas(e.target.value)} inputMode="numeric" className="entrada mt-2" aria-label="Líneas por hilera" />}
            </div>
            <Campo id="dgot" label="Distancia entre goteros" valor={dGot} cambiar={setDGot} sufijo="m" />
            <Campo id="caudal" label="Caudal del gotero" valor={caudal} cambiar={setCaudal} sufijo="L/h" />
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <section className="tarjeta overflow-hidden lg:sticky lg:top-6">
          <div className="bg-agua p-5 text-white">
            <p className="text-sm text-white/80">Tiempo de riego por día{sector ? ` · sector ${sector.codigo}` : ""}</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">{r.t ? horas(r.t) : "—"}</p>
            {r.t && r.t > 0 && <p className="mt-1 text-sm text-white/80">≈ {f(r.t, 2)} horas · {horas(r.t * 7)} a la semana</p>}
          </div>
          <dl className="divide-y divide-linea text-sm">
            {[
              ["ETc (ET0 × Kc)", r.etc !== null ? `${f(r.etc, 2)} mm/día` : "—"],
              ["Lámina a aplicar (ETc ÷ eficiencia)", r.lamina !== null ? `${f(r.lamina, 2)} mm/día` : "—"],
              ["Agua por árbol (lámina × superficie)", r.aguaArbol !== null ? `${f(r.aguaArbol, 1)} L/día` : "—"],
              ["Goteros por árbol", r.goterosArbol ? f(r.goterosArbol, 1) : "—"],
              ["Caudal por árbol", r.caudalArbol ? `${f(r.caudalArbol, 1)} L/h` : "—"],
              ["Precipitación del equipo", r.pp ? `${f(r.pp, 2)} mm/h` : "—"],
              ["Volumen por hectárea", r.lamina !== null ? `${f(r.lamina * 10, 1)} m³/ha/día` : "—"],
              ...(sector && r.lamina !== null ? [[`Volumen del sector (${f(sector.ha, 2)} ha)`, `${f(r.lamina * 10 * sector.ha, 0)} m³/día`]] : []),
            ].map(([t, v]) => (
              <div key={t} className="flex items-baseline justify-between gap-3 px-4 py-2.5"><dt className="text-tinta-suave">{t}</dt><dd className="shrink-0 font-medium tabular-nums">{v}</dd></div>
            ))}
          </dl>
          {sector?.precipitacionDiseno && r.pp && Math.abs(sector.precipitacionDiseno - r.pp) > 0.05 && (
            <p className="border-t border-linea px-4 py-2.5 text-xs text-ambar">El diseño del sector dice {f(sector.precipitacionDiseno, 2)} mm/h; con estos datos da {f(r.pp, 2)} mm/h. Revisa caudal, goteros o marco.</p>
          )}
          <p className="border-t border-linea px-4 py-2.5 text-xs text-tinta-suave">Tiempo = agua por árbol ÷ caudal por árbol. No descuenta lluvia ni humedad del suelo: si llovió o el suelo está húmedo, riega menos.</p>
        </section>
      </div>

      <section className="tarjeta overflow-hidden lg:col-span-5">
        <div className="flex flex-wrap items-end justify-between gap-3 p-4">
          <div>
            <h2 className="font-semibold">Todos los sectores con esta ET0 y eficiencia</h2>
            <p className="text-sm text-tinta-suave">Usa el diseño de cada sector (marco, líneas, goteros y caudal).</p>
          </div>
          <div className="flex gap-3">
            <div className="w-28"><Campo id="kcn" label="Kc nogales" valor={kcNogal} cambiar={setKcNogal} /></div>
            <div className="w-28"><Campo id="kcc" label="Kc carozos" valor={kcCarozo} cambiar={setKcCarozo} /></div>
          </div>
        </div>
        <ul className="divide-y divide-linea border-t border-linea sm:hidden">
          {tabla.map(({ s, pp, lamina, t, m3 }) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0">
                <span className="block font-medium">Sector {s.codigo} <span className="font-normal text-tinta-suave">· {s.especie} {s.variedad}</span></span>
                <span className="block text-xs tabular-nums text-tinta-suave">{pp ? `${f(pp, 2)} mm/h` : "sin diseño"}{lamina !== null ? ` · ${f(lamina, 1)} mm` : ""}{m3 !== null ? ` · ${f(m3, 0)} m³` : ""}</span>
              </span>
              <span className="shrink-0 text-lg font-semibold tabular-nums text-agua">{t ? horas(t) : "—"}</span>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="tabla">
            <thead><tr><th>Sector</th><th>Cuarteles</th><th>Cultivo</th><th className="text-right">Kc</th><th className="text-right">Precipitación</th><th className="text-right">Lámina</th><th className="text-right">Volumen</th><th className="text-right">Tiempo por día</th></tr></thead>
            <tbody>
              {tabla.map(({ s, k, pp, lamina, t, m3 }) => (
                <tr key={s.id} className={s.id === sectorId ? "bg-agua-claro/40" : ""}>
                  <td className="font-medium">{s.codigo}</td>
                  <td className="text-tinta-suave">{s.cuarteles}</td>
                  <td>{s.especie} <span className="text-tinta-suave">{s.variedad}</span></td>
                  <td className="text-right tabular-nums">{k !== null ? f(k, 2) : "—"}</td>
                  <td className="text-right tabular-nums">{pp ? `${f(pp, 2)} mm/h` : "—"}</td>
                  <td className="text-right tabular-nums">{lamina !== null ? `${f(lamina, 2)} mm` : "—"}</td>
                  <td className="text-right tabular-nums">{m3 !== null ? `${f(m3, 0)} m³` : "—"}</td>
                  <td className="text-right text-base font-semibold tabular-nums text-agua">{t ? horas(t) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
