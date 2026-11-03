import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Aviso = { title: string; body: string; url?: string };

async function leerClaves(admin: SupabaseClient) {
  const { data } = await admin.from("push_clave").select("publica, privada").eq("id", 1).maybeSingle();
  return data as { publica: string; privada: string } | null;
}

/** Clave pública que necesita el celular para suscribirse a los avisos */
export async function clavePublica(admin: SupabaseClient) {
  return (await leerClaves(admin))?.publica ?? null;
}

/** Envía un aviso a todos los celulares activados de los usuarios indicados. Borra los que ya no existen. */
export async function enviarAvisos(admin: SupabaseClient, userIds: string[], aviso: Aviso) {
  const res = { enviados: 0, fallidos: 0, celulares: 0, errores: [] as string[] };
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return res;
  const claves = await leerClaves(admin);
  if (!claves) return res;

  const dominio = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  webpush.setVapidDetails(dominio ? `https://${dominio}` : "https://agricola-bas.vercel.app", claves.publica, claves.privada);

  const { data: subs } = await admin.from("push_suscripcion").select("id, endpoint, p256dh, auth").in("user_id", ids);
  const lista = (subs ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[];
  res.celulares = lista.length;
  const payload = JSON.stringify({ title: aviso.title, body: aviso.body, url: aviso.url ?? "/" });

  await Promise.all(
    lista.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12, urgency: "normal" });
        res.enviados++;
      } catch (e: any) {
        res.fallidos++;
        res.errores.push(`${e?.statusCode ?? "sin código"}: ${String(e?.body ?? e?.message ?? e).slice(0, 160)}`);
        if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from("push_suscripcion").delete().eq("id", s.id);
      }
    }),
  );
  return res;
}
