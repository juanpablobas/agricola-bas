import "server-only";
import type { EspecieConVariedades, SectorOpcion } from "@/app/(app)/cuarteles/FormularioCuartel";

type Supa = { from: (t: string) => any };

export async function cargarEspecies(supabase: Supa): Promise<EspecieConVariedades[]> {
  const { data } = await supabase.from("especie").select("id, nombre, variedad(id, nombre)").order("nombre");
  return (data ?? []).map((e: any) => ({
    id: e.id,
    nombre: e.nombre,
    variedades: [...(e.variedad ?? [])].sort((a: any, b: any) => a.nombre.localeCompare(b.nombre, "es")),
  }));
}

export async function cargarSectores(supabase: Supa): Promise<SectorOpcion[]> {
  const { data } = await supabase.from("sector_riego").select("id, codigo, equipo_riego(numero)").order("codigo");
  return (data ?? []).map((s: any) => ({ id: s.id, codigo: s.codigo, equipo: s.equipo_riego?.numero ?? 0 }));
}
