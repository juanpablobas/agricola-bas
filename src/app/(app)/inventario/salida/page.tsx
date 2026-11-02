import { exigirRol } from "@/lib/auth";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { FormularioSalida } from "./Formulario";

export const metadata = { title: "Registrar salida" };

export default async function Salida({ searchParams }: { searchParams: Promise<{ producto?: string }> }) {
  const p = await searchParams;
  const { supabase } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");

  const [{ data: stock }, { data: cecos }] = await Promise.all([
    supabase.from("v_stock").select("producto_id, nombre, unidad, stock").gt("stock", 0.0005).order("nombre").range(0, 999),
    supabase.from("ceco").select("id, codigo, nombre").eq("activo", true).order("codigo"),
  ]);
  const productos = (stock ?? []).map((s) => ({ id: s.producto_id as string, nombre: s.nombre as string, unidad: s.unidad as string | null, stock: Number(s.stock) }));
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

  return (
    <>
      <Encabezado titulo="Registrar salida" subtitulo="Anota un producto que se sacó de bodega y no viene en el archivo del administrador (por ejemplo, una compra de emergencia)." volver={{ href: "/inventario", texto: "Inventario" }} />
      <section className="tarjeta max-w-2xl p-5">
        {productos.length === 0 ? (
          <Aviso>No hay productos con stock. Primero carga el archivo de inventario.</Aviso>
        ) : (
          <FormularioSalida productos={productos} cecos={(cecos ?? []) as any} hoy={hoy} inicial={p.producto} />
        )}
      </section>
      <p className="mt-3 max-w-2xl text-xs text-tinta-suave">Las salidas hechas aquí quedan marcadas como “hecha en la app”. Cuando el administrador las incluya en su próximo archivo, avísale al administrador de la app para borrar la copia y no contarlas dos veces.</p>
    </>
  );
}
