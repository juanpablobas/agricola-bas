import { exigirRol } from "@/lib/auth";
import { clp, fechaHora, num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { FormularioCarga } from "./Formulario";

export const metadata = { title: "Cargar finanzas" };
export const maxDuration = 60;

export default async function Cargar() {
  const { supabase } = await exigirRol("administrador", "enc_administrativo");
  const { data: cargas } = await supabase
    .from("carga_finanzas")
    .select("id, tipo, archivo, filas, total, desde, hasta, estado, creado_en, temporada(nombre)")
    .order("creado_en", { ascending: false })
    .limit(20);

  const vigentes = (cargas ?? []).filter((c) => c.estado === "vigente");
  const hayPresupuesto = vigentes.some((c) => c.tipo === "presupuesto");
  const hayGastos = vigentes.some((c) => c.tipo === "gastos");

  return (
    <>
      <Encabezado
        titulo="Cargar archivo del administrador"
        subtitulo="Sube el Excel que llega por correo. La app lee el presupuesto y los gastos y los guarda; no hay que tipear nada."
        volver={{ href: "/finanzas", texto: "Finanzas" }}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="tarjeta flex flex-col gap-4 p-5">
          <Aviso tipo="info">
            Los montos van con IVA, igual que el control del administrador. Cada carga nueva de gastos reemplaza a la anterior
            (el archivo del administrador es acumulado), y queda registrada con quién la subió y cuándo.
          </Aviso>
          <FormularioCarga hayPresupuesto={hayPresupuesto} hayGastos={hayGastos} />
        </section>

        <section className="tarjeta overflow-x-auto">
          <h2 className="p-5 pb-3 font-semibold">Cargas anteriores</h2>
          {(cargas ?? []).length === 0 ? (
            <p className="px-5 pb-5 text-sm text-tinta-suave">Todavía no hay cargas.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr><th>Fecha</th><th>Tipo</th><th className="text-right">Filas</th><th className="text-right">Total</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {(cargas ?? []).map((c: any) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap">{fechaHora(c.creado_en)}<span className="block max-w-48 truncate text-xs text-tinta-suave">{c.archivo}</span></td>
                    <td>{c.tipo === "gastos" ? "Gastos" : "Presupuesto"}</td>
                    <td className="text-right">{num(c.filas)}</td>
                    <td className="text-right">{clp(Number(c.total))}</td>
                    <td>
                      <span className={`pastilla ${c.estado === "vigente" ? "bg-verde-claro text-verde-oscuro" : "bg-papel text-tinta-suave"}`}>
                        {c.estado === "vigente" ? "Vigente" : "Reemplazada"}
                      </span>
                    </td>
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
