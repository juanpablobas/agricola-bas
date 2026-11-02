import { exigirRol } from "@/lib/auth";
import { fechaHora, fecha, num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { FormularioInventario } from "./Formulario";

export const metadata = { title: "Cargar inventario" };
export const maxDuration = 60;

export default async function Cargar() {
  const { supabase } = await exigirRol("administrador", "enc_administrativo");
  const { data: cargas } = await supabase
    .from("carga_inventario")
    .select("id, archivo, ingresos, salidas, desde, hasta, estado, creado_en")
    .order("creado_en", { ascending: false })
    .limit(20);

  return (
    <>
      <Encabezado
        titulo="Cargar inventario"
        subtitulo="Sube el Excel de inventario que llega del administrador (con las hojas Ingresos y Salidas)."
        volver={{ href: "/inventario", texto: "Inventario" }}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="tarjeta flex flex-col gap-4 p-5">
          <Aviso tipo="info">
            Cada carga reemplaza los movimientos del archivo anterior, porque el archivo del administrador es acumulado. Las salidas
            que registres a mano en la app se mantienen, y te avisaremos si alguna podría estar repetida.
          </Aviso>
          <FormularioInventario />
        </section>
        <section className="tarjeta overflow-x-auto">
          <h2 className="p-5 pb-3 font-semibold">Cargas anteriores</h2>
          {(cargas ?? []).length === 0 ? (
            <p className="px-5 pb-5 text-sm text-tinta-suave">Todavía no hay cargas.</p>
          ) : (
            <table className="tabla">
              <thead><tr><th>Fecha</th><th className="text-right">Ingresos</th><th className="text-right">Salidas</th><th>Período</th><th>Estado</th></tr></thead>
              <tbody>
                {(cargas ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap">{fechaHora(c.creado_en)}<span className="block max-w-48 truncate text-xs text-tinta-suave">{c.archivo}</span></td>
                    <td className="text-right">{num(c.ingresos)}</td>
                    <td className="text-right">{num(c.salidas)}</td>
                    <td className="whitespace-nowrap text-xs">{fecha(c.desde)} a {fecha(c.hasta)}</td>
                    <td><span className={`pastilla ${c.estado === "vigente" ? "bg-verde-claro text-verde-oscuro" : "bg-papel text-tinta-suave"}`}>{c.estado === "vigente" ? "Vigente" : "Reemplazada"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
