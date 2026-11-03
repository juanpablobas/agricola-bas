import { exigirRol } from "@/lib/auth";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { dcGet, hayClaveDropControl } from "@/lib/dropcontrol";

export const metadata = { title: "Drop Control" };
export const dynamic = "force-dynamic";

const texto = (x: any) => String(x?.name ?? x?.nombre ?? x?.id ?? "—");

export default async function DropControl() {
  await exigirRol("administrador", "enc_administrativo", "enc_agricola");

  if (!hayClaveDropControl()) {
    return (
      <>
        <Encabezado titulo="Drop Control" subtitulo="Conexión con tus sensores y riego." volver={{ href: "/riego", texto: "Riego" }} />
        <Aviso>
          Todavía falta la clave. En Vercel, entra a Settings, Environment Variables, agrega <strong>DROPCONTROL_API_KEY</strong> con tu clave (marca Sensitive) y vuelve a desplegar. No pegues la clave en el chat.
        </Aviso>
      </>
    );
  }

  const campos = await dcGet<any[]>("/farms");
  const listaCampos: any[] = campos.ok && Array.isArray(campos.datos) ? campos.datos : [];

  const detalle = await Promise.all(
    listaCampos.slice(0, 5).map(async (f) => {
      const z = await dcGet<any[]>(`/farms/${f.id}/zones`);
      const zonas: any[] = z.ok && Array.isArray(z.datos) ? z.datos : [];
      const medidas = await Promise.all(
        zonas.slice(0, 20).map(async (zona) => {
          const m = await dcGet<any[]>(`/zones/${zona.id}/measures`);
          return { zona, ok: m.ok, error: m.error, medidas: m.ok && Array.isArray(m.datos) ? m.datos : [] };
        }),
      );
      return { campo: f, zonasOk: z.ok, zonasError: z.error, totalZonas: zonas.length, medidas };
    }),
  );

  return (
    <>
      <Encabezado titulo="Drop Control" subtitulo="Prueba de conexión: lo que la clave deja ver de tu cuenta." volver={{ href: "/riego", texto: "Riego" }} />

      {!campos.ok ? (
        <Aviso tipo="error">
          No se pudo leer la cuenta (respuesta {campos.estado || "sin conexión"}): {campos.error}. Revisa que la clave esté bien pegada y que sea la de la API.
        </Aviso>
      ) : listaCampos.length === 0 ? (
        <Aviso>La conexión funciona, pero la cuenta no devolvió campos. Puede que la clave no tenga permisos de lectura de campos.</Aviso>
      ) : (
        <div className="mb-3"><Aviso tipo="ok">Conexión correcta: se ven {listaCampos.length} {listaCampos.length === 1 ? "campo" : "campos"}.</Aviso></div>
      )}

      <div className="flex flex-col gap-4">
        {detalle.map((d) => (
          <section key={String(d.campo.id)} className="tarjeta p-4">
            <h2 className="font-semibold">{texto(d.campo)} <span className="text-xs font-normal text-tinta-suave">(código {String(d.campo.id)})</span></h2>
            {!d.zonasOk ? (
              <p className="mt-1 text-sm text-alerta">No se pudieron leer las zonas: {d.zonasError}</p>
            ) : (
              <p className="mt-1 text-sm text-tinta-suave">{d.totalZonas} zonas{d.totalZonas > 20 ? " (se muestran 20)" : ""}.</p>
            )}
            <ul className="mt-3 flex flex-col gap-2">
              {d.medidas.map((m) => (
                <li key={String(m.zona.id)} className="rounded-lg border border-linea p-3 text-sm">
                  <p className="font-medium">{texto(m.zona)}</p>
                  {!m.ok ? (
                    <p className="text-alerta">No se pudieron leer los sensores: {m.error}</p>
                  ) : m.medidas.length === 0 ? (
                    <p className="text-tinta-suave">Sin sensores en esta zona.</p>
                  ) : (
                    <p className="text-tinta-suave">
                      {m.medidas.slice(0, 12).map((x: any) => `${texto(x)}${x.unit ? ` (${x.unit})` : ""}${x.lastData != null ? `: ${x.lastData}` : ""}`).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-3 max-w-2xl text-xs text-tinta-suave">Esta pantalla solo lee: no cambia nada en Drop Control. Si algo sale mal o no aparece lo que esperas, cuéntame qué mensaje ves.</p>
    </>
  );
}
