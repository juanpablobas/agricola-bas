import { NextResponse, type NextRequest } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { enviarAvisos } from "@/lib/push";
import { cargarSeguimiento } from "@/lib/seguimiento";
import { generarRecomendacion, hayClaveIA } from "@/lib/recomendacion";
import { alertasDe, obtenerClima, ubicacionDelCampo } from "@/lib/clima";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GESTORES = ["administrador", "enc_administrativo", "enc_agricola"];
const lunesDe = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
};
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Corre una vez al día (ver vercel.json). Vercel manda el CRON_SECRET en el encabezado Authorization. */
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const admin = crearClienteAdmin();
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const esLunes = lunesDe(hoy) === hoy;
  const diaDelMes = Number(hoy.slice(8, 10));
  const resumen: Record<string, unknown> = { hoy };

  const { data: perfiles } = await admin.from("perfil").select("id, rol").eq("activo", true);
  const gestores = ((perfiles ?? []) as any[]).filter((p) => GESTORES.includes(p.rol)).map((p) => p.id as string);

  // 1) Aplicaciones de los programas
  const { pendientes } = await cargarSeguimiento(admin, hoy);
  const apps = (sit: string[], extra?: (x: any) => boolean) =>
    new Set(pendientes.filter((x) => sit.includes(x.situacion) && (!extra || extra(x))).map((x) => x.app_id)).size;
  const atrasadas = apps(["atrasada"]);
  const paraHoy = apps(["reprogramada"], (x) => x.nueva_fecha === hoy);
  const esteMes = apps(["este_mes"]);
  if (atrasadas > 0) {
    resumen.atrasadas = await enviarAvisos(admin, gestores, {
      title: "Aplicaciones atrasadas",
      body: `Hay ${plural(atrasadas, "aplicación atrasada", "aplicaciones atrasadas")}${paraHoy ? ` y ${plural(paraHoy, "reprogramada para hoy", "reprogramadas para hoy")}` : ""}. Regístralas o posponlas.`,
      url: "/programas",
    });
  } else if (paraHoy > 0) {
    resumen.paraHoy = await enviarAvisos(admin, gestores, { title: "Aplicaciones para hoy", body: `Hoy ${paraHoy === 1 ? "toca 1 aplicación que habías postergado" : `tocan ${paraHoy} aplicaciones que habías postergado`}.`, url: "/programas" });
  }
  if (diaDelMes === 1 && esteMes > 0) {
    resumen.mes = await enviarAvisos(admin, gestores, { title: "Aplicaciones del mes", body: `Este mes ${esteMes === 1 ? "toca 1 aplicación" : `tocan ${esteMes} aplicaciones`} del programa. Revisa el pedido de productos.`, url: "/programas/pedido" });
  }

  // 2) Clima: helada, lluvia o viento fuerte hoy o mañana
  try {
    const ub = await ubicacionDelCampo(admin);
    const cl = ub ? await obtenerClima(ub) : null;
    if (cl) {
      const manana = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
      const alertas = alertasDe(cl.dias, hoy, 2).filter((a) => a.fecha <= manana);
      const hayAplicaciones = atrasadas + paraHoy + esteMes > 0;
      // Lluvia y viento solo importan si hay aplicaciones por hacer; la helada importa siempre
      const utiles = alertas.filter((a) => a.tipo === "helada" || (hayAplicaciones && (a.tipo === "lluvia" || a.tipo === "viento")));
      if (utiles.length > 0) {
        resumen.clima = await enviarAvisos(admin, gestores, {
          title: "Aviso del clima",
          body: `${utiles.slice(0, 3).map((a) => a.titulo).join(". ")}.${utiles.some((a) => a.tipo !== "helada") ? " Hay aplicaciones por hacer: revisa si conviene postergar." : ""}`,
          url: "/clima",
        });
      }
    }
  } catch (e) {
    resumen.climaError = e instanceof Error ? e.message : "error";
  }

  // Recomendación del día con IA (una sola vez al día; si no hay clave, se omite)
  if (hayClaveIA()) {
    try {
      const { data: ya } = await admin.from("recomendacion_diaria").select("fecha").eq("fecha", hoy).maybeSingle();
      if (!ya) {
        const r = await generarRecomendacion(admin, hoy);
        resumen.recomendacion = r.ok ? "ok" : r.error;
        if (!r.ok && r.sinCredito) {
          const admins = ((perfiles ?? []) as any[]).filter((p) => p.rol === "administrador").map((p) => p.id as string);
          resumen.avisoSinCredito = await enviarAvisos(admin, admins, { title: "La IA se quedó sin crédito", body: "Carga saldo en la consola de Anthropic (Billing) para que vuelva la recomendación diaria.", url: "/clima" });
        }
      } else resumen.recomendacion = "ya existía";
    } catch (e) {
      resumen.recomendacion = e instanceof Error ? e.message : "error";
    }
  } else resumen.recomendacion = "sin clave de IA";

  // 3) Plan de labores: los lunes
  if (esLunes) {
    const { data: plan } = await admin.from("labor_plan").select("id, cuartel_id, labor_tipo_id, fiscalizador_id, estado").eq("semana", hoy).eq("estado", "pendiente");
    const [{ data: labores }, { data: cuarteles }, { data: trabajadores }] = await Promise.all([
      admin.from("labor_tipo").select("id, nombre"),
      admin.from("v_cuartel").select("id, codigo").range(0, 999),
      admin.from("trabajador").select("id, perfil_id").not("perfil_id", "is", null),
    ]);
    const nl = new Map(((labores ?? []) as any[]).map((l) => [l.id, l.nombre as string]));
    const nc = new Map(((cuarteles ?? []) as any[]).map((c) => [c.id, c.codigo as string]));
    const texto = (x: any) => `${nl.get(x.labor_tipo_id) ?? "Labor"}${x.cuartel_id ? ` (cuartel ${nc.get(x.cuartel_id) ?? ""})` : ""}`;
    const lista = (plan ?? []) as any[];

    if (lista.length === 0) {
      resumen.sinPlan = await enviarAvisos(admin, gestores, { title: "Plan de la semana", body: "Todavía no hay labores planificadas para esta semana.", url: `/labores/plan?semana=${hoy}` });
    } else {
      resumen.plan = await enviarAvisos(admin, gestores, {
        title: "Plan de la semana",
        body: `${plural(lista.length, "labor pendiente", "labores pendientes")}: ${lista.slice(0, 4).map(texto).join(", ")}${lista.length > 4 ? "…" : ""}.`,
        url: "/labores",
      });
      for (const t of (trabajadores ?? []) as any[]) {
        const mias = lista.filter((x) => x.fiscalizador_id === t.id);
        if (mias.length === 0) continue;
        resumen[`fiscaliza_${t.id}`] = await enviarAvisos(admin, [t.perfil_id], {
          title: "Esta semana fiscalizas",
          body: `${mias.slice(0, 4).map(texto).join(", ")}${mias.length > 4 ? "…" : ""}. Revisa que quede bien hecho.`,
          url: "/labores",
        });
      }
    }
  }

  return NextResponse.json({ ok: true, ...resumen });
}
