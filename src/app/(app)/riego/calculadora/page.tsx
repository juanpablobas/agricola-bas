import { obtenerSesion } from "@/lib/auth";
import { Encabezado } from "@/components/Encabezado";
import { hoyChile } from "@/lib/semana";
import { obtenerClima, ubicacionDelCampo } from "@/lib/clima";
import { Calculadora, type SectorCalc } from "./Calculadora";

export const metadata = { title: "Calculadora de riego" };

export default async function CalculadoraRiego() {
  const { supabase } = await obtenerSesion();
  const hoy = hoyChile();
  const [{ data: sectores }, { data: cs }, { data: cuarteles }, clima] = await Promise.all([
    supabase.from("sector_riego").select("id, codigo, superficie_ha, lineas_por_hilera, caudal_emisor_lh, distancia_emisores_m, precipitacion_mmh").order("codigo"),
    supabase.from("cuartel_sector").select("sector_id, cuartel_id"),
    supabase.from("v_cuartel").select("id, codigo, especie, grupo, variedad, distancia_hileras_m, distancia_plantas_m").eq("activo", true).order("codigo"),
    (async () => {
      try {
        const u = await ubicacionDelCampo(supabase);
        return u ? await obtenerClima(u) : null;
      } catch {
        return null;
      }
    })(),
  ]);
  const cuartelDe = new Map(((cuarteles ?? []) as any[]).map((c) => [c.id as string, c]));
  const lista: SectorCalc[] = ((sectores ?? []) as any[]).map((s) => {
    const cs0 = ((cs ?? []) as any[]).filter((x) => x.sector_id === s.id).map((x) => cuartelDe.get(x.cuartel_id)).filter(Boolean) as any[];
    const c = cs0[0];
    return {
      id: s.id,
      codigo: s.codigo,
      ha: Number(s.superficie_ha ?? 0),
      cuarteles: cs0.map((x) => x.codigo).join(", "),
      especie: c?.especie ?? null,
      variedad: [...new Set(cs0.map((x) => x.variedad).filter(Boolean))].join(", ") || null,
      nogal: c?.grupo === "Nogal",
      entreHileras: c?.distancia_hileras_m != null ? Number(c.distancia_hileras_m) : null,
      sobreHilera: c?.distancia_plantas_m != null ? Number(c.distancia_plantas_m) : null,
      lineas: s.lineas_por_hilera ?? null,
      caudal: s.caudal_emisor_lh != null ? Number(s.caudal_emisor_lh) : null,
      goteros: s.distancia_emisores_m != null ? Number(s.distancia_emisores_m) : null,
      precipitacionDiseno: s.precipitacion_mmh != null ? Number(s.precipitacion_mmh) : null,
    };
  });
  const dias = (clima?.dias ?? []).filter((d) => d.fecha >= hoy && d.et0 != null).slice(0, 7).map((d) => ({ fecha: d.fecha, et0: Number(d.et0) }));

  return (
    <>
      <Encabezado
        titulo="Calculadora de riego"
        subtitulo="Cuánto tiempo regar por día según ET0, Kc, eficiencia y el diseño del riego."
        volver={{ href: "/riego", texto: "Riego" }}
      />
      <Calculadora sectores={lista} dias={dias} />
    </>
  );
}
