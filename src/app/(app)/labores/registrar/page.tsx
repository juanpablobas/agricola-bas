import { exigirRol, puede } from "@/lib/auth";
import { hoyChile, esFecha } from "@/lib/semana";
import { Encabezado } from "@/components/Encabezado";
import { FormRegistro, type Inicial } from "../FormRegistro";
import { cargarOpciones } from "../lib";

export const metadata = { title: "Agregar labor" };

export default async function Registrar({ searchParams }: { searchParams: Promise<{ estado?: string; fecha?: string; cuartel?: string }> }) {
  const p = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  const [op, { data: bodega }] = await Promise.all([
    cargarOpciones(supabase),
    supabase.from("v_stock").select("producto_id, nombre, unidad, clasificacion, stock").gt("stock", 0).order("nombre").range(0, 999),
  ]);
  const hoy = hoyChile();
  const inicial: Inicial = { cuartel: p.cuartel };
  const estado = p.estado === "realizado" || p.estado === "en_ejecucion" ? p.estado : "programado";
  return (
    <>
      <Encabezado titulo="Agregar labor" subtitulo="Una labor por hacer, en curso o ya terminada." volver={{ href: "/labores", texto: "Labores" }} />
      <section className="tarjeta max-w-3xl p-4 sm:p-5">
        <FormRegistro
          hoy={esFecha(p.fecha) ? p.fecha : hoy} cuarteles={op.cuarteles} variedades={op.variedades} labores={op.labores} cuadrillas={op.cuadrillas}
          trabajadores={op.trabajadores} conMonto={puede(perfil.rol, "administrador", "enc_administrativo")} inicial={inicial} estadoInicial={estado}
          bodega={((bodega ?? []) as any[]).map((b) => ({ id: b.producto_id, nombre: b.nombre, unidad: b.unidad, clasificacion: b.clasificacion, stock: Number(b.stock) }))}
        />
      </section>
    </>
  );
}
