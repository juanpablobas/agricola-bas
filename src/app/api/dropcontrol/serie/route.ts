import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { dcGet, puntosDe } from "@/lib/dropcontrol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = ["administrador", "enc_administrativo", "enc_agricola", "propietario"];
const dia = (d: Date) => d.toISOString().slice(0, 10);

/** Serie de las últimas horas de un sensor de Drop Control (solo lectura) */
export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const { data: perfil } = await supabase.from("perfil").select("rol, activo").eq("id", user.id).single();
  if (!perfil?.activo || !ROLES.includes(perfil.rol)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NextResponse.json({ error: "Sensor no válido" }, { status: 400 });

  const ahora = new Date();
  const desde = new Date(ahora.getTime() - 3 * 86400000);
  const hasta = new Date(ahora.getTime() + 86400000);
  // El formato de fecha exacto no está documentado para nosotros: se prueban dos
  const intentos = [
    `initTime=${dia(desde)}&endTime=${dia(hasta)}`,
    `initTime=${encodeURIComponent(desde.toISOString())}&endTime=${encodeURIComponent(hasta.toISOString())}`,
  ];
  const errores: string[] = [];
  let crudo = "";
  for (const q of intentos) {
    const r = await dcGet(`/measures/${id}/data?${q}`);
    if (!r.ok) { errores.push(`${r.estado}: ${r.error}`); continue; }
    const puntos = puntosDe(r.datos);
    if (puntos.length > 0) {
      const desdeMs = ahora.getTime() - 48 * 3600000;
      return NextResponse.json({ puntos: puntos.filter((p) => p.t >= desdeMs).slice(-400) });
    }
    crudo = JSON.stringify(r.datos)?.slice(0, 600) ?? "";
    errores.push("Sin datos reconocibles en la respuesta");
  }
  if (crudo) return NextResponse.json({ puntos: [], crudo, error: errores[0] });
  return NextResponse.json({ puntos: [], error: errores.join(" | ").slice(0, 300) });
}
