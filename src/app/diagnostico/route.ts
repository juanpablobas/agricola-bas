import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Revisa que la app llegue a Supabase. No muestra llaves, solo cómo empiezan y su largo. */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const forma = (v: string) => (v ? `${v.slice(0, 8)}… (${v.length} caracteres)` : "VACÍA");

  let prueba = "sin probar";
  try {
    const r = await fetch(`${url.trim()}/auth/v1/settings`, { headers: { apikey: anon.trim() } });
    prueba = `Supabase respondió ${r.status}`;
  } catch (e) {
    prueba = `No se pudo conectar: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: url || "VACÍA",
    url_tiene_espacios_o_barra_final: url !== url.trim() || url.endsWith("/"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: forma(anon),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: forma(pub),
    SUPABASE_SERVICE_ROLE_KEY: forma(servicio),
    prueba,
  });
}
