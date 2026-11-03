import { hoyChile } from "@/lib/semana";
import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { etiquetaEstado } from "@/lib/etiquetas";

// Planilla CSV con separador ";" y coma decimal, para que Excel en español la abra bien.
export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const p = request.nextUrl.searchParams;
  let q = supabase.from("v_cuartel").select("*").order("codigo");
  if (!p.get("inactivos")) q = q.eq("activo", true);
  if (p.get("especie")) q = q.eq("especie", p.get("especie")!);
  if (p.get("equipo")) q = q.eq("equipo", Number(p.get("equipo")));
  if (p.get("estado")) q = q.eq("estado_productivo", p.get("estado")!);
  const { data } = await q;

  const dec = (v: unknown, d = 2) => (v === null || v === undefined ? "" : Number(v).toFixed(d).replace(".", ","));
  const txt = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const encabezado = [
    "Cuartel", "Especie", "Variedad", "Superficie (ha)", "Estado", "Año plantación", "Portainjerto",
    "Entre hileras (m)", "Entre plantas (m)", "Plantas (conteo)", "Plantas teóricas", "Sector de riego",
    "Equipo", "Activo", "Observaciones",
  ];
  const filas = (data ?? []).map((c: any) => [
    txt(c.codigo), txt(c.especie), txt(c.variedad), dec(c.superficie_ha), txt(etiquetaEstado(c.estado_productivo)),
    txt(c.anio_plantacion), txt(c.portainjerto), dec(c.distancia_hileras_m, 1), dec(c.distancia_plantas_m, 1),
    txt(c.plantas), txt(c.plantas_teoricas), txt(c.sectores), txt(c.equipo), c.activo ? "Sí" : "No", txt(c.observaciones),
  ].join(";"));

  const csv = "﻿" + [encabezado.join(";"), ...filas].join("\r\n");
  const hoy = hoyChile();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuarteles-la-morera-${hoy}.csv"`,
    },
  });
}
