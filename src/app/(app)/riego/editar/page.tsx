import { notFound } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { Encabezado } from "@/components/Encabezado";
import { FormularioEquipo } from "./FormularioEquipo";

export const metadata = { title: "Editar equipo de riego" };

export default async function EditarEquipo({ searchParams }: { searchParams: Promise<{ equipo?: string }> }) {
  const { equipo: numero } = await searchParams;
  const { supabase } = await exigirRol("administrador", "enc_agricola");
  const { data: equipo } = await supabase.from("equipo_riego").select("*, sector_riego(*)").eq("numero", Number(numero)).maybeSingle();
  if (!equipo) notFound();
  const sectores = [...(equipo.sector_riego ?? [])].sort((a: any, b: any) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  return (
    <>
      <Encabezado titulo={`Editar ${equipo.nombre}`} volver={{ href: "/riego", texto: "Riego" }} />
      <FormularioEquipo equipo={equipo} sectores={sectores} />
    </>
  );
}
