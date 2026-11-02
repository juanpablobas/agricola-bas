import "server-only";
import { notFound } from "next/navigation";

export async function cargarCuartel(supabase: { from: (t: string) => any }, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: c }, { data: secs }] = await Promise.all([
    supabase.from("v_cuartel").select("*").eq("id", id).maybeSingle(),
    supabase.from("cuartel_sector").select("sector_id").eq("cuartel_id", id),
  ]);
  if (!c) notFound();
  return { ...c, sectores_ids: (secs ?? []).map((s: any) => s.sector_id as string) };
}
